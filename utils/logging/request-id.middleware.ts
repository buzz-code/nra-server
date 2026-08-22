import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers[REQUEST_ID_HEADER] as string) || randomUUID();
  req.id = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
