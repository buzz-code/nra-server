import { Body, Controller, Delete, Get, Inject, Optional, Post, Request, Res } from '@nestjs/common';
import { Request as ExpressRequest, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildMcpServer } from './mcp-server.factory';
import { MCP_INSTRUCTIONS, MCP_PROMPTS, MCP_TOOL, McpPrompt, McpTool } from './mcp.types';
import { McpOAuthProvider } from './oauth/mcp-oauth.provider';
import { mcpBaseUrl, resourceMetadataUrl } from './oauth/mcp-auth.middleware';
import { McpSupportService } from './support/mcp-support.service';

const methodNotAllowed = (res: Response) => res.status(405).setHeader('Allow', 'POST').json({ error: 'method not allowed' });

const bearerToken = (req: ExpressRequest) => /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1];

@Controller('mcp')
export class McpController {
  constructor(
    private readonly oauth: McpOAuthProvider,
    @Inject(MCP_TOOL) private readonly tools: McpTool[],
    private readonly support: McpSupportService,
    @Optional() @Inject(MCP_INSTRUCTIONS) private readonly instructions?: string | null,
    @Optional() @Inject(MCP_PROMPTS) private readonly prompts?: McpPrompt[] | null,
  ) {}

  /** Streamable HTTP, stateless: a fresh server + transport per request, JSON responses, no sessions. */
  @Post()
  async handle(@Request() req: ExpressRequest, @Res() res: Response, @Body() body: any) {
    const auth = await this.oauth.verifyAccessToken(bearerToken(req) ?? '').catch(() => null);
    if (!auth) {
      // Points the client at the OAuth metadata, which starts the login flow.
      const baseUrl = mcpBaseUrl(req);
      res
        .status(401)
        .setHeader('WWW-Authenticate', baseUrl ? `Bearer resource_metadata="${resourceMetadataUrl(baseUrl)}"` : 'Bearer')
        .json({ error: 'unauthorized' });
      return;
    }
    const adminId = auth.extra.adminId as number | undefined;
    const ctx = {
      userId: auth.extra.userId as number,
      baseUrl: mcpBaseUrl(req) ?? undefined,
      support: adminId ? { adminId, expiresAt: auth.expiresAt } : undefined,
    };
    // A support session only reads: the app's read-only tools, plus SQL on the user's rows.
    const tools = adminId
      ? [...this.tools.filter((t) => (t.annotations?.readOnlyHint ?? true) && !t.annotations?.destructiveHint), ...this.support.tools()]
      : this.tools;
    const server = buildMcpServer(
      tools,
      ctx,
      this.instructions ?? undefined,
      this.prompts ?? [],
    );
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  @Get()
  getNotAllowed(@Res() res: Response) {
    methodNotAllowed(res);
  }

  @Delete()
  deleteNotAllowed(@Res() res: Response) {
    methodNotAllowed(res);
  }
}
