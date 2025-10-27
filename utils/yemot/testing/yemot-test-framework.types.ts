/**
 * Generic Yemot Testing Framework - Type Definitions
 * 
 * This module provides generic type definitions for testing Yemot IVR call flows.
 * It can be used across different projects that implement Yemot integrations.
 * 
 * Project-specific implementations should extend these types with their own
 * entity definitions and database setup requirements.
 */

/**
 * Message matcher types - allows flexible message verification
 */
export type MessageMatcher =
  | string // Exact match
  | RegExp // Regex match
  | ((message: string) => boolean) // Custom matcher function
  | { contains: string } // Contains substring
  | { startsWith: string } // Starts with
  | { endsWith: string }; // Ends with

/**
 * Step type - defines what kind of interaction this step represents
 */
export type StepType =
  | 'ask_input' // System asks for input (call.read)
  | 'send_message' // System sends message (call.id_list_message)
  | 'hangup_message' // System hangs up with message
  | 'confirmation'; // System asks yes/no confirmation

/**
 * A single step in the call flow scenario
 */
export interface GenericScenarioStep {
  /** Type of step */
  type: StepType;

  /** Expected message from system (can be matcher for flexibility) */
  expectedMessage?: MessageMatcher;

  /** User's response (what they press on the IVR) */
  userResponse?: string;

  /** Optional description for documentation */
  description?: string;

  /** Skip message validation (useful when message content is dynamic) */
  skipMessageValidation?: boolean;
}

/**
 * Expected result after scenario completes
 */
export interface GenericExpectedResult {
  /** Should the call end with hangup? */
  callEnded: boolean;

  /** Custom validation function */
  customValidation?: (context: any) => void | Promise<void>;
}

/**
 * Test execution context - tracks state during test execution
 */
export interface GenericTestContext {
  /** Mock call object */
  call: any;

  /** Service instance */
  service: any;

  /** Current step index */
  currentStepIndex: number;

  /** Call interaction history */
  interactionHistory: Array<{
    type: 'read' | 'id_list_message' | 'hangup';
    message?: string;
    response?: string;
    options?: any;
  }>;
}

/**
 * Message matching utility type
 */
export interface MessageMatcherUtils {
  /**
   * Verify message matches expectation
   */
  matchMessage(actual: string, expected: MessageMatcher): boolean;

  /**
   * Extract message text from call arguments
   */
  extractMessageFromArgs(args: any[]): string;
}
