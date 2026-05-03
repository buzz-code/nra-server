import { DynamicModule, Module, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestContextModule } from 'nestjs-request-context';
import { LoggerModule } from 'nestjs-pino';
import { typeOrmModuleConfig } from '@shared/config/typeorm.config';
import { AuthModule } from '@shared/auth/auth.module';
import { DefaultUserInitModule } from '@shared/auth/default-user-init.module';
import { YemotModule } from '@shared/utils/yemot/v2/yemot.module';
import { YemotHandlerFactory } from '@shared/utils/yemot/v2/yemot-router.service';
import { MailSendModule } from '@shared/utils/mail/mail-send.module';
import { getPinoConfig } from '@shared/config/pino.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

const DEFAULT_THROTTLER_LIMIT = 2000;

export interface BaseNraAppModuleOptions {
  entitiesModule: Type<any>;
  yemotHandlerService: YemotHandlerFactory;
  userInitModule?: Type<any> | DynamicModule;
  throttlerLimit?: number;
}

@Module({})
export class BaseNraAppModule {
  static forRoot(options: BaseNraAppModuleOptions): DynamicModule {
    const userInitModule = options.userInitModule ?? DefaultUserInitModule;
    const throttlerLimit = options.throttlerLimit ?? DEFAULT_THROTTLER_LIMIT;

    return {
      module: BaseNraAppModule,
      imports: [
        RequestContextModule,
        LoggerModule.forRoot(getPinoConfig(process.env.NODE_ENV === 'development')),
        ThrottlerModule.forRoot({ ttl: 5, limit: throttlerLimit }),
        TypeOrmModule.forRoot(typeOrmModuleConfig),
        MailSendModule,
        options.entitiesModule,
        AuthModule.forRoot({ userInitModule }),
        YemotModule.register(options.yemotHandlerService),
      ],
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    };
  }
}
