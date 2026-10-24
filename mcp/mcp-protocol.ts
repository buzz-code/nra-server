import { Logger } from '@nestjs/common';
import { McpTool, McpToolContext, McpToolError } from './mcp.types';

/** Newest first; the newest is answered when the client asks for one we don't know. */
export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const logger = new Logger('Mcp');

const result = (id: unknown, value: unknown) => ({ jsonrpc: '2.0', id, result: value });
const error = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });

/**
 * Answers one JSON-RPC message of the MCP tools subset (initialize, ping, tools/list, tools/call).
 * Returns null for notifications, which get no response.
 * Hand-rolled instead of @modelcontextprotocol/sdk: the SDK's typings need TypeScript 5, the apps run 4.8.
 */
export async function handleMcpMessage(message: any, tools: McpTool[], ctx: McpToolContext): Promise<object | null> {
  const id = message?.id ?? null;
  if (message?.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return error(id, -32600, 'Invalid Request');
  }
  if (message.id === undefined) {
    return null;
  }

  switch (message.method) {
    case 'initialize': {
      const requested = message.params?.protocolVersion;
      return result(id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'nra-stats', version: '1.0.0' },
      });
    }
    case 'ping':
      return result(id, {});
    case 'tools/list':
      return result(id, {
        tools: tools.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
          annotations: { readOnlyHint: true },
        })),
      });
    case 'tools/call': {
      const tool = tools.find((t) => t.name === message.params?.name);
      if (!tool) {
        return error(id, -32602, `Unknown tool: ${message.params?.name}`);
      }
      try {
        const output = await tool.handler(message.params?.arguments ?? {}, ctx);
        return result(id, { content: [{ type: 'text', text: JSON.stringify(output) }], isError: false });
      } catch (e) {
        if (!(e instanceof McpToolError)) {
          logger.error(`Tool ${tool.name} failed for user ${ctx.userId}`, e?.stack);
        }
        const text = e instanceof McpToolError ? e.message : 'Internal error';
        return result(id, { content: [{ type: 'text', text }], isError: true });
      }
    }
    default:
      return error(id, -32601, `Method not found: ${message.method}`);
  }
}
