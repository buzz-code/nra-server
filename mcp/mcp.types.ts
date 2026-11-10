import { ZodRawShape } from 'zod';
import { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

/** DI token collecting all registered MCP tools (multi-provider). */
export const MCP_TOOL = 'MCP_TOOL';

/** DI token for the app's server instructions, sent to every client on connect. */
export const MCP_INSTRUCTIONS = 'MCP_INSTRUCTIONS';

/** DI token for what the login page and OAuth metadata say the connection gives access to. */
export const MCP_CONSENT = 'MCP_CONSENT';

/** What a user grants when connecting an AI app. Defaults to read access to usage statistics. */
export interface McpConsent {
  /** Resource name in the OAuth protected-resource metadata (English). */
  resourceName: string;
  /** Sentence on the login page after the app name, e.g. "מבקש גישת קריאה לסטטיסטיקות השימוש שלך." */
  description: string;
}

export const DEFAULT_MCP_CONSENT: McpConsent = {
  resourceName: 'Usage statistics',
  description: 'מבקש גישת קריאה לסטטיסטיקות השימוש שלך.',
};

/** Who the call runs as. Always one real, non-admin user — set by shared code, never by a tool. */
export interface McpToolContext {
  userId: number;
  /** The server URL the client called (e.g. https://api.example.com), for links a tool returns. */
  baseUrl?: string;
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

/**
 * A prompt template on `/mcp` (prompts/list): a ready-made request the user picks in the AI app
 * (often as a slash command). `build` turns the user's arguments into the message sent to the model.
 * MCP prompt arguments are strings; mark optional ones with `.optional()`.
 */
export interface McpPrompt<Shape extends ZodRawShape = ZodRawShape> {
  name: string;
  title?: string;
  description: string;
  argsSchema?: Shape;
  build(args: Record<string, string | undefined>): string;
}

/** DI token for the app's MCP prompts. */
export const MCP_PROMPTS = 'MCP_PROMPTS';

/** An error whose message is shown to the user (nothing found, no active game). Other errors are hidden. */
export class McpToolError extends Error {}
