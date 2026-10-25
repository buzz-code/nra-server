import { Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpTool, McpToolContext, McpToolError } from './mcp.types';

const logger = new Logger('Mcp');

/** One server per request (stateless transport); each tool runs as `ctx.userId`. */
export function buildMcpServer(tools: McpTool[], ctx: McpToolContext): McpServer {
  const server = new McpServer({ name: 'nra-stats', version: '1.0.0' });
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema, annotations: { readOnlyHint: true } },
      async (input: any) => {
        try {
          const output = await tool.handler(input ?? {}, ctx);
          return { content: [{ type: 'text' as const, text: JSON.stringify(output) }] };
        } catch (e) {
          if (!(e instanceof McpToolError)) {
            logger.error(`Tool ${tool.name} failed for user ${ctx.userId}`, e?.stack);
          }
          const text = e instanceof McpToolError ? e.message : 'Internal error';
          return { content: [{ type: 'text' as const, text }], isError: true };
        }
      },
    );
  }
  return server;
}
