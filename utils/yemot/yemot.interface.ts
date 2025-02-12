import { YemotCall, YemotParams } from "@shared/entities/YemotCall.entity";
import { Text } from "@shared/entities/Text.entity";
import { Between, DataSource, In } from "typeorm";
import util from "./yemot.util";
import { TextByUser } from "@shared/view-entities/TextByUser.entity";
import { Lesson } from "src/db/entities/Lesson.entity";
import { Klass } from "src/db/entities/Klass.entity";
import { Teacher } from "src/db/entities/Teacher.entity";
import { StudentKlass } from "src/db/entities/StudentKlass.entity";
import { AttReport } from "src/db/entities/AttReport.entity";
import { Grade } from "src/db/entities/Grade.entity";
import { getCurrentHebrewYear } from "../entity/year.util";
import { User } from "@shared/entities/User.entity";

export const YEMOT_PROCCESSOR_PROVIDER = 'yemot_processor_provider';
export const YEMOT_CHAIN = 'yemot_chain';
export const YEMOT_HANGUP_STEP = 'hangup';
export const YEMOT_NOT_IMPL_STEP = 'error-not-impl-step';

export function FormatString(str: string, val: string[]) {
  return str.replace(/{([\d]*)}/g, (_, index) => val[index]);
}

// export interface YemotResponse {
//   response: string;
//   nextStep: string;
// }

export abstract class YemotProcessor {
  constructor(protected dataSource: DataSource) { }

  steps: { [key: string]: string };
  params: { [key: string]: string };

  protected async getText(userId: number, textKey: string, ...args): Promise<string> {
    const text = await this.dataSource.getRepository(TextByUser).findOne({
      where: { userId, name: textKey },
      cache: true,
    })
    const textValue = text?.value || textKey
    return FormatString(textValue, args);
  }

  abstract processCall(activeCall: YemotCall, body: YemotParams): Promise<YemotResponse>;
}

export type YemotProcessorProvider = (dataSource: DataSource) => YemotProcessor;

export class YemotRequest {
  constructor(
    private activeCall: YemotCall,
    public dataSource: DataSource,
  ) {
    this.params = this.activeCall.data || {};
  }

  params: any;

  getUserId() {
    return this.activeCall.userId;
  }
  async getUser() {
    return this.activeCall.user ?? this.dataSource.getRepository(User).findOneOrFail({ where: { id: this.activeCall.userId } });
  }
  async getUserPermissions() {
    const user = await this.getUser();
    return user.permissions;
  }
  async getLessonFromLessonId(lessonId: number) {
    return this.dataSource.getRepository(Lesson).findOneBy({
      userId: this.activeCall.userId,
      key: lessonId,
      year: getCurrentHebrewYear(),
    });
  }
  async getKlassByKlassId(klassKey: number, klassId?: number) {
    if (!!klassId) {
      return this.dataSource.getRepository(Klass).findOneBy({
        id: klassId,
      });
    }
    return this.dataSource.getRepository(Klass).findOneBy({
      userId: this.activeCall.userId,
      key: klassKey,
      year: getCurrentHebrewYear(),
    });
  }
  async getTeacherByPhone(phone: string) {
    return this.dataSource.getRepository(Teacher).findOne({
      where: [
        { userId: this.activeCall.userId, phone },
        { userId: this.activeCall.userId, phone2: phone },
      ]
    });
  }
  async getStudentsByKlassId(klassId: number) {
    const res = await this.dataSource.getRepository(StudentKlass).find({
      where: {
        userId: this.activeCall.userId,
        klassReferenceId: klassId,
        year: getCurrentHebrewYear(),
      },
      relations: {
        student: true,
      },
      order: {
        student: {
          name: 'ASC',
        }
      }
    });

    return res.map(item => item.student).filter(Boolean);
  }
  async saveReport(reportData: AttReport | Grade, type: ReportType) {
    const reportEntity = type === 'att' ? AttReport : Grade;
    const reportRepo = this.dataSource.getRepository(reportEntity);

    const report = reportRepo.create(reportData)
    await reportRepo.save(report);

    return report;
  }
  getExistingAttReports(klassId: string, lessonId: string, sheetName: string): Promise<AttReport[]> {
    return this.dataSource.getRepository(AttReport).findBy({
      userId: this.activeCall.userId,
      sheetName,
      lessonReferenceId: Number(lessonId),
      klassReferenceId: Number(klassId),
      year: getCurrentHebrewYear(),
    })
  }
  getExistingGradeReports(klassId: string, lessonId: string, sheetName: string): Promise<Grade[]> {
    return this.dataSource.getRepository(Grade).findBy({
      userId: this.activeCall.userId,
      lessonReferenceId: Number(lessonId),
      klassReferenceId: Number(klassId),
      year: getCurrentHebrewYear(),
      reportDate: Between(new Date(Date.now() - 2 * 7 * 24 * 60 * 60 * 1000), new Date())
    })
  }
  async deleteExistingReports(existingReports: (AttReport | Grade)[], type: ReportType) {
    if (existingReports.length) {
      const entity = type === 'att' ? AttReport : Grade;
      await this.dataSource.getRepository(entity)
        .delete({
          id: In(existingReports.map(item => item.id))
        });
    }
  }
}

export type ReportType = 'att' | 'grade';
type PromiseOrSelf<T> = T | Promise<T>;

interface MessageItem {
  text: PromiseOrSelf<string>;
  param: string;
  options: any;
}

const invalidCharsRegex = /[\.\-'"&]/g;

export class YemotResponse {
  constructor(
    private dataSource?: DataSource,
    private userId?: number
  ) { }

  messages: MessageItem[] = [];

  async getText(textKey: string, ...args) {
    const text = await this.dataSource.getRepository(TextByUser).findOne({
      where: {
        userId: this.userId,
        name: textKey
      },
      cache: true,
    })
    const textValue = text?.value || textKey
    return FormatString(textValue, args)?.replace(invalidCharsRegex, '');
  }

  hangup() {
    return YEMOT_HANGUP_STEP;
  }

  clear() {
    this.messages.length = 0;
  }

  send(text: PromiseOrSelf<string>, param: string = null, options: any = {}) {
    this.messages.push({ text, param, options });
  }

  async getResponse(): Promise<string> {
    const userMessages = [];
    for (const message of this.messages) {
      if (typeof message.text !== 'string') {
        message.text = await message.text;
      }

      if (message.param) {
        userMessages.push(util.read_v2(message.text, message.param, message.options))
      } else if (message.text === YEMOT_HANGUP_STEP) {
        userMessages.push(util.hangup());
      } else {
        userMessages.push(util.id_list_message_v2(message.text));
      }
    }
    console.log('userMessages:', userMessages)
    return util.send(...userMessages);
  }
};

export class YemotResponseMock extends YemotResponse {
  async getText(textKey: string, ...args) {
    return textKey;
  }
}