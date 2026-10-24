import * as express from 'express';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { User } from '@shared/entities/User.entity';
import { YemotCall } from '@shared/entities/YemotCall.entity';
import { createRealDataSource } from '../../testing/real-data-source';
import { YemotRouterService, BaseYemotHandlerService } from '../yemot-router.service';
import { YemotCallTrackingService } from '../yemot-call-tracking.service';
import { CallSuspended } from '../yemot-replay';

// End-to-end: two independent router instances (= two server nodes) sharing one
// database, with a call's requests alternating between them. Proves a stateless
// handler finishes correctly when no node sees the whole call.
class ReplayHandler extends BaseYemotHandlerService {
  static stateless = true;
  static rolls = 0;
  static writes = 0;
  static endings: string[] = [];

  async processCall() {
    await this.getUserByDidPhone();
    if (!this.user) return;
    try {
      const roll = await this.once('roll', () => ++ReplayHandler.rolls);
      await this.sendMessage(`roll ${roll}`);
      const first = await this.askForInput('first');
      await this.once('write', () => {
        ReplayHandler.writes++;
      });
      await this.sendMessage(`got ${first}`);
      const second = await this.askForInput('second');
      await this.hangupWithMessage(`done ${first} ${second}`);
    } catch (e) {
      if (!(e instanceof CallSuspended)) ReplayHandler.endings.push(e.name);
      throw e;
    }
  }
}

// yemot-router2 answers a hangup=yes request at once and runs the 'call_hangup'
// listener (where the replay happens) in the background.
async function waitForHangupHandling(isDone: () => Promise<boolean>) {
  for (let i = 0; i < 50 && !(await isDone()); i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function createNode(ds: DataSource) {
  const routerService = new YemotRouterService(ds, ReplayHandler as any, new YemotCallTrackingService(ds as any));
  const app = express();
  app.use('/yemot/handle-call', routerService.getRouter());
  return app;
}

describe('Yemot stateless replay (e2e, two nodes)', () => {
  let ds: DataSource;
  let nodeA: express.Express;
  let nodeB: express.Express;
  let values: Record<string, string>;

  const post = (node: express.Express, extra: Record<string, string> = {}) =>
    request(node).post('/yemot/handle-call').type('form').send({ ...values, ...extra }).expect(200);

  beforeEach(async () => {
    ds = await createRealDataSource();
    await ds.getRepository(User).save({ name: 'Test', phoneNumber: '035586526' } as any);
    nodeA = createNode(ds);
    nodeB = createNode(ds);
    values = { ApiPhone: '0501234567', ApiDID: '035586526', ApiExtension: '', ApiCallId: 'call-1' };
    ReplayHandler.rolls = 0;
    ReplayHandler.writes = 0;
    ReplayHandler.endings = [];
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('finishes a call whose requests alternate between nodes', async () => {
    const first = await post(nodeA);
    expect(first.text).toBe('id_list_message=t-roll 1&read=t-first=val_1,no,,1,7,No,no,no,,,,,None,');

    values.val_1 = '5';
    const second = await post(nodeB);
    // already-played messages are not replayed to the caller
    expect(second.text).toBe('id_list_message=t-got 5&read=t-second=val_2,no,,1,7,No,no,no,,,,,None,');

    values.val_2 = '7';
    const third = await post(nodeA);
    expect(third.text).toBe('id_list_message=t-done 5 7&go_to_folder=hangup');

    expect(ReplayHandler.rolls).toBe(1);
    expect(ReplayHandler.writes).toBe(1);
    expect(ReplayHandler.endings).toEqual(['ExitError']);

    const yemotCall = await ds.getRepository(YemotCall).findOneBy({ apiCallId: 'call-1' });
    expect(yemotCall.isOpen).toBe(false);
    expect(yemotCall.history.map((step) => step.params.stepType)).toEqual([
      'send_message', 'ask_input', 'user_input', 'send_message', 'ask_input', 'user_input', 'hangup_message',
    ]);

    // Yemot still sends hangup=yes after we hung up - the finished call isn't replayed again
    const isCallOpen = jest.spyOn(YemotCallTrackingService.prototype, 'isCallOpen');
    await post(nodeB, { hangup: 'yes' });
    await waitForHangupHandling(async () => isCallOpen.mock.results.length > 0 && (await isCallOpen.mock.results[0].value) === false);
    isCallOpen.mockRestore();
    expect(ReplayHandler.endings).toEqual(['ExitError']);

    // ...but its hangup time is kept: when the caller's audio really stopped
    const hungUp = () => ds.getRepository(YemotCall).findOneBy({ apiCallId: 'call-1' });
    await waitForHangupHandling(async () => Boolean((await hungUp()).data.hangupTime));
    expect((await hungUp()).data.hangupTime).toEqual(expect.any(String));
  });

  it('runs the handler once more with HangupError when the caller hangs up mid-call', async () => {
    await post(nodeA);
    values.val_1 = '5';
    await post(nodeB);

    await post(nodeA, { hangup: 'yes' });
    await waitForHangupHandling(async () => !(await ds.getRepository(YemotCall).findOneBy({ apiCallId: 'call-1' })).isOpen);

    expect(ReplayHandler.endings).toEqual(['HangupError']);
    expect(ReplayHandler.writes).toBe(1);
    const yemotCall = await ds.getRepository(YemotCall).findOneBy({ apiCallId: 'call-1' });
    expect(yemotCall.isOpen).toBe(false);
  });
});
