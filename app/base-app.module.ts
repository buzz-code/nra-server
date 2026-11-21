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
import { S3Module } from '@shared/utils/s3/s3.module';
import { JobsModule } from '@shared/utils/jobs/jobs.module';
import { JobHandler } from '@shared/utils/jobs/job.types';
import { McpModule } from '@shared/mcp/mcp.module';
import { McpConsent, McpPrompt, McpTool } from '@shared/mcp/mcp.types';
import { getPinoConfig } from '@shared/config/pino.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

const DEFAULT_THROTTLER_LIMIT = 2000;

export interface BaseNraAppModuleOptions {
  entitiesModule: Type<any>;
  yemotHandlerService: YemotHandlerFactory;
  userInitModule?: Type<any> | DynamicModule;
  throttlerLimit?: number;
  /** Project-specific async job handlers, registered alongside the shared ones. */
  jobHandlers?: Type<JobHandler>[];
  /** Project-specific controllers, registered next to the shared `AppController`. */
  controllers?: Type<any>[];
  /** MCP tools; when given, the app serves them at `/mcp`. */
  mcpTools?: Type<McpTool>[];
  /** MCP server instructions: what the app is and how its tools fit together. */
  mcpInstructions?: string;
  /** MCP prompt templates the user can pick in the AI app. */
  mcpPrompts?: McpPrompt[];
  /** What the MCP login page says the connection gives access to. Defaults to read access to usage statistics. */
  mcpConsent?: McpConsent;
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
        S3Module,
        JobsModule.forRoot({ handlers: options.jobHandlers }),
        options.entitiesModule,
        AuthModule.forRoot({ userInitModule }),
        YemotModule.register(options.yemotHandlerService),
        ...(options.mcpTools?.length ? [McpModule.forRoot({ tools: options.mcpTools, instructions: options.mcpInstructions, prompts: options.mcpPrompts, consent: options.mcpConsent })] : []),
      ],
      controllers: [AppController, ...(options.controllers ?? [])],
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
