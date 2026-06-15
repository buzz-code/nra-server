/**
 * Yemot Scenario Testing — Type Definitions
 *
 * Types for declarative IVR call flow testing.
 * Used by YemotScenarioBuilder and YemotScenarioRunner.
 */

/**
 * Message matcher — flexible message verification.
 * Regex is recommended for text-key messages (resilient to text changes).
 */
export type MessageMatcher =
  | string                              // Exact match
  | RegExp                              // Regex match
  | ((message: string) => boolean)      // Custom matcher function
  | { contains: string }               // Contains substring
  | { startsWith: string }             // Starts with
  | { endsWith: string };              // Ends with

/**
 * Step type — what kind of IVR interaction this step represents.
 */
export type StepType =
  | 'send_message'      // System sends message (id_list_message, no response)
  | 'ask_input'         // System asks for input (read)
  | 'confirmation'      // System asks yes/no confirmation
  | 'hangup_message';   // System hangs up with message

/**
 * A single step in the call flow scenario.
 */
export interface ScenarioStep {
  /** Type of step */
  type: StepType;

  /** Expected message from system (matcher for flexibility) */
  expectedMessage?: MessageMatcher;

  /** User's response — what they press on the IVR keypad */
  userResponse?: string;

  /** Skip message validation (useful when message content is dynamic) */
  skipMessageValidation?: boolean;
}

/**
 * Seed data configuration — entity class name → array of entity objects.
 * Keys match TypeORM entity class names (e.g. 'User', 'Student', 'AttReport').
 */
export type SeedConfig = Record<string, any[]>;

/**
 * A complete test scenario.
 */
export interface Scenario {
  /** Human-readable name for test output */
  name: string;

  /** Seed data to insert before running */
  seed: SeedConfig;

  /** Ordered conversation steps */
  steps: ScenarioStep[];
}

/**
 * Result returned after running a scenario.
 */
export interface ScenarioResult {
  /** Did all steps pass validation? */
  passed: boolean;

  /** Did the call end with hangup? */
  hungup: boolean;

  /** All messages sent by the handler during the call */
  messages: Array<{ type: string; data: string }>;

  /** Entities saved during the call, keyed by entity class name.
   *  Seed data is excluded — only rows added by the handler. */
  saved: Record<string, any[]>;

  /** Full interaction trace for debugging */
  interactionHistory: Array<{
    type: 'read' | 'id_list_message' | 'hangup';
    message?: string;
    response?: string;
  }>;
}
