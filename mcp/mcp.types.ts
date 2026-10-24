/** DI token collecting all registered MCP tools (multi-provider). */
export const MCP_TOOL = 'MCP_TOOL';

/** Who the call runs as. Always one real, non-admin user — set by shared code, never by a tool. */
export interface McpToolContext {
  userId: number;
}

/**
 * A read-only tool exposed on `/mcp`. Projects register tool classes via
 * `BaseNraAppModule.forRoot({ mcpTools })`; the handler's result is returned to the client as JSON.
 * `inputSchema` is a JSON Schema object; the handler validates its own input and throws
 * `McpToolError` for anything the user should read.
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler(input: Record<string, any>, ctx: McpToolContext): Promise<unknown>;
}

/** An error whose message is shown to the user (bad input, nothing found). Other errors are hidden. */
export class McpToolError extends Error {}
