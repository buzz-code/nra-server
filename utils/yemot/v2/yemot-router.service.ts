import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as express from 'express';
import { Call, TapOptions, YemotRouter } from 'yemot-router2';
import { User } from '@shared/entities/User.entity';
import { TextByUser, getTextByUserCacheId } from '@shared/view-entities/TextByUser.entity';
import { cacheTTL } from '@shared/config/database.config';
import { YemotCallTrackingService } from './yemot-call-tracking.service';
import { YEMOT_LEGACY_ROUTE_EXPIRED_MESSAGE, isPastYemotLegacyRouteDeadline } from '../yemot-legacy-route.util';

const logger = new Logger('YemotRouterService');

export const YEMOT_HANDLER_FACTORY = 'YemotHandlerFactory';
export type YemotHandlerFactory = new (dataSource: DataSource, call: Call, callTracker: YemotCallTrackingService) => BaseYemotHandlerService;
type TextParams = Record<string, string | number>;
type MessageObj = { type: 'text' | 'file'; data: string };
export type ContentData = { value?: string | null; filepath?: string | null };

// The `:secret` path segment is only present on the /yemot/handle-call/:secret
// mount (see setupYemotRouter) - yemot-router2 keeps call.req pointed at the
// current request, so this is available with no extra bookkeeping.
function getWebhookSecret(call: Call): string | undefined {
  return (call.req?.params as Record<string, string>)?.secret;
}

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
      if (!getWebhookSecret(call) && isPastYemotLegacyRouteDeadline()) {
        call.id_list_message([{ type: 'text', data: YEMOT_LEGACY_ROUTE_EXPIRED_MESSAGE }]);
        call.hangup();
        return;
      }

      const yemotHandlerService = new this.yemotHandlerFactory(this.dataSource, call, this.callTrackingService);
      await yemotHandlerService.processCall();
    });

    return router;
  }

  private getExpressRouter(): express.Router {
    // mergeParams: nested routers reset req.params by default, which would
    // drop the :secret from the /yemot/handle-call/:secret mount.
    const router = express.Router({ mergeParams: true });
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
      mergeParams: true,
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
    await this.syncYemotUrlMigrationStatus();
  }

  // Re-derives yemotUrlMigrated from the actual request each call, so a
  // stale/false client confirmation self-corrects on the next real call.
  private async syncYemotUrlMigrationStatus() {
    const secret = getWebhookSecret(this.call);
    const isSecuredCall = Boolean(secret) && secret === this.user.additionalData?.yemotWebhookToken;
    const wasMarkedMigrated = Boolean(this.user.additionalData?.yemotUrlMigrated);
    if (isSecuredCall === wasMarkedMigrated) return;

    this.user.additionalData = { ...this.user.additionalData, yemotUrlMigrated: isSecuredCall };
    await this.dataSource.getRepository(User).update(this.user.id, { additionalData: this.user.additionalData });
  }

  protected async getTextDataByUserId(textKey: string, values?: TextParams): Promise<{ value: string; filepath: string | null }> {
    this.logger.log(`Getting text data for user ID: ${this.user.id}, text key: ${textKey}`);
    const text = await this.dataSource
      .getRepository(TextByUser)
      .findOne({
        where: { userId: this.user.id, name: textKey },
        cache: { id: getTextByUserCacheId(this.user.id, textKey), milliseconds: cacheTTL }
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

  private buildMessageFromContent(content: ContentData): MessageObj {
    if (content?.filepath?.trim()) return { type: 'file', data: content.filepath };
    return { type: 'text', data: content?.value || '' };
  }

  private prepareMessages(msgObj: MessageObj): { messages: MessageObj[]; text: string } {
    if (msgObj.type !== 'text') {
      return { messages: [msgObj], text: `[${msgObj.type}: ${msgObj.data}]` };
    }
    const lines = msgObj.data.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const messages = (lines.length ? lines : ['']).map((data) => ({ type: 'text' as const, data }));
    return { messages, text: msgObj.data };
  }

  // Strips a "<digit> - " lead-in (e.g. "הקישי 1 - כן" -> "כן") using the digit we
  // already know, rather than guessing at the instruction wording around it.
  private stripDigitPrefix(text: string, digit: string): string {
    const marker = `${digit} - `;
    const index = text.indexOf(marker);
    return index === -1 ? text.trim() : text.slice(index + marker.length).trim();
  }

  private async dispatchSend(msgObj: MessageObj) {
    const { messages, text } = this.prepareMessages(msgObj);
    this.logger.log(`Sending: ${text}`);
    await this.callTracker.logConversationStep(this.call.callId, text, undefined, 'send_message');
    return this.call.id_list_message(messages, { prependToNextAction: true });
  }

  // skipLogging: askConfirmation/askForMenu already log their own ask/result pair for this exchange.
  private async dispatchRead(msgObj: MessageObj, options?: TapOptions, skipLogging = false): Promise<string> {
    const { messages, text } = this.prepareMessages(msgObj);
    this.logger.log(`Asking for input from: ${text}`);
    if (!skipLogging) {
      await this.callTracker.logConversationStep(this.call.callId, text, undefined, 'ask_input');
    }
    const input = await this.call.read(messages, 'tap', options);
    if (!skipLogging) {
      await this.callTracker.logConversationStep(this.call.callId, text, input, 'user_input');
    }
    return input;
  }

  private async dispatchHangup(msgObj: MessageObj): Promise<void> {
    const { messages, text } = this.prepareMessages(msgObj);
    this.logger.log(`Hanging up with: ${text}`);
    await this.callTracker.logConversationStep(this.call.callId, text, undefined, 'hangup_message');
    this.call.id_list_message(messages, { prependToNextAction: true });
    this.call.hangup();
  }

  // ── String-based methods (plain text) ───────────────────────────────────

  protected hangupWithMessage(message: string) {
    return this.dispatchHangup({ type: 'text', data: message });
  }

  protected askForInput(message: string, options?: TapOptions) {
    return this.dispatchRead({ type: 'text', data: message }, options);
  }

  protected sendMessage(message: string) {
    return this.dispatchSend({ type: 'text', data: message });
  }

  // ── Text-key-based methods (lookup via TextByUser view) ──────────────────

  protected async hangupWithMessageByKey(textKey: string, values?: TextParams) {
    return this.dispatchHangup(await this.getMessageByKey(textKey, values));
  }

  protected async askForInputByKey(textKey: string, values?: TextParams, options?: TapOptions, skipLogging = false) {
    return this.dispatchRead(await this.getMessageByKey(textKey, values), options, skipLogging);
  }

  protected async sendMessageByKey(textKey: string, values?: TextParams) {
    return this.dispatchSend(await this.getMessageByKey(textKey, values));
  }

  private async getMessageByKey(textKey: string, values?: TextParams): Promise<MessageObj> {
    const textData = await this.getTextDataByUserId(textKey, values);
    if (textData.filepath && textData.filepath.trim()) {
      return { type: 'file', data: textData.filepath };
    }
    return { type: 'text', data: textData.value };
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
    }, true);

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
    await this.callTracker.logConversationStep(this.call.callId, confirmationPrompt, undefined, 'ask_confirmation');

    const confirmationKey = await this.askForInputByKey(textKey, { ...values, yes, no }, {
      min_digits: 1,
      max_digits: 1,
      digits_allowed: [yesValue, noValue],
    }, true);

    const confirmed = confirmationKey === yesValue;
    const responseText = this.stripDigitPrefix(confirmed ? yes : no, confirmed ? yesValue : noValue);
    await this.callTracker.logConversationStep(
      this.call.callId,
      confirmationPrompt,
      `${confirmationKey} (${responseText})`,
      'confirmation_result'
    );

    return confirmed;
  }
}
