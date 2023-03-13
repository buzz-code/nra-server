import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalRegisterAuthGuard extends AuthGuard('local-register') {}
