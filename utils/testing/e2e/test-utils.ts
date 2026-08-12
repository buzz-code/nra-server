import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

/**
 * Common HTTP test utilities for e2e tests
 */
export class HttpTestUtils {
  constructor(private app: INestApplication) {}

  get(path: string) {
    return request(this.app.getHttpServer()).get(path);
  }

  post(path: string, data?: any) {
    const req = request(this.app.getHttpServer()).post(path);
    if (data) {
      req.send(data);
    }
    return req;
  }

  put(path: string, data?: any) {
    const req = request(this.app.getHttpServer()).put(path);
    if (data) {
      req.send(data);
    }
    return req;
  }

  delete(path: string) {
    return request(this.app.getHttpServer()).delete(path);
  }

  patch(path: string, data?: any) {
    const req = request(this.app.getHttpServer()).patch(path);
    if (data) {
      req.send(data);
    }
    return req;
  }
}

export interface TestUserCredentials {
  username: string;
  password: string;
  name: string;
}

/**
 * Registers a test user via POST /auth/register and returns the Authentication
 * cookie from the response, for use with `.set('Cookie', cookie)` on subsequent
 * authenticated requests. Throws a clear error instead of a bare TypeError if
 * the endpoint doesn't return a usable Set-Cookie header.
 */
export async function registerAndAuthenticate(
  httpUtils: HttpTestUtils,
  credentials: TestUserCredentials,
): Promise<string> {
  const registerRes = await httpUtils.post('/auth/register', credentials).expect(200);
  const setCookieHeader = registerRes.headers['set-cookie'];
  const authCookie = setCookieHeader?.[0]?.match(/Authentication=[^;]+/)?.[0];
  if (!authCookie) {
    throw new Error(
      `Expected an Authentication cookie from /auth/register, got Set-Cookie: ${JSON.stringify(setCookieHeader)}`,
    );
  }
  return authCookie;
}

/**
 * The CRUD list endpoint returns a plain array by default, or a paginated
 * { data: [...] } object once pagination kicks in (e.g. a page/limit query
 * param). Normalize so list assertions don't depend on which shape came back.
 */
export function asList(body: any): any[] {
  return Array.isArray(body) ? body : body.data;
}
