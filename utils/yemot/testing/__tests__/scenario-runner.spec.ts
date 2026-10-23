import { YemotScenarioBuilder } from '../scenario-builder';
import { YemotScenarioRunner } from '../scenario-runner';
import { BaseYemotHandlerService } from '../../v2/yemot-router.service';
import { User } from '../../../../entities/User.entity';

/**
 * Minimal fake handler for integration testing the runner.
 */
class FakeHandler extends BaseYemotHandlerService {
  override async processCall(): Promise<void> {
    await this.getUserByDidPhone();
    const name = await this.askForInput('What is your name?', { max_digits: 10 });
    const age = await this.askForInput('What is your age?', { max_digits: 2 });
    const confirmed = await this.askForInput('Confirm? 1=yes, 2=no', { max_digits: 1 });
    await this.hangupWithMessage(`Thank you ${name}, age ${age}, confirmed: ${confirmed}`);
  }
}

describe('YemotScenarioRunner', () => {
  it('should run a simple scenario end-to-end', async () => {
    const scenario = new YemotScenarioBuilder('Fake handler test')
      .seed('User', [{ id: 1, phoneNumber: '099999999', name: 'Test User' }])
      .systemAsks('What is your name?')
      .userResponds('John')
      .systemAsks('What is your age?')
      .userResponds('25')
      .systemAsks('Confirm? 1=yes, 2=no')
      .userResponds('1')
      .systemHangsUp(/Thank you John/)
      .build();

    const runner = new YemotScenarioRunner(FakeHandler as any);
    const result = await runner.run(scenario);

    expect(result.passed).toBe(true);
    expect(result.hungup).toBe(true);
  });

  it('should fail when message does not match', async () => {
    const scenario = new YemotScenarioBuilder('Mismatch test')
      .seed('User', [{ id: 1, phoneNumber: '099999999', name: 'Test User' }])
      .systemAsks('Wrong question text')
      .userResponds('John')
      .systemHangsUp()
      .build();

    const runner = new YemotScenarioRunner(FakeHandler as any);
    const result = await runner.run(scenario);

    expect(result.passed).toBe(false);
  });

  it('should support regex message matching', async () => {
    const scenario = new YemotScenarioBuilder('Regex test')
      .seed('User', [{ id: 1, phoneNumber: '099999999', name: 'Test User' }])
      .systemAsks(/what.*name/i)
      .userResponds('Alice')
      .systemAsks(/age/i)
      .userResponds('30')
      .systemAsks(/confirm/i)
      .userResponds('2')
      .systemHangsUp(/Thank you Alice/)
      .build();

    const runner = new YemotScenarioRunner(FakeHandler as any);
    const result = await runner.run(scenario);

    expect(result.passed).toBe(true);
  });

  it('should fail when handler hangs up too early', async () => {
    class EarlyHangupHandler extends BaseYemotHandlerService {
      override async processCall(): Promise<void> {
        await this.getUserByDidPhone();
        await this.hangupWithMessage('Goodbye early');
      }
    }

    const scenario = new YemotScenarioBuilder('Early hangup')
      .seed('User', [{ id: 1, phoneNumber: '099999999', name: 'Test User' }])
      .systemAsks(/what.*name/i)
      .userResponds('John')
      .systemHangsUp()
      .build();

    const runner = new YemotScenarioRunner(EarlyHangupHandler as any);
    const result = await runner.run(scenario);

    expect(result.passed).toBe(false);
  });
});

/**
 * Stateless handlers that write mid-call: with and without once().
 */
class MidCallWriteHandler extends BaseYemotHandlerService {
  static stateless = true;
  static useOnce = true;

  override async processCall(): Promise<void> {
    await this.getUserByDidPhone();
    const name = await this.askForInput('What is your name?');
    const save = () => this.dataSource.getRepository(User).save({ name, phoneNumber: '0500000000' });
    if (MidCallWriteHandler.useOnce) {
      await this.once('saveUser', save);
    } else {
      await save();
    }
    await this.askForInput('What is your age?');
    await this.hangupWithMessage('Thanks');
  }
}

describe('YemotScenarioRunner with a stateless handler', () => {
  const scenario = () =>
    new YemotScenarioBuilder('Mid-call write')
      .seed('User', [{ id: 1, phoneNumber: '099999999', name: 'Test User' }])
      .systemAsks('What is your name?')
      .userResponds('John')
      .systemAsks('What is your age?')
      .userResponds('25')
      .systemHangsUp('Thanks')
      .build();

  it('writes once across the replayed requests when the write goes through once()', async () => {
    MidCallWriteHandler.useOnce = true;
    const result = await new YemotScenarioRunner(MidCallWriteHandler as any).run(scenario());

    expect(result.passed).toBe(true);
    expect(result.saved.User).toHaveLength(1);
  });

  it('exposes a mid-call write that is repeated by a replayed request', async () => {
    MidCallWriteHandler.useOnce = false;
    const result = await new YemotScenarioRunner(MidCallWriteHandler as any).run(scenario());

    expect(result.saved.User).toHaveLength(2);
  });
});
