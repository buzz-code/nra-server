import { Body, Controller, Post, Request, Res, UseGuards } from '@nestjs/common';
import { Request as ExpressRequest, Response } from 'express';
import { JwtAuthGuard } from '@shared/auth/jwt-auth.guard';
import { AuthenticatedRequest } from '@shared/auth/auth.types';
import { getUserIdFromUser } from '@shared/auth/auth.util';
import { McpOAuthProvider } from './mcp-oauth.provider';
import { sendLoginPage } from './mcp-login-page';
import { mcpBaseUrl } from './mcp-auth.middleware';

const EXPIRED_PAGE = '<p dir="rtl">פג תוקף הבקשה. חזרו לאפליקציה ונסו להתחבר שוב.</p>';

@Controller('mcp/oauth')
export class McpOAuthController {
  constructor(private readonly provider: McpOAuthProvider) {}

  /** The login form from the authorize page; on success, redirects back to the client with a code. */
  @Post('login')
  async login(@Body() body: { request?: string; email?: string; password?: string }, @Res() res: Response) {
    const request = this.provider.verifyLoginRequest(body?.request ?? '');
    if (!request) {
      res.status(400).type('html').send(EXPIRED_PAGE);
      return;
    }
    const user = await this.provider.login(body.email, body.password);
    if (!user) {
      sendLoginPage(res, 401, this.provider.loginPage(request, 'מייל או סיסמה שגויים'));
      return;
    }
    res.redirect(302, this.provider.issueCodeRedirect(request, user.id));
  }

  /** Who is signed in to the site in this browser, so the login page can offer one-click approval. */
  @Post('session')
  async session(@Request() req: ExpressRequest, @Res() res: Response) {
    const user = sameOrigin(req) ? await this.provider.sessionUser(req.headers.cookie) : null;
    res.setHeader('Cache-Control', 'no-store');
    if (!user) {
      res.status(401).json({ error: 'not signed in' });
      return;
    }
    res.status(200).json({ name: user.name || user.email });
  }

  /**
   * One-click approval as the user signed in to the site. Only from the login page itself: the site cookie
   * is SameSite=Strict and the Origin must be this server, so another site can't approve on the user's behalf.
   */
  @Post('approve')
  async approve(@Request() req: ExpressRequest, @Body() body: { request?: string }, @Res() res: Response) {
    const request = this.provider.verifyLoginRequest(body?.request ?? '');
    if (!request) {
      res.status(400).type('html').send(EXPIRED_PAGE);
      return;
    }
    const user = sameOrigin(req) ? await this.provider.sessionUser(req.headers.cookie) : null;
    if (!user) {
      sendLoginPage(res, 401, this.provider.loginPage(request, 'לא נמצאה התחברות פעילה. התחברו עם מייל וסיסמה.'));
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

/** The request came from a page on this server (browsers send Origin on POST). */
function sameOrigin(req: ExpressRequest): boolean {
  const baseUrl = mcpBaseUrl(req);
  return !!baseUrl && req.headers.origin === baseUrl;
}
