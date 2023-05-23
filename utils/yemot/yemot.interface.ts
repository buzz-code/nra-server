import { YemotCall, YemotParams } from "@shared/entities/YemotCall.entity";
import { Text } from "@shared/entities/Text.entity";
import { DataSource } from "typeorm";
import util from "./yemot.util";

export const YEMOT_PROCCESSOR_PROVIDER = 'yemot_processor_provider';
export const YEMOT_CHAIN = 'yemot_chain';
export const YEMOT_HANGUP_STEP = 'hangup';
export const YEMOT_NOT_IMPL_STEP = 'error-not-impl-step';
export const USER_NOT_FOUND = 'UserNotFound';

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
    const text = await this.dataSource.getRepository(Text).findOne({
      where: { userId, name: textKey },
      cache: true,
    })
    return FormatString(text.value, args);
  }

  abstract processCall(activeCall: YemotCall, body: YemotParams): Promise<YemotResponse>;
}

export type YemotProcessorProvider = (dataSource: DataSource) => YemotProcessor;

export class YemotRequest {
  constructor(
    private activeCall: YemotCall,
    body: YemotParams,
    public dataSource: DataSource,
  ) {
    this.params = body;
  }

  params: any;
  async getLessonFromLessonId(lessonId: string) {
    return { lessonId, name: 'lesson name' };
  }
  async getTeacherByPhone(phone: string) {
    return { name: 'teacher', phone };
  }
  async getStudentsByUserIdAndKlassIds(userId: number, klassId: number) {
    return [{ tz: '123' }, { tz: '456' }];
  }
  saveReport(attReport: any) {
    // todo
  }
  deleteExistingReports(existingReports: any) {
    // todo
  }
}


type PromiseOrSelf<T> = T | Promise<T>;

interface MessageItem {
  text: PromiseOrSelf<string>;
  param: string;
  options: any;
}

export class YemotResponse {
  constructor(
    private dataSource?: DataSource,
    private userId?: number
  ) { }

  messages: MessageItem[] = [];

  async getText(textKey: string, ...args) {
    const text = await this.dataSource.getRepository(Text).findOne({
      where: {
        userId: this.userId,
        name: textKey
      },
      cache: true,
    })
    return FormatString(text?.value || textKey, args);
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
    console.log(userMessages)
    return util.send(...userMessages);
  }
};

export class YemotResponseMock extends YemotResponse {
  async getText(textKey: string, ...args) {
    return textKey;
  }
}