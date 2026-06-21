import { Scenario, ScenarioStep, SeedConfig, MessageMatcher } from './scenario-types';

/**
 * YemotScenarioBuilder — fluent API for building IVR test scenarios.
 *
 * Usage:
 *   const scenario = new YemotScenarioBuilder('Happy path')
 *     .seed('User', [{ id: 1, phoneNumber: '...' }])
 *     .systemAsks(/enter.*id/i)
 *     .userResponds('123456789')
 *     .systemHangsUp(/success/i)
 *     .build();
 */
export class YemotScenarioBuilder {
  private name: string;
  private seedConfig: SeedConfig = {};
  private steps: ScenarioStep[] = [];

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Seed data into the real database before the scenario runs.
   * @param entityName — TypeORM entity class name (e.g. 'User', 'Student')
   * @param rows — Array of entity objects to insert
   */
  seed(entityName: string, rows: any[]): this {
    this.seedConfig[entityName] = rows;
    return this;
  }

  /**
   * System sends a message (id_list_message) — no user response expected.
   * @param msg — Optional message matcher. If omitted, validates that *something* was sent.
   */
  systemSends(msg?: MessageMatcher): this {
    this.steps.push({
      type: 'send_message',
      expectedMessage: msg,
      skipMessageValidation: !msg,
    });
    return this;
  }

  /**
   * System asks for input (read). Must be followed by userResponds().
   * @param msg — Message matcher for the prompt
   */
  systemAsks(msg: MessageMatcher): this {
    this.steps.push({
      type: 'ask_input',
      expectedMessage: msg,
    });
    return this;
  }

  /**
   * User provides input. Must follow systemAsks() or systemAsksConfirmation().
   * @param input — What the user types on the IVR keypad
   */
  userResponds(input: string): this {
    const lastStep = this.steps[this.steps.length - 1];
    if (!lastStep || (lastStep.type !== 'ask_input' && lastStep.type !== 'confirmation')) {
      throw new Error(
        `userResponds() must follow systemAsks() or systemAsksConfirmation(). ` +
        `Last step was: ${lastStep?.type || 'none'}`
      );
    }
    lastStep.userResponse = input;
    return this;
  }

  /**
   * System asks a yes/no confirmation. User responds with 1 (yes) or 2 (no).
   * @param msg — Message matcher for the confirmation prompt
   */
  systemAsksConfirmation(msg: MessageMatcher): this {
    this.steps.push({
      type: 'confirmation',
      expectedMessage: msg,
    });
    return this;
  }

  /**
   * Shorthand for userResponds(yes ? '1' : '2') after a confirmation.
   * @param yes — true for '1' (yes), false for '2' (no)
   */
  userConfirms(yes: boolean): this {
    return this.userResponds(yes ? '1' : '2');
  }

  /**
   * System hangs up with an optional message.
   * @param msg — Optional message matcher for the hangup message
   */
  systemHangsUp(msg?: MessageMatcher): this {
    this.steps.push({
      type: 'hangup_message',
      expectedMessage: msg,
      skipMessageValidation: !msg,
    });
    return this;
  }

  /**
   * Build the final Scenario object.
   */
  build(): Scenario {
    return {
      name: this.name,
      seed: this.seedConfig,
      steps: this.steps,
    };
  }
}
