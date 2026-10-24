import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@shared/entities/User.entity';
import { McpController } from './mcp.controller';
import { McpTokenService } from './mcp-token.service';
import { MCP_TOOL, McpTool } from './mcp.types';

export interface McpModuleOptions {
  tools: Type<McpTool>[];
}

/** Read-only MCP endpoint at `/mcp`. Registered by `BaseNraAppModule` only when the app passes `mcpTools`. */
@Module({})
export class McpModule {
  static forRoot(options: McpModuleOptions): DynamicModule {
    const toolAggregator: Provider = {
      provide: MCP_TOOL,
      useFactory: (...tools: McpTool[]) => tools,
      inject: options.tools,
    };

    return {
      module: McpModule,
      imports: [TypeOrmModule.forFeature([User])],
      controllers: [McpController],
      providers: [McpTokenService, ...options.tools, toolAggregator],
    };
  }
}
