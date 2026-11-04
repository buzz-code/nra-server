import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { User } from '@shared/entities/User.entity';
import { McpController } from '../mcp.controller';
import { MCP_TOOL, McpTool } from '../mcp.types';
import { McpOAuthProvider } from '../oauth/mcp-oauth.provider';
import { McpOAuthController } from '../oauth/mcp-oauth.controller';
import { McpAuthMiddleware } from '../oauth/mcp-auth.middleware';

const ACCEPT = 'application/json, text/event-stream';

describe('MCP endpoint with OAuth login', () => {
  let app: INestApplication;
  let users: Record<number, any>;
  const tool: McpTool = {
    name: 'whoami',
    description: 'Returns the user id',
    inputSchema: {},
    handler: async (_input, ctx) => ({ userId: ctx.userId, baseUrl: ctx.baseUrl }),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    const password = await bcrypt.hash('secret', 4);
    users = {
      42: { id: 42, name: 'Test User', email: 'user@test', password, permissions: {}, additionalData: {} },
      9: { id: 9, email: 'admin@test', password, permissions: { admin: true }, additionalData: {} },
    };
    const userRepo = {
      findOne: async ({ where }) => Object.values(users).find((u) => u.email === where.email) ?? null,
      findOneBy: async ({ id }) => users[id] ?? null,
      update: async (id, patch) => Object.assign(users[id], patch),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [McpController, McpOAuthController],
      providers: [
        McpOAuthProvider,
        McpAuthMiddleware,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: MCP_TOOL, useValue: [tool] },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    const middleware = app.get(McpAuthMiddleware);
    app.use((req, res, next) => middleware.use(req, res, next));
    await app.init();
  });

  afterAll(() => app.close());

  const server = () => app.getHttpServer();

  // Requests below go to Host: localhost, so the page's own origin is http://localhost.
  const origin = () => 'http://localhost';
  /** The site's login cookie, as the app's own login sets it. */
  const siteCookie = (payload: object) =>
    `Authentication=${new JwtService({ secret: process.env.JWT_SECRET }).sign(payload)}`;

  type LoginStep = (loginRequest: string) => request.Test;
  const passwordLogin =
    (email: string, password: string): LoginStep =>
    (loginRequest) =>
      request(server()).post('/mcp/oauth/login').type('form').send({ request: loginRequest, email, password });
  const sessionApprove =
    (cookie?: string, from = origin()): LoginStep =>
    (loginRequest) => {
      const req = request(server()).post('/mcp/oauth/approve').set('Host', 'localhost').type('form');
      if (cookie) req.set('Cookie', cookie);
      if (from) req.set('Origin', from);
      return req.send({ request: loginRequest });
    };

  /** Runs the whole flow a client does: register, authorize page, login form, token exchange. */
  async function connect(email: string, password: string) {
    return connectWith(passwordLogin(email, password));
  }

  async function connectWith(loginStep: LoginStep) {
    const redirectUri = 'http://localhost:9999/callback';
    const registered = await request(server())
      .post('/register')
      .send({ redirect_uris: [redirectUri], client_name: 'Claude', token_endpoint_auth_method: 'none' });
    expect(registered.status).toBe(201);
    const clientId = registered.body.client_id;

    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const page = await request(server()).get('/authorize').query({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'xyz',
    });
    expect(page.status).toBe(200);
    expect(page.text).toContain('Claude');
    expect(page.text).toContain('localhost:9999');
    const loginRequest = /name="request" value="([^"]+)"/.exec(page.text)[1];

    const login = await loginStep(loginRequest);
    if (login.status !== 302) return { login };
    const location = new URL(login.headers.location);
    expect(location.searchParams.get('state')).toBe('xyz');

    const token = await request(server())
      .post('/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        client_id: clientId,
        code: location.searchParams.get('code'),
        code_verifier: verifier,
        redirect_uri: redirectUri,
      });
    return { login, token, clientId };
  }

  it('advertises OAuth metadata and points unauthenticated calls at it', async () => {
    const res = await request(server())
      .post('/mcp')
      .set('Accept', ACCEPT)
      .send({ jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toMatch(
      /resource_metadata="http:\/\/127\.0\.0\.1:\d+\/\.well-known\/oauth-protected-resource\/mcp"/,
    );

    const metadata = await request(server()).get('/.well-known/oauth-authorization-server');
    expect(metadata.body).toMatchObject({
      registration_endpoint: expect.stringMatching(/\/register$/),
      code_challenge_methods_supported: ['S256'],
    });
  });

  it('logs in, issues tokens and runs tools as that user', async () => {
    const { token, clientId } = await connect('user@test', 'secret');
    expect(token.status).toBe(200);

    const call = await request(server())
      .post('/mcp')
      .set('Authorization', `Bearer ${token.body.access_token}`)
      .set('Accept', ACCEPT)
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami', arguments: {} } });
    expect(call.status).toBe(200);
    expect(JSON.parse(call.body.result.content[0].text)).toEqual({
      userId: 42,
      baseUrl: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+$/),
    });

    const refreshed = await request(server())
      .post('/token')
      .type('form')
      .send({ grant_type: 'refresh_token', client_id: clientId, refresh_token: token.body.refresh_token });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.access_token).toBeTruthy();
  });

  it('refuses a wrong password and admins', async () => {
    expect((await connect('user@test', 'wrong')).login.status).toBe(401);
    expect((await connect('admin@test', 'secret')).login.status).toBe(401);
  });

  it('revoking a token disconnects the user', async () => {
    const { token, clientId } = await connect('user@test', 'secret');
    const revoke = await request(server())
      .post('/revoke')
      .type('form')
      .send({ client_id: clientId, token: token.body.access_token });
    expect(revoke.status).toBe(200);

    const call = await request(server())
      .post('/mcp')
      .set('Authorization', `Bearer ${token.body.access_token}`)
      .set('Accept', ACCEPT)
      .send({ jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(call.status).toBe(401);
  });

  it('disconnect from the app settings signs all clients out', async () => {
    const { token } = await connect('user@test', 'secret');
    await app.get(McpOAuthProvider).disconnectAll(42);
    const call = await request(server())
      .post('/mcp')
      .set('Authorization', `Bearer ${token.body.access_token}`)
      .set('Accept', ACCEPT)
      .send({ jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(call.status).toBe(401);
  });

  it('approves in one click as the user signed in to the site', async () => {
    const { login, token } = await connectWith(sessionApprove(siteCookie({ id: 42, username: 'user@test' })));
    expect(login.status).toBe(302);
    expect(token.status).toBe(200);
    const call = await request(server())
      .post('/mcp')
      .set('Authorization', `Bearer ${token.body.access_token}`)
      .set('Accept', ACCEPT)
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami', arguments: {} } });
    expect(JSON.parse(call.body.result.content[0].text).userId).toBe(42);
  });

  it('refuses one-click approval without a valid session or from another site', async () => {
    const user = siteCookie({ id: 42 });
    expect((await connectWith(sessionApprove())).login.status).toBe(401);
    expect((await connectWith(sessionApprove(user, 'https://evil.example'))).login.status).toBe(401);
    expect((await connectWith(sessionApprove(user, ''))).login.status).toBe(401);
    expect((await connectWith(sessionApprove(siteCookie({ id: 42, impersonated: true })))).login.status).toBe(401);
    expect((await connectWith(sessionApprove(siteCookie({ id: 9 })))).login.status).toBe(401);
    expect((await connectWith(sessionApprove(siteCookie({ id: -1, permissions: { admin: true } })))).login.status).toBe(
      401,
    );
    const forged = `Authentication=${new JwtService({ secret: 'other' }).sign({ id: 42 })}`;
    expect((await connectWith(sessionApprove(forged))).login.status).toBe(401);
  });

  it('tells the login page who is signed in, only to itself', async () => {
    const ok = await request(server())
      .post('/mcp/oauth/session')
      .set('Host', 'localhost')
      .set('Cookie', siteCookie({ id: 42 }))
      .set('Origin', origin());
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ name: 'Test User' });
    const foreign = await request(server())
      .post('/mcp/oauth/session')
      .set('Host', 'localhost')
      .set('Cookie', siteCookie({ id: 42 }))
      .set('Origin', 'https://evil.example');
    expect(foreign.status).toBe(401);
  });

  it('serves the login page unframeable', async () => {
    const { login } = await connect('user@test', 'wrong');
    expect(login.headers['content-security-policy']).toBe("frame-ancestors 'none'");
    expect(login.headers['x-frame-options']).toBe('DENY');
  });

  it('refuses GET', async () => {
    expect((await request(server()).get('/mcp')).status).toBe(405);
  });
});
