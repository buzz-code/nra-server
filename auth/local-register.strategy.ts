
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request } from 'express';

@Injectable()
export class LocalRegisterStrategy extends Strategy {
    constructor(private authService: AuthService) {
        super({ passReqToCallback: true },
            (req, username, password, done) =>
                this.validate(req, username, password)
                    .then(res => done(null, res))
                    .catch(err => done(err))
        );
    }

    async validate(req: Request, username: string, password: string): Promise<any> {
        const user = await this.authService.registerUser(username, password, req.body.userInfo);
        return user;
    }
}

export default PassportStrategy(LocalRegisterStrategy, 'local-register');
