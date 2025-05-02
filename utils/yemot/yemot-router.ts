import { Call, CallHandler, YemotRouter } from 'yemot-router2';
import { Logger } from '@nestjs/common';
import * as express from 'express';

const logger = new Logger('YemotHandler');

export type YemotCallHandler = (logger: Logger) => CallHandler;

export const setupYemotRouter = (callHandler: YemotCallHandler) => {
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

  yemotRouter.all('/', callHandler(logger));

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