import { Call, ExitError, YemotRouter } from 'yemot-router2';
import { Logger } from '@nestjs/common';
import * as express from 'express';

const logger = new Logger('YemotHandler');

type CallHandler = (call: Call) => Promise<unknown>;
export type YemotCallHandler = (logger: Logger) => CallHandler;
export type YemotCallProcessor = (call: Call, logger: Logger) => Promise<void>;

export const setupYemotRouter = (callHandler: YemotCallHandler, processCall: YemotCallProcessor = null) => {
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
    },
  });

  router.use('/', yemotRouter.asExpressRouter);

  const callHandlerWithLogger = callHandler(logger);
  yemotRouter.all('/', async (call) => {
    try {
      await callHandlerWithLogger(call);
    } catch (error) {
      if (error instanceof ExitError) return;
      logger.error(`Error in call handler: ${error.message}`, error.stack);
      return id_list_message_with_hangup(call, 'אירעה שגיאה, אנא נסה שוב מאוחר יותר');
    }
    yemotRouter.deleteCall(call.callId);
    await processCall?.(call, logger);
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