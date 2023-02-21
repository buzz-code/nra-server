import { YemotCall, YemotParams } from "@shared/entities/YemotCall.entity";
import { DataSource } from "typeorm";

export const YEMOT_PROCCESSOR_PROVIDER = 'yemot_processor_provider';
export const YEMOT_HANGUP_STEP = 'hangup';
export const YEMOT_NOT_IMPL_STEP = 'error-not-impl-step';

export abstract class YemotProcessor {
  constructor(protected dataSource: DataSource) { }

  steps: { [key: string]: string };

  protected async getText(textKey: string, ...args): Promise<string> {
    // todo: use cache
    return 'text: ' + textKey + args.join(', ');
  }

  abstract processCall(activeCall: YemotCall, body: YemotParams): Promise<{ response: string; nextStep: string; }>;
}

export type YemotProcessorProvider = (dataSource: DataSource) => YemotProcessor;
