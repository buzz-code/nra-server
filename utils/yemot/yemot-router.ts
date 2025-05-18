import { Call, ExitError, YemotRouter } from 'yemot-router2';
import { Logger } from '@nestjs/common';
import * as express from 'express';
import { createBaseExtendedCall } from './base-extended-call';
import { DataSource } from 'typeorm';

Logger.overrideLogger(['error', 'warn', 'log', 'debug', 'verbose']);
const logger = new Logger('YemotHandler');

type CallHandler = (call: Call) => Promise<unknown>;
export type YemotCallHandler = CallHandler;
export type YemotCallProcessor = (call: Call) => Promise<void>;

export const setupYemotRouter = (
  callHandler: YemotCallHandler = exampleYemotHandler,
  processCall: YemotCallProcessor = exampleYemotProcessor,
  dataSource: DataSource,
  messageConstants: any = {}
) => {
  const router = express.Router();
  router.use(express.urlencoded({ extended: true }));

  const yemotRouter = YemotRouter({
    printLog: true,
    timeout: 5 * 60 * 1000,
    uncaughtErrorHandler: (error, call) => {
      logger.error(`Uncaught error from ${call.phone}. Error: ${error.stack}`);
      return id_list_message_with_hangup(call, 'אירעה שגיאה, אנא נסה שוב מאוחר יותר');
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

  router.use('/', yemotRouter.asExpressRouter);

  yemotRouter.all('/', async (call) => {
    try {
      const enhancedCall = createBaseExtendedCall(call, logger, dataSource, messageConstants);
      logger.log(`Enhanced call created with data source for ${call.callId}`);

      await callHandler(enhancedCall);
    } catch (error) {
      if (error instanceof ExitError) return;
      logger.error(`Error in call handler: ${error.message}`, error.stack);
      return id_list_message_with_hangup(call, 'אירעה שגיאה, אנא נסה שוב מאוחר יותר');
    }
    yemotRouter.deleteCall(call.callId);
    await processCall?.(call);
  });

  yemotRouter.events.on('call_hangup', (call) => {
    logger.log(`Call ${call.callId} was hungup - Phone: ${call.phone}`);
  });
  yemotRouter.events.on('call_continue', (call) => {
    logger.log(`Call ${call.callId} continues - Phone: ${call.phone}`);
  });
  yemotRouter.events.on('new_call', (call) => {
    logger.log(`New call ${call.callId} from ${call.phone}`);
  });

  return router;
}

export const id_list_message = (call: Call, message: string) => {
  call.id_list_message([{ type: 'text', data: message }], { prependToNextAction: true });
}
export const id_list_message_with_hangup = (call: Call, message: string) => {
  call.id_list_message([{ type: 'text', data: message }], { prependToNextAction: true });
  call.hangup();
}

const exampleYemotHandler: YemotCallHandler = async (call) => {
  call.logInfo(`Handling call from ${call.phone}`);

  // Example flow from the yemot-router2 example
  await call.read([{ type: 'text', data: 'היי, תקיש 10' }], 'tap', {
    max_digits: 2,
    min_digits: 2,
    digits_allowed: ['10']
  });

  const name = await call.read([{ type: 'text', data: 'שלום, אנא הקש את שמך המלא' }], 'tap', {
    typing_playback_mode: 'HebrewKeyboard'
  });
  call.logInfo(`User entered name: ${name}`);

  id_list_message(call, 'שלום ' + name);
  const addressFilePath = await call.read([{ type: 'text', data: 'אנא הקלט את הרחוב בו אתה גר' }], 'record');
  call.logInfo(`Address file path: ${addressFilePath}`);

  return id_list_message_with_hangup(call, 'תגובתך התקבלה בהצלחה');
};


const exampleYemotProcessor: YemotCallProcessor = async (call) => {
  call.logInfo(`Processing call ${call.callId} from ${call.phone}`);
  // Here you can add any additional processing logic you need
  // For example, saving the call data to a database or sending a notification
  // await saveCallDataToDatabase(call);
  // await sendNotification(call);
};
