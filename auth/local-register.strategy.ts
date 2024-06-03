
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request } from 'express';

export function validate(authService: AuthService, req: Request, username: string, password: string): Promise<any> {
    return authService.registerUser(username, password, req.body.userInfo);
}

export function verify(authService: AuthService, req: Request, username: string, password: string, done: (error: any, user?: any, options?: any) => void): Promise<void> {
    return validate(authService, req, username, password)
        .then(res => done(null, res))
        .catch(err => done(err));
}

@Injectable()
export class LocalRegisterStrategy extends Strategy {
    constructor(private authService: AuthService) {
        super({ passReqToCallback: true }, verify.bind(null, authService));
    }
}

export default PassportStrategy(LocalRegisterStrategy, 'local-register');
