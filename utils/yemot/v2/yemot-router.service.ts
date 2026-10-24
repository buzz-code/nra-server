import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as express from 'express';
import { JwtService } from '@nestjs/jwt';
import { Call, CallError, TapOptions, YemotRouter } from 'yemot-router2';
import { User } from '@shared/entities/User.entity';
import { TextByUser, getTextByUserCacheId } from '@shared/view-entities/TextByUser.entity';
import { cacheTTL } from '@shared/config/database.config';
import { YemotCallTrackingService } from './yemot-call-tracking.service';
import { CallSuspended, enableReplay, getReplayState, isReplaying } from './yemot-replay';
import { YEMOT_LEGACY_ROUTE_EXPIRED_MESSAGE, isPastYemotLegacyRouteDeadline } from '../yemot-legacy-route.util';
import { jwtConstants } from '@shared/auth/constants';
import { jwtFromRequest } from '@shared/auth/jwt.strategy';
import { getUserIdFromUser } from '@shared/auth/auth.util';
import { hasPermission, isAdmin, permissionKeys } from '@shared/utils/permissionsUtil';

const logger = new Logger('YemotRouterService');

export const YEMOT_HANDLER_FACTORY = 'YemotHandlerFactory';
// A handler class with `static stateless = true` runs in stateless replay mode (see
// yemot-replay.ts) and is safe behind several server nodes; others keep each call
// suspended in this process's memory between Yemot requests.
export type YemotHandlerFactory = (new (dataSource: DataSource, call: Call, callTracker: YemotCallTrackingService) => BaseYemotHandlerService) & { stateless?: boolean };
type TextParams = Record<string, string | number>;
type MessageObj = { type: 'text' | 'file'; data: string };
export type ContentData = { value?: string | null; filepath?: string | null };

// The `:secret` path segment is only present on the /yemot/handle-call/:secret
// mount (see setupYemotRouter) - yemot-router2 keeps call.req pointed at the
// current request, so this is available with no extra bookkeeping.
function getWebhookSecret(call: Call): string | undefined {
  return (call.req?.params as Record<string, string>)?.secret;
}

// Set by getSimulatorAuthMiddleware on every request of the /yemot/simulate mount.
const SIMULATION_FLAG = 'isYemotSimulation';

function isSimulation(call: Call): boolean {
  return Boolean((call.req as any)?.[SIMULATION_FLAG]);
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
    router.use('/', yemotRouter.asExpressRouter);

    yemotRouter.all('/', async (call: Call) => {
      if (!getWebhookSecret(call) && !isSimulation(call) && isPastYemotLegacyRouteDeadline()) {
        call.id_list_message([{ type: 'text', data: YEMOT_LEGACY_ROUTE_EXPIRED_MESSAGE }]);
        call.hangup();
        return;
      }

      // Awaited so the call row exists before processCall() logs anything (was
      // fire-and-forget via 'new_call' below, which dropped the first ask/response).
      const yemotCallRecord = await this.callTrackingService.initializeCall(call);
      if (this.yemotHandlerFactory.stateless) {
        enableReplay(call, yemotRouter.events, yemotCallRecord?.createdAt);
      }

      let callEnded = true;
      try {
        const yemotHandlerService = new this.yemotHandlerFactory(this.dataSource, call, this.callTrackingService);
        await yemotHandlerService.processCall();
      } catch (e) {
        callEnded = !(e instanceof CallSuspended);
        throw e;
      } finally {
        if (callEnded) {
          await this.callTrackingService.finalizeCall(call.callId);
        }
        this.callTrackingService.releaseCall(call.callId);
      }
    });

    yemotRouter.events.on('call_hangup', async (call: Call) => {
      this.logger.log(`Call ${call.callId} was hungup - Phone: ${call.phone}`);
      if (this.yemotHandlerFactory.stateless) {
        await this.replayHangup(call, yemotRouter.events);
      }
      await this.callTrackingService.finalizeCall(call.callId);
      await this.callTrackingService.recordHangup(call.callId);
    });

    return router;
  }

  // Stateless calls aren't held in memory, so a hangup mid-call replays the call up to
  // the open read(), which throws HangupError - letting the handler's catch/finally run.
  // Skipped when the handler already finished (Yemot also sends hangup=yes after our hangup).
  private async replayHangup(call: Call, events: YemotRouterEvents): Promise<void> {
    try {
      if (!(await this.callTrackingService.isCallOpen(call.callId))) return;
      const yemotCallRecord = await this.callTrackingService.initializeCall(call);
      enableReplay(call, events, yemotCallRecord?.createdAt);
      const yemotHandlerService = new this.yemotHandlerFactory(this.dataSource, call, this.callTrackingService);
      await yemotHandlerService.processCall();
    } catch (e) {
      if (!(e instanceof CallError)) {
        this.logger.error(`Error replaying hungup call ${call.callId}: ${e.stack}`);
      }
    }
  }

  // Guards the in-app simulator mount with the site's JWT cookie. Admins may
  // simulate any system number; other users only their own (ApiDID must match
  // their phoneNumber). Runs on every request of the call, not just the first.
  getSimulatorAuthMiddleware(): express.RequestHandler {
    const jwtService = new JwtService({ secret: jwtConstants.secret });
    return async (req, res, next) => {
      let auth: any;
      try {
        auth = jwtService.verify(jwtFromRequest(req));
      } catch {
        return res.status(401).send('Unauthorized');
      }

      if (!isAdmin(auth)) {
        if (!hasPermission(auth, permissionKeys.yemotSimulator)) {
          return res.status(403).send('Forbidden');
        }
        const userId = getUserIdFromUser(auth);
        if (!userId) {
          return res.status(403).send('Forbidden');
        }
        try {
          const user = await this.dataSource.getRepository(User).findOneBy({ id: userId });
          if (!user?.phoneNumber || user.phoneNumber !== req.body?.ApiDID) {
            return res.status(403).send('Forbidden');
          }
        } catch (err) {
          return next(err);
        }
      }

      (req as any)[SIMULATION_FLAG] = true;
      next();
    };
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

  private getYemotRouter() {
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

    yemotRouter.events.on('call_continue', (call) => {
      this.logger.log(`Call ${call.callId} continues - Phone: ${call.phone}`);
    });
    yemotRouter.events.on('new_call', (call) => {
      this.logger.log(`New call ${call.callId} from ${call.phone}`);
    });

    return yemotRouter;
  }
}

