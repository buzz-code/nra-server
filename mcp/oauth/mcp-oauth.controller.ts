import { Body, Controller, ForbiddenException, Post, Request, Res, UseGuards } from '@nestjs/common';
import { Request as ExpressRequest, Response } from 'express';
import { JwtAuthGuard } from '@shared/auth/jwt-auth.guard';
import { AuthenticatedRequest } from '@shared/auth/auth.types';
import { getUserIdFromUser } from '@shared/auth/auth.util';
import { isAdmin } from '@shared/utils/permissionsUtil';
import { User } from '@shared/entities/User.entity';
import { LoginRequest, McpOAuthProvider, SUPPORT_MINUTES } from './mcp-oauth.provider';
import { renderSupportPage, sendLoginPage } from './mcp-login-page';
import { mcpBaseUrl } from './mcp-auth.middleware';
import { McpSupportService } from '../support/mcp-support.service';

const EXPIRED_PAGE = '<p dir="rtl">פג תוקף הבקשה. חזרו לאפליקציה ונסו להתחבר שוב.</p>';

@Controller('mcp/oauth')
export class McpOAuthController {
  constructor(private readonly provider: McpOAuthProvider, private readonly support: McpSupportService) {}

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
    await this.finishLogin(res, request, user);
  }

  /**
   * Second step for an admin: the user and duration of a support session. Re-checks that the signer is
   * still an admin and that the target is a real non-admin user; every grant goes to the audit log.
   */
  @Post('support')
  async supportGrant(@Body() body: { pick?: string; userId?: string; minutes?: string }, @Res() res: Response) {
    const pick = await this.provider.verifySupportPick(body?.pick ?? '');
    if (!pick) {
      res.status(400).type('html').send(EXPIRED_PAGE);
      return;
    }
    const minutes = Number(body.minutes);
    const target = await this.provider.supportTarget(Number(body.userId));
    if (!target || !SUPPORT_MINUTES.includes(minutes)) {
      await this.sendSupportPage(res, 400, pick.request, pick.adminId, 'בחרו משתמש קיים (לא מנהל) ומשך גישה.');
      return;
    }
    await this.support.audit(pick.adminId, target.id, 'support_grant', {
      minutes,
      client: pick.request.clientName ?? null,
      redirectHost: new URL(pick.request.redirectUri).host,
    });
    res.redirect(302, this.provider.issueCodeRedirect(pick.request, target.id, { adminId: pick.adminId, minutes }));
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
    await this.finishLogin(res, request, user);
  }

  /** A user connects as themselves; an admin goes on to pick whom to read as. */
  private async finishLogin(res: Response, request: LoginRequest, user: User) {
    if (isAdmin(user)) {
      await this.sendSupportPage(res, 200, request, user.id);
      return;
    }
    res.redirect(302, this.provider.issueCodeRedirect(request, user.id));
  }

  private async sendSupportPage(res: Response, status: number, request: LoginRequest, adminId: number, error?: string) {
    const pick = this.provider.signSupportPick(request, adminId);
    sendLoginPage(res, status, renderSupportPage(pick, request, await this.provider.supportUsers(), SUPPORT_MINUTES, error));
  }

  /** "Personal key" in the app settings, for AI apps whose OAuth login doesn't work. Not for admins or impersonation. */
  @UseGuards(JwtAuthGuard)
  @Post('api-key')
  async apiKey(@Request() req: AuthenticatedRequest) {
    const userId = req.user?.impersonated ? undefined : getUserIdFromUser(req.user, true);
    const apiKey = userId ? await this.provider.issueApiKey(userId) : null;
    if (!apiKey) throw new ForbiddenException();
    return { apiKey };
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
