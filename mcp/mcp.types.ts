import { ZodRawShape } from 'zod';
import { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

/** DI token collecting all registered MCP tools (multi-provider). */
export const MCP_TOOL = 'MCP_TOOL';

/** DI token for the app's server instructions, sent to every client on connect. */
export const MCP_INSTRUCTIONS = 'MCP_INSTRUCTIONS';

/** Who the call runs as. Always one real, non-admin user — set by shared code, never by a tool. */
export interface McpToolContext {
  userId: number;
}

/**
 * A tool exposed on `/mcp`. Projects register tool classes via
 * `BaseNraAppModule.forRoot({ mcpTools })`; the handler's result is returned to the client as JSON.
 * Input is validated against `inputSchema` (zod) before the handler runs.
 */
export interface McpTool<Shape extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  inputSchema: Shape;
  /** Hints for the client (e.g. a tool that writes or deletes). Defaults to read-only. */
  annotations?: ToolAnnotations;
  handler(input: any, ctx: McpToolContext): Promise<unknown>;
}

/** An error whose message is shown to the user (nothing found, no active game). Other errors are hidden. */
export class McpToolError extends Error {}
