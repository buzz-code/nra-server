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
import { McpSupportService } from '../support/mcp-support.service';
import { getDataSourceToken } from '@nestjs/typeorm';

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
  const writeTool: McpTool = {
    name: 'write_thing',
    description: 'Writes',
    inputSchema: {},
    annotations: { readOnlyHint: false },
    handler: async () => 'written',
  };
  const sqlRun: string[] = [];
  const audits: any[] = [];
  const dataSource = {
    entityMetadatas: [
      { tableName: 'games', columns: [{ propertyName: 'id', databaseName: 'id' }, { propertyName: 'userId', databaseName: 'user_id' }] },
      { tableName: 'lookups', columns: [{ propertyName: 'id', databaseName: 'id' }] },
      {
        tableName: 'users',
        columns: ['id', 'name', 'password', 'additionalData'].map((c) => ({ propertyName: c, databaseName: c })),
      },
    ],
    driver: { database: 'app_db' },
    query: async () => [{ name: 'games' }, { name: 'lookups' }, { name: 'users' }],
    getRepository: () => ({ insert: async (row) => audits.push(row) }),
    createQueryRunner: () => ({
      connect: async () => undefined,
      release: async () => undefined,
      query: async (sql: string) => {
        sqlRun.push(sql);
        return sql.startsWith('WITH') ? [{ id: 1 }] : undefined;
      },
    }),
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
      find: async () => Object.values(users),
      update: async (id, patch) => Object.assign(users[id], patch),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [McpController, McpOAuthController],
      providers: [
        McpOAuthProvider,
        McpAuthMiddleware,
        McpSupportService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: MCP_TOOL, useValue: [tool, writeTool] },
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

  type LoginStep = (loginRequest: string) => PromiseLike<request.Response>;
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

  it('refuses a wrong password', async () => {
    expect((await connect('user@test', 'wrong')).login.status).toBe(401);
    expect((await connect('admin@test', 'wrong')).login.status).toBe(401);
  });

  describe('admin support session', () => {
    const rpc = (token: string, method: string, params?: object) =>
      request(server())
        .post('/mcp')
        .set('Authorization', `Bearer ${token}`)
        .set('Accept', ACCEPT)
        .send({ jsonrpc: '2.0', id: 1, method, params });
    const pickStep =
      (userId: string, minutes: string, login: LoginStep = passwordLogin('admin@test', 'secret')): LoginStep =>
      async (loginRequest) => {
        const picker = await login(loginRequest);
        expect(picker.status).toBe(200);
        expect(picker.text).toContain('<option value="42">');
        expect(picker.text).not.toContain('<option value="9">');
        const pick = /name="pick" value="([^"]+)"/.exec(picker.text)[1];
        return request(server()).post('/mcp/oauth/support').type('form').send({ pick, userId, minutes });
      };

    beforeEach(() => {
      users[9].permissions = { admin: true };
      users[9].additionalData = {};
      sqlRun.length = 0;
      audits.length = 0;
    });

    it('signs in an admin, picks a user and duration, and reads only as that user', async () => {
      const { login, token } = await connectWith(pickStep('42', '15'));
      expect(login.status).toBe(302);
      expect(token.status).toBe(200);
      expect(token.body.expires_in).toBe(15 * 60);
      expect(token.body.refresh_token).toBeUndefined();
      expect(audits[0]).toMatchObject({ userId: 9, entityId: 42, entityName: 'mcp_support', operation: 'support_grant' });

      const list = await rpc(token.body.access_token, 'tools/list');
      expect(list.body.result.tools.map((t) => t.name).sort()).toEqual(['sql_query', 'sql_schema', 'whoami']);

      const whoami = await rpc(token.body.access_token, 'tools/call', { name: 'whoami', arguments: {} });
      expect(JSON.parse(whoami.body.result.content[0].text).userId).toBe(42);

      const schema = await rpc(token.body.access_token, 'tools/call', { name: 'sql_schema', arguments: {} });
      expect(JSON.parse(schema.body.result.content[0].text)).toEqual([
        { table: 'games', columns: ['id', 'user_id'] },
        { table: 'users', columns: ['id', 'name'] },
      ]);

      const query = await rpc(token.body.access_token, 'tools/call', { name: 'sql_query', arguments: { sql: 'select id from games' } });
      expect(JSON.parse(query.body.result.content[0].text)).toMatchObject({ rows: [{ id: 1 }], rowCount: 1 });
      expect(sqlRun).toEqual([
        'SET SESSION max_execution_time = 10000',
        'START TRANSACTION READ ONLY',
        'WITH `games` AS (SELECT * FROM `app_db`.`games` WHERE `user_id` = 42) SELECT `id` FROM `games` LIMIT 200',
        'ROLLBACK',
        'SET SESSION max_execution_time = DEFAULT',
      ]);
      expect(audits[1]).toMatchObject({ userId: 9, entityId: 42, operation: 'sql_query', entityData: { sql: 'select id from games', rows: 1 } });

      const refused = await rpc(token.body.access_token, 'tools/call', { name: 'sql_query', arguments: { sql: 'select * from lookups' } });
      expect(refused.body.result.isError).toBe(true);
      expect(audits[2]).toMatchObject({ operation: 'sql_refused' });
    });

    it('opens from the admin\'s own site session too', async () => {
      const { login } = await connectWith(pickStep('42', '10', sessionApprove(siteCookie({ id: 9 }))));
      expect(login.status).toBe(302);
    });

    it('refuses an admin or unknown user as the target, and a duration off the list', async () => {
      expect((await connectWith(pickStep('9', '15'))).login.status).toBe(400);
      expect((await connectWith(pickStep('12345', '15'))).login.status).toBe(400);
      expect((await connectWith(pickStep('42', '600'))).login.status).toBe(400);
      expect(audits).toHaveLength(0);
    });

    it('refuses a forged or expired pick', async () => {
      const res = await request(server()).post('/mcp/oauth/support').type('form').send({ pick: 'x', userId: '42', minutes: '15' });
      expect(res.status).toBe(400);
    });

    it('ends when the admin disconnects or stops being an admin', async () => {
      const first = (await connectWith(pickStep('42', '15'))).token.body.access_token;
      expect((await rpc(first, 'ping')).status).toBe(200);
      await app.get(McpOAuthProvider).disconnectAll(9);
      expect((await rpc(first, 'ping')).status).toBe(401);

      const second = (await connectWith(pickStep('42', '15'))).token.body.access_token;
      users[9].permissions = {};
      expect((await rpc(second, 'ping')).status).toBe(401);
    });

    it('ends at the chosen time', async () => {
      const token = (await connectWith(pickStep('42', '10'))).token.body.access_token;
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now + 11 * 60 * 1000);
      try {
        expect((await rpc(token, 'ping')).status).toBe(401);
      } finally {
        jest.restoreAllMocks();
      }
    });
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

  it('a personal key works as a bearer token until disconnect', async () => {
    const provider = app.get(McpOAuthProvider);
    expect(await provider.issueApiKey(9)).toBeNull();
    const apiKey = await provider.issueApiKey(42);
    const whoami = () =>
      request(server())
        .post('/mcp')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Accept', ACCEPT)
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami', arguments: {} } });
    const call = await whoami();
    expect(call.status).toBe(200);
    expect(JSON.parse(call.body.result.content[0].text).userId).toBe(42);

    await provider.disconnectAll(42);
    expect((await whoami()).status).toBe(401);
  });

  it('refuses GET', async () => {
    expect((await request(server()).get('/mcp')).status).toBe(405);
  });
});
