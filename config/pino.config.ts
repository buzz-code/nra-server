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
        genReqId: (req) => req.id,
        quietReqLogger: true,
        customLogLevel: (req, res, err) => {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
        },
    },
});
