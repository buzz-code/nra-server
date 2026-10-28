import * as express from 'express';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from '@shared/auth/constants';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { User } from '@shared/entities/User.entity';
import { createRealDataSource } from '../../testing/real-data-source';
import { YemotRouterService, BaseYemotHandlerService, describeYemotValues } from '../yemot-router.service';
import { YemotCallTrackingService } from '../yemot-call-tracking.service';

// End-to-end: real Express + yemot-router2 + sqlite, no mocks. Exercises the
// actual /yemot/handle-call and /yemot/handle-call/:secret mounts the way
// setupYemotRouter() wires them, to prove the migration-flag flip and the
// legacy-route cutoff work over real HTTP, not just against a mocked Call.
class StubHandler extends BaseYemotHandlerService {
  async processCall() {
    await this.getUserByDidPhone();
    if (this.user) {
      await this.hangupWithMessage('ok');
    }
  }
}

function requiredYemotFields(overrides: Record<string, string>) {
  return { ApiPhone: '0501234567', ApiDID: '035586526', ApiExtension: '', ApiCallId: 'call-1', ...overrides };
}

describe('Yemot router (e2e)', () => {
  let ds: DataSource;
  let app: express.Express;

  beforeEach(async () => {
    ds = await createRealDataSource();
    const tracker = new YemotCallTrackingService(ds as any);
    const routerService = new YemotRouterService(ds, StubHandler as any, tracker);
    jwtConstants.secret = 'test-jwt-secret';
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    const router = routerService.getRouter();
    app.use('/yemot/simulate', routerService.getSimulatorAuthMiddleware(), router);
    app.use('/yemot/handle-call/:secret', router);
    app.use('/yemot/handle-call', router);
  });

  afterEach(async () => {
    delete process.env.YEMOT_LEGACY_ROUTE_DEADLINE;
    await ds.destroy();
  });

  it('marks the user migrated after a call on the secured path with the right token', async () => {
    const user = await ds.getRepository(User).save({
      name: 'Test', phoneNumber: '035586526',
      additionalData: { yemotWebhookToken: 'secret-token' },
    } as any);

    await request(app).post('/yemot/handle-call/secret-token').send(requiredYemotFields({})).type('form').expect(200);

    const updated = await ds.getRepository(User).findOneBy({ id: user.id });
    expect(updated.additionalData.yemotUrlMigrated).toBe(true);
  });

  it('marks the user not migrated after a call on the legacy path', async () => {
    const user = await ds.getRepository(User).save({
      name: 'Test', phoneNumber: '035586526',
      additionalData: { yemotWebhookToken: 'secret-token', yemotUrlMigrated: true },
    } as any);

    await request(app).post('/yemot/handle-call').send(requiredYemotFields({})).type('form').expect(200);

    const updated = await ds.getRepository(User).findOneBy({ id: user.id });
    expect(updated.additionalData.yemotUrlMigrated).toBe(false);
  });

  it('does not migrate a call on the secured path with the wrong token', async () => {
    const user = await ds.getRepository(User).save({
      name: 'Test', phoneNumber: '035586526',
      additionalData: { yemotWebhookToken: 'secret-token' },
    } as any);

    await request(app).post('/yemot/handle-call/wrong-token').send(requiredYemotFields({})).type('form').expect(200);

    const updated = await ds.getRepository(User).findOneBy({ id: user.id });
    expect(updated.additionalData.yemotUrlMigrated).toBeFalsy();
  });

  it('rejects a legacy-path call past YEMOT_LEGACY_ROUTE_DEADLINE without reaching the handler', async () => {
    process.env.YEMOT_LEGACY_ROUTE_DEADLINE = '2000-01-01';
    const processCallSpy = jest.spyOn(StubHandler.prototype, 'processCall');

    await request(app).post('/yemot/handle-call').send(requiredYemotFields({})).type('form').expect(200);

    expect(processCallSpy).not.toHaveBeenCalled();
    processCallSpy.mockRestore();
  });

  it('still allows a secured-path call past YEMOT_LEGACY_ROUTE_DEADLINE', async () => {
    process.env.YEMOT_LEGACY_ROUTE_DEADLINE = '2000-01-01';
    await ds.getRepository(User).save({
      name: 'Test', phoneNumber: '035586526',
      additionalData: { yemotWebhookToken: 'secret-token' },
    } as any);
    const processCallSpy = jest.spyOn(StubHandler.prototype, 'processCall');

    await request(app).post('/yemot/handle-call/secret-token').send(requiredYemotFields({})).type('form').expect(200);

    expect(processCallSpy).toHaveBeenCalled();
    processCallSpy.mockRestore();
  });

  it('logs each Yemot request with its answers and the exact response sent', async () => {
    await ds.getRepository(User).save({ name: 'Test', phoneNumber: '035586526' } as any);
    const logSpy = jest.spyOn(Logger.prototype, 'log');

    const res = await request(app).post('/yemot/handle-call').send(requiredYemotFields({ val_2: '7', val_1: '872' })).type('form').expect(200);

    const lines = logSpy.mock.calls.map(([message]) => message);
    expect(lines).toContain('Yemot request call-1: val_1=872 val_2=7');
    expect(lines).toContain(`Yemot response call-1: ${res.text}`);
    logSpy.mockRestore();
  });

  it('logs the answers Yemot carries on a hangup request', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');

    await request(app).post('/yemot/handle-call').send(requiredYemotFields({ val_1: '872', hangup: 'yes' })).type('form').expect(200);

    const lines = logSpy.mock.calls.map(([message]) => message);
    expect(lines).toContain('Yemot request call-1: val_1=872 hangup=yes');
    expect(lines).toContain('Yemot response call-1: {"message":"hangup"}');
    logSpy.mockRestore();
  });

  describe('describeYemotValues', () => {
    it('orders answers numerically, keeps the last duplicate, and ignores Api fields', () => {
      expect(describeYemotValues({ ApiPhone: '050', val_10: 'b', val_2: ['x', 'a'], hangup: 'yes' })).toBe('val_2=a val_10=b hangup=yes');
    });

    it('says when there are no answers', () => {
      expect(describeYemotValues({ ApiCallId: 'c' })).toBe('(no answers)');
    });
  });

  describe('simulator mount', () => {
    function authCookie(payload: Record<string, any>) {
      const token = new JwtService({ secret: jwtConstants.secret }).sign(payload);
      return `Authentication=${token}`;
    }

    async function saveUser(additionalData: Record<string, any> = {}) {
      return ds.getRepository(User).save({
        name: 'Test', phoneNumber: '035586526',
        additionalData: { yemotWebhookToken: 'secret-token', ...additionalData },
      } as any);
    }

    it('lets an admin simulate any system past YEMOT_LEGACY_ROUTE_DEADLINE', async () => {
      process.env.YEMOT_LEGACY_ROUTE_DEADLINE = '2000-01-01';
      await saveUser();
      const processCallSpy = jest.spyOn(StubHandler.prototype, 'processCall');

      await request(app).post('/yemot/simulate')
        .set('Cookie', authCookie({ id: 1, permissions: { admin: true } }))
        .send(requiredYemotFields({})).expect(200);

      expect(processCallSpy).toHaveBeenCalled();
      processCallSpy.mockRestore();
    });

    it('lets a user with the simulator permission simulate their own system', async () => {
      process.env.YEMOT_LEGACY_ROUTE_DEADLINE = '2000-01-01';
      const user = await saveUser();
      const processCallSpy = jest.spyOn(StubHandler.prototype, 'processCall');

      await request(app).post('/yemot/simulate')
        .set('Cookie', authCookie({ id: user.id, permissions: { yemotSimulator: true } }))
        .send(requiredYemotFields({})).expect(200);

      expect(processCallSpy).toHaveBeenCalled();
      processCallSpy.mockRestore();
    });

    it('rejects a user simulating another system number', async () => {
      const user = await saveUser();

      await request(app).post('/yemot/simulate')
        .set('Cookie', authCookie({ id: user.id, permissions: { yemotSimulator: true } }))
        .send(requiredYemotFields({ ApiDID: '039999999' })).expect(403);
    });

    it('rejects a user without the simulator permission', async () => {
      const user = await saveUser();

      await request(app).post('/yemot/simulate')
        .set('Cookie', authCookie({ id: user.id, permissions: {} }))
        .send(requiredYemotFields({})).expect(403);
    });

    it('rejects a request without a valid session cookie', async () => {
      await saveUser();

      await request(app).post('/yemot/simulate').send(requiredYemotFields({})).expect(401);
      await request(app).post('/yemot/simulate')
        .set('Cookie', 'Authentication=not-a-jwt')
        .send(requiredYemotFields({})).expect(401);
    });

    it('leaves the migration flag alone', async () => {
      const migrated = await saveUser({ yemotUrlMigrated: true });

      await request(app).post('/yemot/simulate')
        .set('Cookie', authCookie({ id: 1, permissions: { admin: true } }))
        .send(requiredYemotFields({})).expect(200);

      const updated = await ds.getRepository(User).findOneBy({ id: migrated.id });
      expect(updated.additionalData.yemotUrlMigrated).toBe(true);
    });
  });
});
