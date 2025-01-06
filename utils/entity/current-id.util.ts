import { Request } from "express";
import { RequestContext } from "nestjs-request-context";

export function getCurrentId() {
    const req = RequestContext.currentContext?.req as Request;
    return req?.params?.id;
}