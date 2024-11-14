import { YemotCall } from "@shared/entities/YemotCall.entity";

export class UnexpectedHangupException extends Error {
    isUnexpectedHangupException = true;
    constructor(call: YemotCall) {
        super(`Unexpected hangup ${call.id}, user: ${call.userId}`);
    }
}

export class UserNotFoundException extends Error {
    isUserNotFoundException = true;
    responseMessage = 'מספר הטלפון עדיין לא חובר למשתמש באתר יומנט';
    constructor(phoneNumber: string) {
        super(`User not found for phone number ${phoneNumber}`);
    }
}
