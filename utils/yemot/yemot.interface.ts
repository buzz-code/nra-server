import { YemotCall, YemotParams } from "@shared/entities/YemotCall.entity";
import { Text } from "@shared/entities/Text.entity";
import { Between, DataSource, In } from "typeorm";
import util from "./yemot.util";
import { TextByUser } from "@shared/view-entities/TextByUser.entity";
import { getCurrentHebrewYear } from "../entity/year.util";
import { User } from "@shared/entities/User.entity";

export const YEMOT_PROCCESSOR_PROVIDER = 'yemot_processor_provider';
export const YEMOT_CHAIN = 'yemot_chain';
export const YEMOT_REQUEST = 'yemot_request';
export const YEMOT_HANGUP_STEP = 'hangup';
export const YEMOT_NOT_IMPL_STEP = 'error-not-impl-step';

export type YemotRequestConstructor = new (activeCall: YemotCall, dataSource: DataSource) => YemotRequest;

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

export abstract class YemotRequest {
  constructor(
    protected activeCall: YemotCall,
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
  
  abstract getLessonFromLessonId(lessonId: number): Promise<any>;
  abstract getKlassByKlassId(klassKey: number, klassId?: number): Promise<any>;
  abstract getTeacherByPhone(phone: string): Promise<any>;
  abstract getStudentsByKlassId(klassId: number): Promise<any[]>;
  abstract saveReport(reportData: any, type: ReportType): Promise<any>;
  abstract getExistingAttReports(klassId: string, lessonId: string, sheetName: string): Promise<any[]>;
  abstract getExistingGradeReports(klassId: string, lessonId: string, sheetName: string): Promise<any[]>;
  abstract deleteExistingReports(existingReports: any[], type: ReportType): Promise<void>;
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