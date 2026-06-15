import { DataSource } from 'typeorm';
import { Scenario, ScenarioResult, ScenarioStep, MessageMatcher } from './scenario-types';
import { MockCall, MockExitError, YemotMessage } from './mock-call';
import { createRealDataSource } from './real-data-source';
import { BaseYemotHandlerService } from '../v2/yemot-router.service';

/**
 * Constructor type for Yemot handler services.
 */
export type YemotHandlerConstructor = new (
  dataSource: DataSource,
  call: any,
  callTracker: any,
) => BaseYemotHandlerService;

/**
 * YemotScenarioRunner — executes a Scenario against a real TypeORM DataSource.
 *
 * Usage:
 *   const runner = new YemotScenarioRunner(YemotHandlerService);
 *   const result = await runner.run(scenario);
 *   expect(result.passed).toBe(true);
 */
export class YemotScenarioRunner {
  private HandlerClass: YemotHandlerConstructor;

  constructor(HandlerClass: YemotHandlerConstructor) {
    this.HandlerClass = HandlerClass;
  }

  /**
   * Execute a scenario end-to-end:
   * 1. Create real sql.js DataSource
   * 2. Seed data
   * 3. Create MockCall with user inputs
   * 4. Instantiate handler
   * 5. Run processCall()
   * 6. Validate messages against steps
   * 7. Query DB for saved entities
   * 8. Return ScenarioResult
   */
  async run(scenario: Scenario): Promise<ScenarioResult> {
    const ds = await createRealDataSource();

    try {
      // 1. Seed data
      await this.seedData(ds, scenario.seed);

      // 2. Create MockCall and program inputs
      const call = this.createMockCall(scenario);

      // 3. Create mock call tracker
      const tracker = this.createMockTracker();

      // 4. Instantiate handler
      const handler = new this.HandlerClass(ds, call as any, tracker);

      // 5. Execute
      const interactionHistory: ScenarioResult['interactionHistory'] = [];
      try {
        await handler.processCall();
      } catch (e: any) {
        if (e instanceof MockExitError) {
          // Expected: call terminated normally
        } else if (call.wasHungup()) {
          // Also expected: read after hangup, etc.
        } else {
          throw e; // Real error — re-throw
        }
      }

      // 6. Build interaction history from MockCall records
      for (const r of call.getResponses()) {
        if (r.type === 'read') {
          interactionHistory.push({
            type: 'read',
            message: this.extractMessageText(r.messages),
            response: this.getInputForResponse(call, r),
          });
        } else if (r.type === 'id_list_message') {
          interactionHistory.push({
            type: r.opts?.prependToNextAction ? 'id_list_message' : 'hangup',
            message: this.extractMessageText(r.messages),
          });
        }
      }

      // 7. Validate steps
      const validationResult = this.validateSteps(scenario.steps, call);

      // 8. Query post-run state for saved entities
      const saved = await this.computeSaved(ds, scenario.seed);

      return {
        passed: validationResult.passed,
        hungup: call.wasHungup(),
        messages: call.getMessages().flat(),
        saved,
        interactionHistory,
      };
    } finally {
      await ds.destroy();
    }
  }

  // ---- Private helpers ----

  /**
   * Insert seed data into the real database.
   */
  private async seedData(ds: DataSource, seed: Record<string, any[]>): Promise<void> {
    for (const [entityName, rows] of Object.entries(seed)) {
      if (rows.length > 0) {
        await ds.getRepository(entityName).save(rows);
      }
    }
  }

  /**
   * Create MockCall and program it with user responses from scenario steps.
   */
  private createMockCall(scenario: Scenario): MockCall {
    const call = new MockCall({
      ApiDID: '099999999',
      ApiPhone: '0501234567',
      ApiCallId: 'test-call-1',
    });

    // Extract user responses from ask_input and confirmation steps
    const inputs: string[] = [];
    for (const step of scenario.steps) {
      if ((step.type === 'ask_input' || step.type === 'confirmation') && step.userResponse !== undefined) {
        inputs.push(step.userResponse);
      }
    }
    call.setInputs(inputs);
    return call;
  }

  /**
   * Create a mock YemotCallTrackingService.
   */
  private createMockTracker() {
    return {
      logConversationStep: jest.fn().mockResolvedValue(undefined),
      initializeCall: jest.fn().mockResolvedValue(undefined),
      finalizeCall: jest.fn().mockResolvedValue(undefined),
      markCallError: jest.fn().mockResolvedValue(undefined),
    };
  }

  /**
   * Extract human-readable text from YemotMessage array.
   */
  private extractMessageText(messages: YemotMessage[]): string {
    return messages
      .map((m) => {
        if (m.type === 'text') return m.data;
        if (m.type === 'file') return `[File: ${m.data}]`;
        return '';
      })
      .join(' ');
  }

