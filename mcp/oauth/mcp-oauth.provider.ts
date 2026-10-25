import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { createHmac } from 'crypto';
import { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { InvalidGrantError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { User } from '@shared/entities/User.entity';
import { isAdmin } from '@shared/utils/permissionsUtil';
import { renderLoginPage } from './mcp-login-page';

const ACCESS_TOKEN_SECONDS = 60 * 60;
const REFRESH_TOKEN_SECONDS = 60 * 60 * 24 * 90;
const CODE_SECONDS = 5 * 60;
const LOGIN_REQUEST_SECONDS = 15 * 60;

/** A pending authorization, carried through the login form as a signed token. */
export interface LoginRequest {
  clientId: string;
  clientName?: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scopes?: string[];
  resource?: string;
}

/**
 * OAuth 2.1 authorization server for `/mcp`, fully stateless: clients, codes and tokens are all
 * signed JWTs (own secret derived from JWT_SECRET), so there are no tables. Registered client ids
 * carry their metadata; confidential clients get a secret derived from their id.
 * Revocation bumps `user.additionalData.mcpTokenVersion`, which disconnects all of that user's clients.
 * Admins can't connect, so a token always maps to exactly one user.
 */
@Injectable()
export class McpOAuthProvider implements OAuthServerProvider {
  private readonly secret = createHmac('sha256', process.env.JWT_SECRET ?? '').update('mcp-oauth').digest('hex');
  private readonly jwt = new JwtService({ secret: this.secret });
  // Codes are single use; enough for one server instance, and they expire in 5 minutes anyway.
  private readonly usedCodes = new Map<string, number>();

  constructor(@InjectRepository(User) private userRepository: Repository<User>) {}

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: (clientId) => {
        const metadata = this.verify(clientId, 'client');
        if (!metadata) return undefined;
        return { ...metadata.client, ...this.credentials(clientId, metadata.client) };
      },
      registerClient: (client) => {
        const { client_secret, client_secret_expires_at, client_id, client_id_issued_at, ...metadata } = client as OAuthClientInformationFull;
        const clientId = this.jwt.sign({ typ: 'client', client: metadata });
        return { ...metadata, ...this.credentials(clientId, metadata) };
      },
    };
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const request: LoginRequest = {
      clientId: client.client_id,
      clientName: client.client_name,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state,
      scopes: params.scopes,
      resource: params.resource?.href,
    };
    res.status(200).type('html').send(renderLoginPage(this.signLoginRequest(request), client.client_name));
  }

  signLoginRequest(request: LoginRequest): string {
    return this.jwt.sign({ typ: 'login', request }, { expiresIn: LOGIN_REQUEST_SECONDS });
  }

  verifyLoginRequest(token: string): LoginRequest | null {
    return this.verify(token, 'login')?.request ?? null;
  }

  /** Checks email + password like the site login. Admins are refused. */
  async login(email: string, password: string): Promise<User | null> {
    if (!email || !password) return null;
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user || isAdmin(user) || !(await bcrypt.compare(password, user.password))) return null;
    return user;
  }

  /** The redirect back to the client after a successful login. */
  issueCodeRedirect(request: LoginRequest, userId: number): string {
    const code = this.jwt.sign({ typ: 'code', userId, request }, { expiresIn: CODE_SECONDS });
    const url = new URL(request.redirectUri);
    url.searchParams.set('code', code);
    if (request.state !== undefined) url.searchParams.set('state', request.state);
    return url.href;
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string): Promise<string> {
    return this.verifyCode(client, code).request.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    code: string,
    _codeVerifier?: string,
    redirectUri?: string,
  ): Promise<OAuthTokens> {
    const { userId, request, exp } = this.verifyCode(client, code);
    if (redirectUri && redirectUri !== request.redirectUri) throw new InvalidGrantError('redirect_uri mismatch');
    this.markCodeUsed(code, exp);
    return this.issueTokens(client.client_id, userId, request.scopes ?? [], await this.tokenVersion(userId));
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
    const payload = this.verify(refreshToken, 'refresh');
    if (!payload || payload.clientId !== client.client_id) throw new InvalidGrantError('Invalid refresh token');
    const version = await this.tokenVersion(payload.userId);
    if (version === null || version !== payload.v) throw new InvalidGrantError('Refresh token revoked');
    return this.issueTokens(client.client_id, payload.userId, payload.scopes ?? [], version);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const payload = this.verify(token, 'access');
    if (!payload) throw new InvalidTokenError('Invalid access token');
    const version = await this.tokenVersion(payload.userId);
    if (version === null || version !== payload.v) throw new InvalidTokenError('Access token revoked');
    return {
      token,
      clientId: payload.clientId,
      scopes: payload.scopes ?? [],
      expiresAt: payload.exp,
      extra: { userId: payload.userId },
    };
  }

  async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    const payload = this.verify(request.token, 'access') ?? this.verify(request.token, 'refresh');
    if (payload) await this.disconnectAll(payload.userId);
  }

  /** Invalidates every MCP token the user holds, across all clients. */
  async disconnectAll(userId: number): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) return;
    await this.userRepository.update(user.id, {
      additionalData: { ...user.additionalData, mcpTokenVersion: (user.additionalData?.mcpTokenVersion ?? 0) + 1 },
    });
  }

  private issueTokens(clientId: string, userId: number, scopes: string[], v: number): OAuthTokens {
    const claims = { clientId, userId, scopes, v };
    return {
      access_token: this.jwt.sign({ typ: 'access', ...claims }, { expiresIn: ACCESS_TOKEN_SECONDS }),
      token_type: 'bearer',
      expires_in: ACCESS_TOKEN_SECONDS,
      refresh_token: this.jwt.sign({ typ: 'refresh', ...claims }, { expiresIn: REFRESH_TOKEN_SECONDS }),
      scope: scopes.join(' ') || undefined,
    };
  }

  /** null when the user is gone or became an admin, which also invalidates their tokens. */
  private async tokenVersion(userId: number): Promise<number | null> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user || isAdmin(user)) return null;
    return user.additionalData?.mcpTokenVersion ?? 0;
  }

  private verifyCode(client: OAuthClientInformationFull, code: string) {
    const payload = this.verify(code, 'code');
    if (!payload || payload.request.clientId !== client.client_id || this.usedCodes.has(code)) {
      throw new InvalidGrantError('Invalid authorization code');
    }
    return payload as { userId: number; request: LoginRequest; exp: number };
  }

  private markCodeUsed(code: string, exp: number) {
    const now = Date.now() / 1000;
    for (const [used, usedExp] of this.usedCodes) if (usedExp < now) this.usedCodes.delete(used);
    this.usedCodes.set(code, exp);
  }

  private credentials(clientId: string, metadata: { token_endpoint_auth_method?: string }) {
    const isPublic = metadata.token_endpoint_auth_method === 'none';
    return {
      client_id: clientId,
      client_id_issued_at: undefined,
      client_secret: isPublic ? undefined : createHmac('sha256', this.secret).update(clientId).digest('hex'),
      client_secret_expires_at: isPublic ? undefined : 0,
    };
  }

  private verify(token: string, typ: string): any | null {
    try {
      const payload = this.jwt.verify(token);
      return payload?.typ === typ ? payload : null;
    } catch {
      return null;
    }
  }
}
