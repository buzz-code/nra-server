import { YemotScenarioBuilder } from '../scenario-builder';
import { YemotScenarioRunner } from '../scenario-runner';
import { BaseYemotHandlerService } from '../../v2/yemot-router.service';

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
