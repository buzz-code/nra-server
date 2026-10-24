import { Body, Controller, Delete, Get, Inject, Post, Request, Res, UseGuards } from '@nestjs/common';
import { Request as ExpressRequest, Response } from 'express';
import { JwtAuthGuard } from '@shared/auth/jwt-auth.guard';
import { AuthenticatedRequest } from '@shared/auth/auth.types';
import { McpTokenService } from './mcp-token.service';
import { handleMcpMessage } from './mcp-protocol';
import { MCP_TOOL, McpTool } from './mcp.types';

const methodNotAllowed = (res: Response) => res.status(405).setHeader('Allow', 'POST').json({ error: 'method not allowed' });

const bearerToken = (req: ExpressRequest) => /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1];

@Controller('mcp')
export class McpController {
  constructor(
    private readonly tokenService: McpTokenService,
    @Inject(MCP_TOOL) private readonly tools: McpTool[],
  ) {}

  /** Creates (or rotates) the caller's MCP token. Shown once; only its hash is stored. */
  @UseGuards(JwtAuthGuard)
  @Post('token')
  async createToken(@Request() req: AuthenticatedRequest) {
    return { token: await this.tokenService.issueToken(req.user) };
  }

  /** Streamable HTTP, stateless, JSON responses only (no SSE stream, no sessions). */
  @Post()
  async handle(@Request() req: ExpressRequest, @Res() res: Response, @Body() body: any) {
    const userId = await this.tokenService.resolveUserId(bearerToken(req));
    if (!userId) {
      res.status(401).setHeader('WWW-Authenticate', 'Bearer').json({ error: 'unauthorized' });
      return;
    }
    const messages = Array.isArray(body) ? body : [body];
    const responses = (await Promise.all(messages.map((m) => handleMcpMessage(m, this.tools, { userId })))).filter(Boolean);
    if (!responses.length) {
      res.status(202).end();
      return;
    }
    res.status(200).json(Array.isArray(body) ? responses : responses[0]);
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