  /**
   * Get the user input that corresponds to a recorded read response.
   * Reads happen in order — the Nth read gets the Nth input.
   */
  private getInputForResponse(call: MockCall, response: any): string {
    const allReads = call.getResponses().filter((r: any) => r.type === 'read');
    const idx = allReads.indexOf(response);
    const inputs: string[] = (call as any).inputs || [];
    return idx >= 0 && idx < inputs.length ? inputs[idx] : '[unknown]';
  }

  /**
   * Match a message against a MessageMatcher.
   */
  private matchMessage(actual: string, expected: MessageMatcher): boolean {
    if (typeof expected === 'string') {
      return actual === expected;
    }
    if (expected instanceof RegExp) {
      return expected.test(actual);
    }
    if (typeof expected === 'function') {
      return expected(actual);
    }
    if (typeof expected === 'object') {
      if ('contains' in expected) {
        return actual.includes(expected.contains);
      }
      if ('startsWith' in expected) {
        return actual.startsWith(expected.startsWith);
      }
      if ('endsWith' in expected) {
        return actual.endsWith(expected.endsWith);
      }
    }
    return false;
  }

  /**
   * Validate recorded call actions against scenario steps.
   */
  private validateSteps(
    steps: ScenarioStep[],
    call: MockCall,
  ): { passed: boolean; failureMessage?: string } {
    const responses = call.getResponses();
    let respIdx = 0;

    for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
      const step = steps[stepIdx];

      if (respIdx >= responses.length) {
        return {
          passed: false,
          failureMessage: `Step ${stepIdx + 1} FAILED: Expected ${step.type}, but no more call actions recorded`,
        };
      }

      const resp = responses[respIdx];

      switch (step.type) {
        case 'send_message': {
          if (resp.type !== 'id_list_message') {
            return {
              passed: false,
              failureMessage: `Step ${stepIdx + 1} FAILED: Expected send_message (id_list_message), but got ${resp.type}`,
            };
          }
          if (!step.skipMessageValidation && step.expectedMessage) {
            const actual = this.extractMessageText(resp.messages);
            if (!this.matchMessage(actual, step.expectedMessage)) {
              return {
                passed: false,
                failureMessage: `Step ${stepIdx + 1} FAILED: Expected message matching ${step.expectedMessage}. Actual: "${actual}"`,
              };
            }
          }
          respIdx++;
          break;
        }

        case 'ask_input':
        case 'confirmation': {
          if (resp.type !== 'read') {
            if (resp.type === 'id_list_message' && !resp.opts?.prependToNextAction) {
              return {
                passed: false,
                failureMessage: `Step ${stepIdx + 1} FAILED: Expected read(), but call was hung up`,
              };
            }
            return {
              passed: false,
              failureMessage: `Step ${stepIdx + 1} FAILED: Expected read(), but got ${resp.type}`,
            };
          }
          if (!step.skipMessageValidation && step.expectedMessage) {
            const actual = this.extractMessageText(resp.messages);
            if (!this.matchMessage(actual, step.expectedMessage)) {
              return {
                passed: false,
                failureMessage: `Step ${stepIdx + 1} FAILED: Expected message matching ${step.expectedMessage}. Actual: "${actual}"`,
              };
            }
          }
          respIdx++;
          break;
        }

        case 'hangup_message': {
          // hangupWithMessage() calls id_list_message(prependToNextAction:true) then hangup()
          // Direct hangup() produces no response entry
          if (resp.type === 'id_list_message') {
            if (!step.skipMessageValidation && step.expectedMessage) {
              const actual = this.extractMessageText(resp.messages);
              if (!this.matchMessage(actual, step.expectedMessage)) {
                return {
                  passed: false,
                  failureMessage: `Step ${stepIdx + 1} FAILED: Expected hangup message matching ${step.expectedMessage}. Actual: "${actual}"`,
                };
              }
            }
            respIdx++;
          } else {
            if (!step.skipMessageValidation && step.expectedMessage) {
              return {
                passed: false,
                failureMessage: `Step ${stepIdx + 1} FAILED: Expected hangup with message, but hangup() was called without one`,
              };
            }
          }
          break;
        }
      }
    }

    // Check for unexpected extra actions
    if (respIdx < responses.length) {
      const extra = responses[respIdx];
      return {
        passed: false,
        failureMessage: `Unexpected ${extra.type} after step ${steps.length}: handler sent "${this.extractMessageText(extra.messages || [])}" but scenario has no more steps`,
      };
    }

    return { passed: true };
  }

  /**
   * Compute saved entities: query all tracked tables post-run,
   * subtract seed rows, return only what the handler added.
   */
  private async computeSaved(
    ds: DataSource,
    seed: Record<string, any[]>,
  ): Promise<Record<string, any[]>> {
    const saved: Record<string, any[]> = {};
    for (const entityName of Object.keys(seed)) {
      try {
        const allRows = await ds.getRepository(entityName).find();
        const seedCount = seed[entityName]?.length || 0;
        if (allRows.length > seedCount) {
          saved[entityName] = allRows.slice(seedCount);
        } else {
          saved[entityName] = [];
        }
      } catch {
        saved[entityName] = [];
      }
    }
    return saved;
  }
}
