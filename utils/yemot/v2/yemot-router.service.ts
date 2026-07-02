import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as express from 'express';
import { Call, TapOptions, YemotRouter } from 'yemot-router2';
import { User } from '@shared/entities/User.entity';
import { TextByUser } from '@shared/view-entities/TextByUser.entity';
import { YemotCallTrackingService } from './yemot-call-tracking.service';

const logger = new Logger('YemotRouterService');

export const YEMOT_HANDLER_FACTORY = 'YemotHandlerFactory';
export type YemotHandlerFactory = new (dataSource: DataSource, call: Call, callTracker: YemotCallTrackingService) => BaseYemotHandlerService;
type TextParams = Record<string, string | number>;
type MessageObj = { type: 'text' | 'file'; data: string };
export type ContentData = { value?: string | null; filepath?: string | null };

@Injectable()
export class YemotRouterService {
  protected readonly logger = logger;

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @Inject(YEMOT_HANDLER_FACTORY) private yemotHandlerFactory: YemotHandlerFactory,
    private callTrackingService: YemotCallTrackingService,
  ) { }

  getRouter(): express.Router {
    const router = this.getExpressRouter();
    const yemotRouter = this.getYemotRouter();
    router.use('/', yemotRouter);

    yemotRouter.all('/', async (call: Call) => {
      const yemotHandlerService = new this.yemotHandlerFactory(this.dataSource, call, this.callTrackingService);
      await yemotHandlerService.processCall();
    });

    return router;
  }

  private getExpressRouter(): express.Router {
    const router = express.Router();
    router.use(express.urlencoded({ extended: true }));
    router.use((err, req, res, next) => {
      if (err) {
        this.logger.error(`Error in Yemot router: ${err.message}`, err.stack);
      }
      next(err);
    });
    return router;
  }

  private getYemotRouter(): express.Router {
    const yemotRouter = YemotRouter({
      printLog: true,
      timeout: 5 * 60 * 1000,
      uncaughtErrorHandler: (error, call) => {
        this.logger.error(`Uncaught error from ${call.phone}. Error: ${error.stack}`);
        try {
          call.id_list_message([{ type: 'text', data: 'אירעה שגיאה, אנא נסה שוב מאוחר יותר' }]);
        } catch (e) {
          this.logger.error(`Error sending hangup message: ${e.message}`);
        }
      },
      defaults: {
        removeInvalidChars: true,
        id_list_message: {
          removeInvalidChars: true,
        },
        read: {
          tap: {
            removeInvalidChars: true,
          },
        },
      },
    });

    yemotRouter.events.on('call_hangup', async (call) => {
      this.logger.log(`Call ${call.callId} was hungup - Phone: ${call.phone}`);
      await this.callTrackingService.finalizeCall(call.callId);
    });
    yemotRouter.events.on('call_continue', (call) => {
      this.logger.log(`Call ${call.callId} continues - Phone: ${call.phone}`);
    });
    yemotRouter.events.on('new_call', async (call) => {
      this.logger.log(`New call ${call.callId} from ${call.phone}`);
      await this.callTrackingService.initializeCall(call);
    });

    return yemotRouter.asExpressRouter;
  }
}

export class BaseYemotHandlerService {
  protected readonly logger = logger;
  protected user: User;

  constructor(
    @InjectDataSource() protected dataSource: DataSource,
    protected call: Call,
    protected callTracker: YemotCallTrackingService,
  ) { }

  async processCall(): Promise<void> {
    // Default implementation (can be overridden)
    this.logger.log(`Processing call with ID: ${this.call.callId}`);
    await this.hangupWithMessage('Default handler: Call processing not implemented.');
  }

  protected async getUserByDidPhone() {
    this.logger.log(`Getting user by phone: ${this.call.did}`);
    const user = await this.dataSource.getRepository(User).findOne({ where: { phoneNumber: this.call.did } });
    if (!user) {
      return this.hangupWithMessage('המערכת לא מחוברת, אנא פני למזכירות');
    }
    this.user = user;
  }

  protected async getTextDataByUserId(textKey: string, values?: TextParams): Promise<{ value: string; filepath: string | null }> {
    this.logger.log(`Getting text data for user ID: ${this.user.id}, text key: ${textKey}`);
    const text = await this.dataSource
      .getRepository(TextByUser)
      .findOne({
        where: { userId: this.user.id, name: textKey },
        cache: true
      });

    let textValue = text?.value || textKey;
    let filepath = text?.filepath || null;

    if (values) {
      Object.keys(values).forEach((key) => {
        textValue = textValue.replace(`{${key}}`, values[key].toString());
      });
    }

    return { value: textValue, filepath };
  }

  protected async getTextByUserId(textKey: string, values?: TextParams): Promise<string> {
    const textData = await this.getTextDataByUserId(textKey, values);
    return textData.value;
  }

  // ── Private dispatch helpers ─────────────────────────────────────────────
  // Single place that talks to this.call for send / read / hangup operations.

  // Multi-line text is sent as several prepended messages (one per non-empty
  // line) instead of a single message with embedded line breaks.
  private splitTextIntoMessages(text: string): MessageObj[] {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return (lines.length ? lines : ['']).map((data) => ({ type: 'text' as const, data }));
  }

  private buildMessageFromContent(content: ContentData): MessageObj[] {
    if (content?.filepath?.trim()) return [{ type: 'file', data: content.filepath }];
    return this.splitTextIntoMessages(content?.value || '');
  }

