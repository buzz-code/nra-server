import { DynamicModule, MiddlewareConsumer, Module, NestModule, Provider, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@shared/entities/User.entity';
import { McpController } from './mcp.controller';
import { DEFAULT_MCP_CONSENT, MCP_CONSENT, MCP_INSTRUCTIONS, MCP_PROMPTS, MCP_TOOL, McpConsent, McpPrompt, McpTool } from './mcp.types';
import { McpOAuthProvider } from './oauth/mcp-oauth.provider';
import { McpOAuthController } from './oauth/mcp-oauth.controller';
import { McpAuthMiddleware } from './oauth/mcp-auth.middleware';

export interface McpModuleOptions {
  tools: Type<McpTool>[];
  /** Sent to every client on connect: what the app is and how to use its tools. */
  instructions?: string;
  /** Prompt templates the user can pick in the AI app. */
  prompts?: McpPrompt[];
  /** What the login page says the connection gives access to. Defaults to read access to usage statistics. */
  consent?: McpConsent;
}

/**
 * MCP endpoint at `/mcp`, with its own OAuth login, so a client only needs the URL.
 * Registered by `BaseNraAppModule` only when the app passes `mcpTools`.
 */
@Module({})
export class McpModule implements NestModule {
  static forRoot(options: McpModuleOptions): DynamicModule {
    const toolAggregator: Provider = {
      provide: MCP_TOOL,
      useFactory: (...tools: McpTool[]) => tools,
      inject: options.tools,
    };

    return {
      module: McpModule,
      imports: [TypeOrmModule.forFeature([User])],
      controllers: [McpController, McpOAuthController],
      providers: [
        McpOAuthProvider,
        McpAuthMiddleware,
        ...options.tools,
        toolAggregator,
        { provide: MCP_INSTRUCTIONS, useValue: options.instructions ?? null },
        { provide: MCP_PROMPTS, useValue: options.prompts ?? [] },
        { provide: MCP_CONSENT, useValue: options.consent ?? DEFAULT_MCP_CONSENT },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(McpAuthMiddleware).forRoutes('*');
  }
}
