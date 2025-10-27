/**
 * Generic Yemot Testing Framework - Runner Base Class
 * 
 * This module provides a base runner class for executing test scenarios.
 * Project-specific implementations should extend this class to add entity-specific
 * repository mocking and service execution logic.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Call } from 'yemot-router2';
import { MessageMatcher } from './yemot-test-framework.types';
import { RepositoryMockBuilder, getEntityKey } from '../../testing/repository-mock-builder';
import { YemotCallTrackingService } from '../v2/yemot-call-tracking.service';
import { BaseYemotHandlerService } from '../v2/yemot-router.service';

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
 * Base scenario interface - defines minimum required properties
 */
export interface BaseScenario<TSetup = any> {
  setup: TSetup;
  steps: any[];
  expectedResult?: {
    callEnded?: boolean;
    customValidation?: (context: any) => void | Promise<void>;
  };
}

/**
 * Base context interface - defines minimum required properties
 * TService extends BaseYemotHandlerService, TCall is from yemot-router2
 */
export interface BaseContext<
  TService extends BaseYemotHandlerService = BaseYemotHandlerService,
  TCall extends Call = Call
> {
  call: TCall;
  service: TService;
  interactionHistory: Array<{
    type: 'read' | 'id_list_message' | 'hangup';
    message?: string;
    response?: string;
    options?: any;
  }>;
}

/**
 * Base test scenario runner
 */
export abstract class GenericScenarioRunner<
  TScenario extends BaseScenario<TSetup>,
  TContext extends BaseContext,
  TSetup
> {
  protected context: TContext;
  protected currentSetup: TSetup;

  /**
   * Constructor - optionally provide service class for automatic instantiation
   */
  constructor(protected serviceClass?: typeof BaseYemotHandlerService) {}

  /**
   * Execute a complete test scenario
   */
  async runScenario(scenario: TScenario): Promise<TContext> {
    // 1. Setup test context and mocks
    this.context = await this.setupTestContext(scenario.setup);

    // 2. Setup mock call responses based on scenario steps
    this.setupMockCallResponses(scenario.steps);

    // 3. Execute the service
    await this.executeService();

    // 4. Validate expected results
    await this.validateResults(scenario);

    return this.context;
  }

  /**
   * Setup test context with mocks and dependencies - FULLY GENERIC!
   */
  protected async setupTestContext(setup: TSetup): Promise<TContext> {
    // Store setup for access in repository callbacks
    this.currentSetup = setup;

    // Create mock repositories using builder
    const repositories = this.createMockRepositories(setup);

    // Create mock DataSource with automatic entity mapping
    const mockDataSource = this.createMockDataSource(repositories);

    // Create mock call tracker (generic structure)
    const mockCallTracker = this.createMockCallTracker();

    // Create mock call object
    const mockCall = this.createMockCall(setup);

    // Create test module with DataSource
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    const dataSource = module.get<DataSource>(getDataSourceToken());

    // Create service instance (subclass provides the class and dependencies)
    const service = this.createService(dataSource, mockCall, mockCallTracker);

    // Build final context
    return this.buildContext(setup, repositories, mockCall, service);
  }

  /**
   * Build test context - default implementation
   * Override if you need additional context properties
   */
  protected buildContext(setup: TSetup, repositories: any, call: any, service: any): TContext {
    return {
      call,
      service,
      repositories,
      currentStepIndex: 0,
      interactionHistory: [],
      setup,
    } as unknown as TContext;
  }

  /**
   * Create mock repositories - uses builder pattern
   */
  protected createMockRepositories(setup: TSetup): any {
    const builder = new RepositoryMockBuilder(setup, this.context);
    return this.defineRepositories(builder);
  }

  /**
   * Create mock DataSource - automatic entity mapping
   */
  protected createMockDataSource(repositories: any): any {
    return {
      getRepository: jest.fn((entity) => {
        const entityKey = getEntityKey(entity);
        return repositories[entityKey] || {};
      }),
    };
  }

  /**
   * Create mock call tracker - uses shared YemotCallTrackingService
   */
  protected createMockCallTracker(): YemotCallTrackingService {
    return {
      logConversationStep: jest.fn().mockResolvedValue(undefined),
      initializeCall: jest.fn().mockResolvedValue(undefined),
      finalizeCall: jest.fn().mockResolvedValue(undefined),
      markCallError: jest.fn().mockResolvedValue(undefined),
    } as unknown as YemotCallTrackingService;
  }

  /**
   * Create mock call - basic implementation with common mocked methods
   * Override to customize did, phone, and ApiPhone properties
   */
  protected createMockCall(setup: TSetup): Call {
    return {
      callId: 'test-call-' + Date.now(),
      did: 'test-did',
      phone: 'test-phone',
      ApiPhone: 'test-phone',
      read: jest.fn(),
      id_list_message: jest.fn(),
      hangup: jest.fn(),
    } as unknown as Call;
  }

  /**
   * Create service instance - uses serviceClass from constructor if provided
   * Override if you need custom service instantiation logic
   */
  protected createService(dataSource: any, call: any, callTracker: any): any {
    if (this.serviceClass) {
      return new this.serviceClass(dataSource, call, callTracker);
    }
    throw new Error('Either provide serviceClass in constructor or override createService()');
  }

  /**
   * Define repositories - override in subclass
   */
  protected abstract defineRepositories(builder: RepositoryMockBuilder<TSetup, TContext>): any;

  /**
   * Execute the service being tested - default implementation calls processCall()
   * Override if your service has a different entry point method
   */
  protected async executeService(): Promise<void> {
    await this.context.service.processCall();
  }

  /**
   * Validate results against expected outcomes - common validation
   * Override in subclass and call super.validateResults() for entity-specific validation
   */
  protected async validateResults(scenario: TScenario): Promise<void> {
    const expectedResult = scenario.expectedResult;

    // Validate call ended
    if (expectedResult?.callEnded) {
      expect(this.context.call.hangup).toHaveBeenCalled();
    }

    // Run custom validation
    if (expectedResult?.customValidation) {
      await expectedResult.customValidation(this.context);
    }
  }

  /**
   * Setup mock call responses to return predefined user inputs
   */
  protected setupMockCallResponses(steps: any[]): void {
    const mockCall = this.context.call;
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
      this.context.interactionHistory.push({
        type: 'read',
        message: MessageMatcherUtils.extractMessageFromArgs(args),
        response: result,
        options: args[2],
      });
      return result;
    });

    const originalIdListMessage = mockCall.id_list_message;
    mockCall.id_list_message = jest.fn((...args) => {
      this.context.interactionHistory.push({
        type: 'id_list_message',
        message: MessageMatcherUtils.extractMessageFromArgs(args),
      });
      return originalIdListMessage?.(...args);
    });

    const originalHangup = mockCall.hangup;
    mockCall.hangup = jest.fn(() => {
      this.context.interactionHistory.push({
        type: 'hangup',
      });
      return originalHangup?.();
    });
  }
}
