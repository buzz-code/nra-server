import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { getOAuthProtectedResourceMetadataUrl, mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { McpOAuthProvider } from './mcp-oauth.provider';

/**
 * Public base URL for the request's host, or null for a host we don't serve.
 * The API runs at `api.<domain>` for each domain in DOMAIN_NAME / DOMAIN_NAME_2; localhost in development.
 */
export function mcpBaseUrl(req: Request): string | null {
  const host = req.headers.host ?? '';
  const domains = [...(process.env.DOMAIN_NAME ?? '').split(','), process.env.DOMAIN_NAME_2 ?? '']
    .map((d) => d.trim())
    .filter(Boolean);
  if (domains.some((d) => host === `api.${d}`)) return `https://${host}`;
  if (process.env.NODE_ENV !== 'production' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  return null;
}

export function resourceMetadataUrl(baseUrl: string): string {
  return getOAuthProtectedResourceMetadataUrl(new URL(`${baseUrl}/mcp`));
}

/**
 * Serves the SDK's OAuth endpoints (/.well-known/*, /authorize, /token, /register, /revoke).
 * One router per public host, since the issuer URL is part of the metadata.
 */
@Injectable()
export class McpAuthMiddleware implements NestMiddleware {
  private readonly routers = new Map<string, RequestHandler>();

  constructor(private readonly provider: McpOAuthProvider) {}

  use(req: Request, res: Response, next: NextFunction) {
    const baseUrl = mcpBaseUrl(req);
    if (!baseUrl) return next();
    if (!this.routers.has(baseUrl)) {
      this.routers.set(
        baseUrl,
        mcpAuthRouter({
          provider: this.provider,
          issuerUrl: new URL(baseUrl),
          resourceServerUrl: new URL(`${baseUrl}/mcp`),
          resourceName: 'Usage statistics',
          // Behind the reverse proxy every request shares one IP, so per-IP limits would lock everyone out.
          authorizationOptions: { rateLimit: false },
          tokenOptions: { rateLimit: false },
          clientRegistrationOptions: { rateLimit: false },
          revocationOptions: { rateLimit: false },
        }),
      );
    }
    // Nest mounts middleware under a path pattern, which strips the matched part from req.url; the SDK router matches on the full path.
    // Restore the mounted values before handing back, so the rest of the app routes as usual.
    const { url, baseUrl: mountPath } = req;
    req.url = req.originalUrl;
    req.baseUrl = '';
    this.routers.get(baseUrl)(req, res, (err?: unknown) => {
      req.url = url;
      req.baseUrl = mountPath;
      next(err);
    });
  }
}
