import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as express from 'express';
import { Call, TapOptions, YemotRouter } from 'yemot-router2';
import { User } from '@shared/entities/User.entity';
import { TextByUser } from '@shared/view-entities/TextByUser.entity';

const logger = new Logger('YemotRouterService');

export const YEMOT_HANDLER_FACTORY = 'YemotHandlerFactory';
export type YemotHandlerFactory = new (dataSource: DataSource, call: Call) => BaseYemotHandlerService;

@Injectable()
export class YemotRouterService {
  protected readonly logger = logger;

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @Inject(YEMOT_HANDLER_FACTORY) private yemotHandlerFactory: YemotHandlerFactory,
  ) { }

  getRouter(): express.Router {
    const router = this.getExpressRouter();
    const yemotRouter = this.getYemotRouter();
    router.use('/', yemotRouter);

    yemotRouter.all('/', async (call: Call) => {
      const yemotHandlerService = new this.yemotHandlerFactory(this.dataSource, call);
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

    yemotRouter.events.on('call_hangup', (call) => {
      this.logger.log(`Call ${call.callId} was hungup - Phone: ${call.phone}`);
    });
    yemotRouter.events.on('call_continue', (call) => {
      this.logger.log(`Call ${call.callId} continues - Phone: ${call.phone}`);
    });
    yemotRouter.events.on('new_call', (call) => {
      this.logger.log(`New call ${call.callId} from ${call.phone}`);
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
  ) { }

  async processCall(): Promise<void> {
    // Default implementation (can be overridden)
    this.logger.log(`Processing call with ID: ${this.call.callId}`);
    this.hangupWithMessage('Default handler: Call processing not implemented.');
  }

  protected async getUserByDidPhone() {
    this.logger.log(`Getting user by phone: ${this.call.did}`);
    const user = await this.dataSource.getRepository(User).findOne({ where: { phoneNumber: this.call.did } });
    if (!user) {
      this.hangupWithMessage('המערכת לא מחוברת, אנא פני למזכירות');
    }
    this.user = user;
  }

  protected async getTextByUserId(textKey: string, values?: Record<string, string>): Promise<string> {
    this.logger.log(`Getting text for user ID: ${this.user.id}, text key: ${textKey}`);
    const text = await this.dataSource
      .getRepository(TextByUser)
      .findOneBy({ userId: this.user.id, name: textKey });
    let textValue = text?.value || textKey;
    if (values) {
      Object.keys(values).forEach((key) => {
        textValue = textValue.replace(`{${key}}`, values[key]);
      });
    }
    return textValue;
  }

  protected hangupWithMessage(message: string) {
    this.logger.log(`Hanging up with message: ${message}`);
    this.call.id_list_message([{ type: 'text', data: message }], { prependToNextAction: true });
    this.call.hangup();
  }

  protected askForInput(message: string, options?: TapOptions) {
    this.logger.log(`Asking for input with message: ${message}`);
    return this.call.read([{ type: 'text', data: message }], 'tap', options);
  }

  protected sendMessage(message: string) {
    this.logger.log(`Sending message: ${message}`);
    return this.call.id_list_message([{ type: 'text', data: message }], { prependToNextAction: true });
  }

  protected async askForMenu<T extends { key: string | number, name: string }>(textKey: string, options: T[]) {
    this.logger.log(`Asking for menu with text key: ${textKey}`);

    const menuOptions = options.map(({ key, name }) => `${key} - ${name}`).join(', ');
    const message = await this.getTextByUserId(textKey, { options: menuOptions });
    this.logger.log(`Menu message: ${message}`);

    const menuKey = await this.askForInput(message, {
      min_digits: 1,
      max_digits: Math.max(...options.map((et) => et.key.toString().length)),
      digits_allowed: options.map((et) => et.key.toString()),
    });

    return options.find((et) => et.key.toString() === menuKey);
  }

  protected async askConfirmation(textKey: string, values: Record<string, string> = {}, yesTextKey?: string, noTextKey?: string, yesValue = '1', noValue = '2') {
    this.logger.log(`Asking for confirmation with message: ${textKey}`);

    const yes = await this.getTextByUserId(yesTextKey || 'GENERAL.YES', values);
    const no = await this.getTextByUserId(noTextKey || 'GENERAL.NO', values);
    const confirmationMessage = await this.getTextByUserId(textKey, { ...values, yes, no });
    this.logger.log(`Confirmation message: ${confirmationMessage}`);

    const confirmationKey = await this.askForInput(confirmationMessage, {
      min_digits: 1,
      max_digits: 1,
      digits_allowed: [yesValue, noValue],
    });

    return confirmationKey === yesValue;
  }
}