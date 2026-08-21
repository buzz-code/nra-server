import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Assigns a request id (reusing an incoming X-Request-Id if the caller sent one,
 * otherwise generating a uuid) and echoes it back as a response header, so a
 * client-visible error can be correlated with the exact backend request.
 *
 * Runs before nestjs-pino's own middleware (registered here via app.use(), which
 * lands earlier in the middleware stack than module-configured middleware), and
 * pino.config's genReqId reuses req.id so every log line for the request carries
 * the same id.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers[REQUEST_ID_HEADER] as string) || randomUUID();
  (req as Request & { id?: string }).id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
