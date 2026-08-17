import * as express from 'express';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { User } from '@shared/entities/User.entity';
import { createRealDataSource } from '../../testing/real-data-source';
import { YemotRouterService, BaseYemotHandlerService } from '../yemot-router.service';
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
    app = express();
    const router = routerService.getRouter();
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
});
