import { Request } from 'express';

export interface IAuthenticatedUser {
    id: number;
    email: string;
    name: string;
    permissions: Record<string, boolean>;
    effective_id?: number;
    impersonated?: boolean;
}

export interface AuthenticatedRequest extends Request {
    user: IAuthenticatedUser;
}

declare global {
    namespace Express {
        interface User extends IAuthenticatedUser {}
    }
}
