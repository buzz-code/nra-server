import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { McpController } from '../mcp.controller';
import { McpTokenService } from '../mcp-token.service';
import { MCP_TOOL, McpTool } from '../mcp.types';

describe('McpController', () => {
  let app: INestApplication;
  const tool: McpTool = {
    name: 'whoami',
    description: 'Returns the user id',
    inputSchema: {},
    handler: async (_input, ctx) => ({ userId: ctx.userId }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        { provide: McpTokenService, useValue: { resolveUserId: async (token) => (token === 'good' ? 42 : null) } },
        { provide: MCP_TOOL, useValue: [tool] },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('asks for a bearer token', async () => {
    const res = await request(app.getHttpServer()).post('/mcp').send({ jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });

  it('runs a tool as the token user', async () => {
    const res = await request(app.getHttpServer())
      .post('/mcp')
      .set('Authorization', 'Bearer good')
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami' } });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body.result.content[0].text)).toEqual({ userId: 42 });
  });

  it('accepts notifications with 202 and refuses GET', async () => {
    const server = app.getHttpServer();
    const note = await request(server).post('/mcp')
      .set('Authorization', 'Bearer good')
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(note.status).toBe(202);
    expect((await request(server).get('/mcp').set('Authorization', 'Bearer good')).status).toBe(405);
  });
});
