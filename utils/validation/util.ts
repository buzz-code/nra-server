import { RequestContext } from "nestjs-request-context";

export function getCurrentUser() {
    const req = RequestContext.currentContext.req;
    return req.user;
}
