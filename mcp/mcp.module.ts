import { DynamicModule, MiddlewareConsumer, Module, NestModule, Provider, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@shared/entities/User.entity';
import { McpController } from './mcp.controller';
import { MCP_TOOL, McpTool } from './mcp.types';
import { McpOAuthProvider } from './oauth/mcp-oauth.provider';
import { McpOAuthController } from './oauth/mcp-oauth.controller';
import { McpAuthMiddleware } from './oauth/mcp-auth.middleware';

export interface McpModuleOptions {
  tools: Type<McpTool>[];
}

/**
 * Read-only MCP endpoint at `/mcp`, with its own OAuth login, so a client only needs the URL.
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
      providers: [McpOAuthProvider, McpAuthMiddleware, ...options.tools, toolAggregator],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(McpAuthMiddleware).forRoutes('*');
  }
}
