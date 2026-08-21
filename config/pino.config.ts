import pino from 'pino';
import { Params } from 'nestjs-pino';

const pinoLocalTransport = {
    target: 'pino-pretty',
    options: {
        colorize: true,
        ignore: 'pid,hostname',
    },
};

export const getPinoConfig = (isDevelopment: boolean): Params => ({
    pinoHttp: {
        timestamp: pino.stdTimeFunctions.isoTime,
        transport: isDevelopment ? pinoLocalTransport : undefined,
        // requestIdMiddleware (bootstrap.util.ts) assigns req.id before this runs -
        // reuse it so every log line for a request shares the same id.
        genReqId: (req: any) => req.id,
    },
});
