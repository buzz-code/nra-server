import { CallHandler, YemotRouter } from 'yemot-router2';
import { Logger } from '@nestjs/common';
import * as express from 'express';

const logger = new Logger('YemotHandler');

export type YemotCallHandler = (logger: Logger) => CallHandler;

export const setupYemotRouter = (callHandler: YemotCallHandler) => {
  const router = express.Router();
  router.use(express.urlencoded({ extended: true }));

  const yemotRouter = YemotRouter({
    printLog: true,
    uncaughtErrorHandler: (error, call) => {
      logger.error(`Uncaught error from ${call.phone}. Error: ${error.stack}`);
      return call.id_list_message([{ type: 'text', data: 'אירעה שגיאה' }]);
    }
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
