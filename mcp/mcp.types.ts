import { ZodRawShape } from 'zod';

/** DI token collecting all registered MCP tools (multi-provider). */
export const MCP_TOOL = 'MCP_TOOL';

/** Who the call runs as. Always one real, non-admin user — set by shared code, never by a tool. */
export interface McpToolContext {
  userId: number;
}

/**
 * A read-only tool exposed on `/mcp`. Projects register tool classes via
 * `BaseNraAppModule.forRoot({ mcpTools })`; the handler's result is returned to the client as JSON.
 * Input is validated against `inputSchema` (zod) before the handler runs.
 */
export interface McpTool<Shape extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  inputSchema: Shape;
  handler(input: any, ctx: McpToolContext): Promise<unknown>;
}

/** An error whose message is shown to the user (nothing found, no active game). Other errors are hidden. */
export class McpToolError extends Error {}
