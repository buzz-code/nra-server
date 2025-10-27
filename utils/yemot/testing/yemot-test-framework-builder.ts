/**
 * Generic Yemot Testing Framework - Builder Base Class
 * 
 * This module provides a base builder class for creating test scenarios with method chaining.
 * Project-specific implementations should extend this class to add domain-specific helper methods.
 */

import { GenericScenarioStep, MessageMatcher } from './yemot-test-framework.types';

/**
 * Base scenario builder with core step-building methods
 */
export abstract class GenericScenarioBuilder<TScenario, TSetup> {
  protected scenario: Partial<TScenario> = {};
  protected setupData: Partial<TSetup> = {};

  constructor(name: string) {
    (this.scenario as any).name = name;
    (this.scenario as any).steps = [];
  }

  /**
   * Add a step to the scenario
   */
  protected addStep(step: GenericScenarioStep): this {
    const steps = (this.scenario as any).steps || [];
    steps.push(step);
    (this.scenario as any).steps = steps;
    return this;
  }

  /**
   * Add interaction: system sends message (no response expected)
   */
  systemSends(message?: MessageMatcher, description?: string): this {
    return this.addStep({
      type: 'send_message',
      expectedMessage: message,
      description,
      skipMessageValidation: !message,
    });
  }

  /**
   * Add interaction: system asks for input
   */
  systemAsks(message: MessageMatcher, userResponse: string, description?: string): this {
    return this.addStep({
      type: 'ask_input',
      expectedMessage: message,
      userResponse,
      description,
    });
  }

  /**
   * Add interaction: system asks confirmation
   */
  systemAsksConfirmation(message: MessageMatcher, userConfirms: boolean, description?: string): this {
    return this.addStep({
      type: 'confirmation',
      expectedMessage: message,
      userResponse: userConfirms ? '1' : '2',
      description,
    });
  }

  /**
   * Add interaction: system hangs up with message
   */
  systemHangsUp(message?: MessageMatcher, description?: string): this {
    return this.addStep({
      type: 'hangup_message',
      expectedMessage: message,
      description,
      skipMessageValidation: !message,
    });
  }

  /**
   * Build the final scenario - must be implemented by subclass
   */
  abstract build(): TScenario;
}
