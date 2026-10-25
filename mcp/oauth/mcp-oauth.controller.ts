import { Body, Controller, Post, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@shared/auth/jwt-auth.guard';
import { AuthenticatedRequest } from '@shared/auth/auth.types';
import { getUserIdFromUser } from '@shared/auth/auth.util';
import { McpOAuthProvider } from './mcp-oauth.provider';
import { renderLoginPage } from './mcp-login-page';

@Controller('mcp/oauth')
export class McpOAuthController {
  constructor(private readonly provider: McpOAuthProvider) {}

  /** The login form from the authorize page; on success, redirects back to the client with a code. */
  @Post('login')
  async login(@Body() body: { request?: string; email?: string; password?: string }, @Res() res: Response) {
    const request = this.provider.verifyLoginRequest(body?.request ?? '');
    if (!request) {
      res.status(400).type('html').send('<p dir="rtl">פג תוקף הבקשה. חזרו לאפליקציה ונסו להתחבר שוב.</p>');
      return;
    }
    const user = await this.provider.login(body.email, body.password);
    if (!user) {
      const retry = this.provider.signLoginRequest(request);
      res.status(401).type('html').send(renderLoginPage(retry, request.clientName, 'מייל או סיסמה שגויים'));
      return;
    }
    res.redirect(302, this.provider.issueCodeRedirect(request, user.id));
  }

  /** "Disconnect" in the app settings: signs every connected AI client out. */
  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  async disconnect(@Request() req: AuthenticatedRequest) {
    const userId = getUserIdFromUser(req.user, true);
    if (userId) await this.provider.disconnectAll(userId);
    return { success: true };
  }
}
