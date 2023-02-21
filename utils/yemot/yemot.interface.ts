import { YemotCall, YemotParams } from "@shared/entities/YemotCall.entity";
import { Text } from "src/db/entities/Text.entity";
import { DataSource } from "typeorm";

export const YEMOT_PROCCESSOR_PROVIDER = 'yemot_processor_provider';
export const YEMOT_HANGUP_STEP = 'hangup';
export const YEMOT_NOT_IMPL_STEP = 'error-not-impl-step';

export function FormatString(str: string, val: string[]) {
  return str.replace(/{([\d]*)}/g, (_, index) => val[index]);
}

export interface YemotResponse {
  response: string;
  nextStep: string;
}

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
