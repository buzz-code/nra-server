import { AuthenticatedRequest } from "@shared/auth/auth.types";
import { RequestContext } from "nestjs-request-context";

export function getCurrentUser() {
    const req = RequestContext.currentContext?.req as AuthenticatedRequest;
    return req?.user;
}
