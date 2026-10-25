import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { join } from 'path';
import { McpModule } from '../mcp.module';

class NoopTool {
  name = 'noop';
  description = 'noop';
  inputSchema = {};
  async handler() {
    return {};
  }
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [join(__dirname, '../../entities/**/*.entity.ts')],
    }),
    McpModule.forRoot({ tools: [NoopTool as any] }),
  ],
})
class TestAppModule {}

// Goes through the module's own middleware registration, which is where the OAuth routes once went missing.
describe('McpModule wiring', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    app = ref.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('serves authorization server metadata', async () => {
    const res = await request(app.getHttpServer()).get('/.well-known/oauth-authorization-server');
    expect(res.status).toBe(200);
    expect(res.body.registration_endpoint).toMatch(/\/register$/);
  });

  it('serves protected resource metadata', async () => {
    const res = await request(app.getHttpServer()).get('/.well-known/oauth-protected-resource/mcp');
    expect(res.status).toBe(200);
  });

  it('registers a client', async () => {
    const res = await request(app.getHttpServer())
      .post('/register')
      .send({
        client_name: 'Claude',
        redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
      });
    expect(res.status).toBe(201);
    expect(res.body.client_id).toBeTruthy();
  });

  it('still routes other requests to Nest controllers', async () => {
    const res = await request(app.getHttpServer()).post('/mcp').send({});
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toContain('resource_metadata=');
  });
});