  private async dispatchSend(msgObjs: MessageObj[]) {
    const text = msgObjs.map((m) => (m.type === 'file' ? `[File: ${m.data}]` : m.data)).join('\n');
    this.logger.log(`Sending: ${text}`);
    await this.callTracker.logConversationStep(this.call.callId, text, undefined, 'send_message');
    return this.call.id_list_message(msgObjs, { prependToNextAction: true });
  }

  private async dispatchRead(msgObjs: MessageObj[], options?: TapOptions): Promise<string> {
    const text = msgObjs.map((m) => (m.type === 'file' ? `[File: ${m.data}]` : m.data)).join('\n');
    this.logger.log(`Asking for input from: ${text}`);
    await this.callTracker.logConversationStep(this.call.callId, text, undefined, 'ask_input');
    const input = await this.call.read(msgObjs, 'tap', options);
    await this.callTracker.logConversationStep(this.call.callId, text, input, 'user_input');
    return input;
  }

  private async dispatchHangup(msgObjs: MessageObj[]): Promise<void> {
    const text = msgObjs.map((m) => (m.type === 'file' ? `[File: ${m.data}]` : m.data)).join('\n');
    this.logger.log(`Hanging up with: ${text}`);
    await this.callTracker.logConversationStep(this.call.callId, text, undefined, 'hangup_message');
    this.call.id_list_message(msgObjs, { prependToNextAction: true });
    this.call.hangup();
  }

  // ── String-based methods (plain text) ───────────────────────────────────

  protected hangupWithMessage(message: string) {
    return this.dispatchHangup(this.splitTextIntoMessages(message));
  }

  protected askForInput(message: string, options?: TapOptions) {
    return this.dispatchRead(this.splitTextIntoMessages(message), options);
  }

  protected sendMessage(message: string) {
    return this.dispatchSend(this.splitTextIntoMessages(message));
  }

  // ── Text-key-based methods (lookup via TextByUser view) ──────────────────

  protected async hangupWithMessageByKey(textKey: string, values?: TextParams) {
    return this.dispatchHangup(await this.getMessageByKey(textKey, values));
  }

  protected async askForInputByKey(textKey: string, values?: TextParams, options?: TapOptions) {
    return this.dispatchRead(await this.getMessageByKey(textKey, values), options);
  }

  protected async sendMessageByKey(textKey: string, values?: TextParams) {
    return this.dispatchSend(await this.getMessageByKey(textKey, values));
  }

  private async getMessageByKey(textKey: string, values?: TextParams): Promise<MessageObj[]> {
    const textData = await this.getTextDataByUserId(textKey, values);
    if (textData.filepath && textData.filepath.trim()) {
      return [{ type: 'file', data: textData.filepath }];
    }
    return this.splitTextIntoMessages(textData.value);
  }

  // ── Content-object-based methods (pass any { value, filepath } object) ───

  protected sendMessageFromContent(content: ContentData) {
    return this.dispatchSend(this.buildMessageFromContent(content));
  }

  protected askForInputFromContent(content: ContentData, options?: TapOptions) {
    return this.dispatchRead(this.buildMessageFromContent(content), options);
  }

  protected hangupWithMessageFromContent(content: ContentData) {
    return this.dispatchHangup(this.buildMessageFromContent(content));
  }

  // ── Composite helpers ────────────────────────────────────────────────────

  protected async askForMenu<T extends { key: string | number, name: string }>(textKey: string, options: T[]) {
    this.logger.log(`Asking for menu with text key: ${textKey}`);

    const menuOptions = options.map(({ key, name }) => `${key} - ${name}`).join(', ');
    const menuKey = await this.askForInputByKey(textKey, { options: menuOptions }, {
      min_digits: 1,
      max_digits: Math.max(...options.map((et) => et.key.toString().length)),
      digits_allowed: options.map((et) => et.key.toString()),
    });

    const selectedOption = options.find((et) => et.key.toString() === menuKey);

    const menuPrompt = await this.getTextByUserId(textKey, { options: menuOptions });
    await this.callTracker.logConversationStep(
      this.call.callId,
      `${menuPrompt} [Options: ${menuOptions}]`,
      `${menuKey} (${selectedOption?.name || 'unknown'})`,
      'menu_selection'
    );

    return selectedOption;
  }

  protected async askConfirmation(textKey: string, values: TextParams = {}, yesTextKey?: string, noTextKey?: string, yesValue = '1', noValue = '2') {
    this.logger.log(`Asking for confirmation with message: ${textKey}`);

    const yes = await this.getTextByUserId(yesTextKey || 'GENERAL.YES', values);
    const no = await this.getTextByUserId(noTextKey || 'GENERAL.NO', values);
    const confirmationPrompt = await this.getTextByUserId(textKey, { ...values, yes, no });
    await this.callTracker.logConversationStep(this.call.callId, `${confirmationPrompt} [${yesValue}: ${yes}, ${noValue}: ${no}]`, undefined, 'ask_confirmation');

    const confirmationKey = await this.askForInputByKey(textKey, { ...values, yes, no }, {
      min_digits: 1,
      max_digits: 1,
      digits_allowed: [yesValue, noValue],
    });

    const confirmed = confirmationKey === yesValue;
    const responseText = confirmed ? yes : no;
    await this.callTracker.logConversationStep(
      this.call.callId,
      `${confirmationPrompt} [${yesValue}: ${yes}, ${noValue}: ${no}]`,
      `${confirmationKey} (${responseText})`,
      'confirmation_result'
    );

    return confirmed;
  }
}
