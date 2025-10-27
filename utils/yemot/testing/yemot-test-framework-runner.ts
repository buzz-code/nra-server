/**
 * Generic Yemot Testing Framework - Runner Base Class
 * 
 * This module provides a base runner class for executing test scenarios.
 * Project-specific implementations should extend this class to add entity-specific
 * repository mocking and service execution logic.
 */

import { MessageMatcher } from './yemot-test-framework.types';

/**
 * Message matching utility functions
 */
export class MessageMatcherUtils {
  /**
   * Verify message matches expectation
   */
  static matchMessage(actual: string, expected: MessageMatcher): boolean {
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
   * Extract message text from call arguments
   */
  static extractMessageFromArgs(args: any[]): string {
    if (!args || !args[0]) return '';
    const messages = Array.isArray(args[0]) ? args[0] : [args[0]];
    return messages
      .map((msg) => {
        if (typeof msg === 'string') return msg;
        if (msg.type === 'text') return msg.data;
        if (msg.type === 'file') return `[File: ${msg.data}]`;
        return '';
      })
      .join(' ');
  }
}

/**
 * Base test scenario runner
 */
export abstract class GenericScenarioRunner<TScenario, TContext, TSetup> {
  protected context: TContext;

  /**
   * Execute a complete test scenario
   */
  async runScenario(scenario: TScenario): Promise<TContext> {
    // 1. Setup test context and mocks
    this.context = await this.setupTestContext(this.getSetup(scenario));

    // 2. Setup mock call responses based on scenario steps
    this.setupMockCallResponses(this.getSteps(scenario));

    // 3. Execute the service
    await this.executeService();

    // 4. Validate expected results
    await this.validateResults(scenario);

    return this.context;
  }

  /**
   * Setup test context with mocks and dependencies - must be implemented by subclass
   */
  protected abstract setupTestContext(setup: TSetup): Promise<TContext>;

  /**
   * Execute the service being tested - must be implemented by subclass
   */
  protected abstract executeService(): Promise<void>;

  /**
   * Validate results against expected outcomes - must be implemented by subclass
   */
  protected abstract validateResults(scenario: TScenario): Promise<void>;

  /**
   * Get setup from scenario - must be implemented by subclass
   */
  protected abstract getSetup(scenario: TScenario): TSetup;

  /**
   * Get steps from scenario - must be implemented by subclass
   */
  protected abstract getSteps(scenario: TScenario): any[];

  /**
   * Setup mock call responses to return predefined user inputs
   */
  protected setupMockCallResponses(steps: any[]): void {
    const mockCall = this.getMockCall();
    const readMock = jest.fn();

    // For each step that expects user input, queue the response
    for (const step of steps) {
      if (step.userResponse !== undefined) {
        readMock.mockResolvedValueOnce(step.userResponse);
      }
    }

    mockCall.read = readMock;

    // Track all call interactions
    const originalRead = mockCall.read;
    mockCall.read = jest.fn(async (...args) => {
      const result = await originalRead(...args);
      this.trackInteraction({
        type: 'read',
        message: MessageMatcherUtils.extractMessageFromArgs(args),
        response: result,
        options: args[2],
      });
      return result;
    });

    const originalIdListMessage = mockCall.id_list_message;
    mockCall.id_list_message = jest.fn((...args) => {
      this.trackInteraction({
        type: 'id_list_message',
        message: MessageMatcherUtils.extractMessageFromArgs(args),
      });
      return originalIdListMessage?.(...args);
    });

    const originalHangup = mockCall.hangup;
    mockCall.hangup = jest.fn(() => {
      this.trackInteraction({
        type: 'hangup',
      });
      return originalHangup?.();
    });
  }

  /**
   * Get mock call from context - must be implemented by subclass
   */
  protected abstract getMockCall(): any;

  /**
   * Track interaction in context - must be implemented by subclass
   */
  protected abstract trackInteraction(interaction: any): void;
}