type YemotRouterEvents = ReturnType<typeof YemotRouter>['events'];

export class BaseYemotHandlerService {
  protected readonly logger = logger;
  protected user: User;
  private readonly constructedAt = new Date();
  private onceCounts: Record<string, number> = {};

  constructor(
    @InjectDataSource() protected dataSource: DataSource,
    protected call: Call,
    protected callTracker: YemotCallTrackingService,
  ) { }

  // When the call started - the same value on every request of the call. Use it instead
  // of new Date() for anything that decides the call's flow. A fresh copy each time, so
  // callers may mutate it (e.g. setHours).
  protected get callStartedAt(): Date {
    return new Date(getReplayState(this.call)?.startedAt ?? this.constructedAt);
  }

  // Runs fn once per call and returns the same (JSON) result on every later request of
  // the call - for random values and mid-call DB writes. Keyed by name + call order, so
  // a loop may reuse the same key. Send messages outside fn: on later requests fn doesn't run.
  protected once<T>(key: string, fn: () => T | Promise<T>): Promise<T> {
    this.onceCounts[key] = (this.onceCounts[key] ?? 0) + 1;
    return this.callTracker.once(this.call.callId, `${key}#${this.onceCounts[key]}`, fn);
  }

  async processCall(): Promise<void> {
    // Default implementation (can be overridden)
    this.logger.log(`Processing call with ID: ${this.call.callId}`);
    await this.hangupWithMessage('Default handler: Call processing not implemented.');
  }

  protected async getUserByDidPhone() {
    this.logger.log(`Getting user by phone: ${this.call.did}`);
    const user = await this.dataSource.getRepository(User).findOne({ where: { phoneNumber: this.call.did } });
    if (!user) {
      const spokenDid = (this.call.did || '').split('').join(' ');
      return this.hangupWithMessage(`המערכת לא מחוברת, אנא פני למזכירות. מספר המערכת: ${spokenDid}`);
    }
    this.user = user;
    await this.syncYemotUrlMigrationStatus();
  }

  // Re-derives yemotUrlMigrated from the actual request each call, so a
  // stale/false client confirmation self-corrects on the next real call.
  // Simulator calls never go through ext.ini, so they say nothing about migration.
  private async syncYemotUrlMigrationStatus() {
    if (isSimulation(this.call)) return;
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

  // Steps re-run by a replayed request were logged by the request that first ran them.
  private async logStep(prompt: string, userResponse: string | undefined, stepType: string) {
    if (isReplaying(this.call)) return;
    await this.callTracker.logConversationStep(this.call.callId, prompt, userResponse, stepType);
  }

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
    await this.logStep(text, undefined, 'send_message');
    return this.call.id_list_message(messages, { prependToNextAction: true });
  }

  // skipLogging: askConfirmation/askForMenu already log their own ask/result pair for this exchange.
  private async dispatchRead(msgObj: MessageObj, options?: TapOptions, skipLogging = false): Promise<string> {
    const { messages, text } = this.prepareMessages(msgObj);
    this.logger.log(`Asking for input from: ${text}`);
    if (!skipLogging) {
      await this.logStep(text, undefined, 'ask_input');
    }
    const input = await this.call.read(messages, 'tap', options);
    if (!skipLogging) {
      await this.logStep(text, input, 'user_input');
    }
    return input;
  }

  private async dispatchHangup(msgObj: MessageObj): Promise<void> {
    const { messages, text } = this.prepareMessages(msgObj);
    this.logger.log(`Hanging up with: ${text}`);
    await this.logStep(text, undefined, 'hangup_message');
    // Closed before the response goes out, so Yemot's hangup=yes request that follows
    // never replays a finished call (see replayHangup).
    await this.callTracker.finalizeCall(this.call.callId);
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
    await this.logStep(
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
    await this.logStep(confirmationPrompt, undefined, 'ask_confirmation');

    const confirmationKey = await this.askForInputByKey(textKey, { ...values, yes, no }, {
      min_digits: 1,
      max_digits: 1,
      digits_allowed: [yesValue, noValue],
    }, true);

    const confirmed = confirmationKey === yesValue;
    const responseText = this.stripDigitPrefix(confirmed ? yes : no, confirmed ? yesValue : noValue);
    await this.logStep(
      confirmationPrompt,
      `${confirmationKey} (${responseText})`,
      'confirmation_result'
    );

    return confirmed;
  }
}
