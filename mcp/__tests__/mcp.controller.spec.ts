import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
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
    const password = await bcrypt.hash('secret', 4);
    users = {
      42: { id: 42, email: 'user@test', password, permissions: {}, additionalData: {} },
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

  /** Runs the whole flow a client does: register, authorize page, login form, token exchange. */
  async function connect(email: string, password: string) {
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
    const loginRequest = /name="request" value="([^"]+)"/.exec(page.text)[1];

    const login = await request(server()).post('/mcp/oauth/login').type('form').send({ request: loginRequest, email, password });
    if (login.status !== 302) return { login };
    const location = new URL(login.headers.location);
    expect(location.searchParams.get('state')).toBe('xyz');

    const token = await request(server()).post('/token').type('form').send({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: location.searchParams.get('code'),
      code_verifier: verifier,
      redirect_uri: redirectUri,
    });
    return { login, token, clientId };
  }

  it('advertises OAuth metadata and points unauthenticated calls at it', async () => {
    const res = await request(server()).post('/mcp').set('Accept', ACCEPT).send({ jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toMatch(/resource_metadata="http:\/\/127\.0\.0\.1:\d+\/\.well-known\/oauth-protected-resource\/mcp"/);

    const metadata = await request(server()).get('/.well-known/oauth-authorization-server');
    expect(metadata.body).toMatchObject({ registration_endpoint: expect.stringMatching(/\/register$/), code_challenge_methods_supported: ['S256'] });
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
    expect(JSON.parse(call.body.result.content[0].text)).toEqual({ userId: 42, baseUrl: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+$/) });

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
    const revoke = await request(server()).post('/revoke').type('form').send({ client_id: clientId, token: token.body.access_token });
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

  it('refuses GET', async () => {
    expect((await request(server()).get('/mcp')).status).toBe(405);
  });
});
