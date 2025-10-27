/**
 * Test to demonstrate the problem with partial flow testing
 * Using GenericScenarioRunner framework
 */

import { Call } from 'yemot-router2';
import { BaseYemotHandlerService } from '../yemot-router.service';
import { GenericScenarioRunner, BaseScenario, BaseContext } from '../../testing/yemot-test-framework-runner';
import { RepositoryMockBuilder } from '../../../testing/repository-mock-builder';
import { User } from '@shared/entities/User.entity';

// Simple test service with multiple steps
class TestMultiStepService extends BaseYemotHandlerService {
  async processCall(): Promise<void> {
    await this.getUserByDidPhone();

    // Step 1: Ask for name
    const name = await this.askForInput('What is your name?', { max_digits: 10 });
    
    // Step 2: Ask for age
    const age = await this.askForInput('What is your age?', { max_digits: 2 });
    
    // Step 3: Ask for confirmation
    const confirmed = await this.askForInput('Confirm? 1=yes, 2=no', { max_digits: 1 });
    
    // Step 4: Final message
    this.hangupWithMessage(`Thank you ${name}, age ${age}, confirmed: ${confirmed}`);
  }
}

// Test setup interface
interface TestSetup {
  user: {
    id: number;
    phoneNumber: string;
    username: string;
  };
}

// Test context interface
interface TestContext extends BaseContext<TestMultiStepService, Call> {
  setup: TestSetup;
  repositories: any;
}

// Test scenario interface
interface TestScenario extends BaseScenario<TestSetup> {
  name: string;
  setup: TestSetup;
  steps: Array<{
    type: 'ask_input' | 'user_hangup';
    expectedMessage?: string;
    userResponse?: string;
  }>;
  expectedResult: {
    callEnded?: boolean;
    partialFlowCompleted?: boolean;
    customValidation?: (context: TestContext) => void;
  };
}

// Test runner
class TestScenarioRunner extends GenericScenarioRunner<TestScenario, TestContext, TestSetup> {
  constructor() {
    super(TestMultiStepService);
  }

  protected defineRepositories(builder: RepositoryMockBuilder<TestSetup, TestContext>): any {
    return {
      user: builder.standard(User),
    };
  }

  protected createMockCall(setup: TestSetup): Call {
    return {
      ...super.createMockCall(setup),
      did: setup.user.phoneNumber,
      phone: '0987654321',
      ApiPhone: '0987654321',
    };
  }
}

describe('Partial Flow Testing - Using GenericScenarioRunner', () => {
  const runner = new TestScenarioRunner();

  const baseSetup: TestSetup = {
    user: {
      id: 1,
      phoneNumber: '1234567890',
      username: 'testuser',
    },
  };

  it('should complete full flow - all 4 steps', async () => {
    const scenario: TestScenario = {
      name: 'Full flow test',
      setup: baseSetup,
      steps: [
        { type: 'ask_input', expectedMessage: 'What is your name?', userResponse: 'John' },
        { type: 'ask_input', expectedMessage: 'What is your age?', userResponse: '25' },
        { type: 'ask_input', expectedMessage: 'Confirm? 1=yes, 2=no', userResponse: '1' },
      ],
      expectedResult: {
        callEnded: true,
        customValidation: (context) => {
          expect(context.call.read).toHaveBeenCalledTimes(3);
          expect(context.call.hangup).toHaveBeenCalledTimes(1);
        },
      },
    };

    const context = await runner.runScenario(scenario);
    
    // Full flow completed successfully
    expect(context.interactionHistory.length).toBeGreaterThan(0);
  });

  it('should test only first 2 steps - user_hangup is automatic!', async () => {
    // Now we can test partial flows - no need for explicit user_hangup!
    const scenario: TestScenario = {
      name: 'Partial flow test - first 2 steps only',
      setup: baseSetup,
      steps: [
        { type: 'ask_input', expectedMessage: 'What is your name?', userResponse: 'John' },
        { type: 'ask_input', expectedMessage: 'What is your age?', userResponse: '25' },
        // No user_hangup needed - framework adds it automatically!
      ],
      expectedResult: {
        callEnded: false, // Call didn't reach the system hangup - framework validates this!
        customValidation: (context) => {
          // Only validate the specific things we care about
          // Framework already validated that hangup was NOT called
          
          // Verify interaction history captured both inputs
          const readInteractions = context.interactionHistory.filter(i => i.type === 'read');
          expect(readInteractions.length).toBe(3); // 2 successful + 1 hangup
          expect(readInteractions[0].response).toBe('John');
          expect(readInteractions[1].response).toBe('25');
          expect(readInteractions[2].response).toBe('[USER HUNG UP]');
        },
      },
    };

    await runner.runScenario(scenario);
  });

  it('should demonstrate what we achieved - partial flow with early exit', async () => {
    // SUCCESS! We can now test partial flows - automatic hangup!
    const scenario: TestScenario = {
      name: 'Partial flow with early stop',
      setup: baseSetup,
      steps: [
        { type: 'ask_input', expectedMessage: 'What is your name?', userResponse: 'Alice' },
        // Stop after just 1 step - no explicit hangup needed!
      ],
      expectedResult: {
        callEnded: false, // Framework validates hangup was NOT called
        // No custom validation needed! Framework handles it.
      },
    };

    await runner.runScenario(scenario);
  });
});
