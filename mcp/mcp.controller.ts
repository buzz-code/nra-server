import { Body, Controller, Delete, Get, Inject, Optional, Post, Request, Res } from '@nestjs/common';
import { Request as ExpressRequest, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildMcpServer } from './mcp-server.factory';
import { MCP_INSTRUCTIONS, MCP_TOOL, McpTool } from './mcp.types';
import { McpOAuthProvider } from './oauth/mcp-oauth.provider';
import { mcpBaseUrl, resourceMetadataUrl } from './oauth/mcp-auth.middleware';

const methodNotAllowed = (res: Response) => res.status(405).setHeader('Allow', 'POST').json({ error: 'method not allowed' });

const bearerToken = (req: ExpressRequest) => /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1];

@Controller('mcp')
export class McpController {
  constructor(
    private readonly oauth: McpOAuthProvider,
    @Inject(MCP_TOOL) private readonly tools: McpTool[],
    @Optional() @Inject(MCP_INSTRUCTIONS) private readonly instructions?: string | null,
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
    const server = buildMcpServer(
      this.tools,
      { userId: auth.extra.userId as number, baseUrl: mcpBaseUrl(req) ?? undefined },
      this.instructions ?? undefined,
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
