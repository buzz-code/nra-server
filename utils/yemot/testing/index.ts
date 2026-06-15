/**
 * Yemot Testing Utilities — barrel export.
 *
 * Import from '@shared/utils/yemot/testing' in project-specific test files.
 *
 * Usage:
 *   import { YemotScenarioBuilder, YemotScenarioRunner } from '@shared/utils/yemot/testing';
 */

// Types
export type {
  Scenario,
  ScenarioStep,
  ScenarioResult,
  MessageMatcher,
  SeedConfig,
  StepType,
} from './scenario-types';

// Builder
export { YemotScenarioBuilder } from './scenario-builder';

// Runner
export { YemotScenarioRunner } from './scenario-runner';
export type { YemotHandlerConstructor } from './scenario-runner';

// Real DataSource (for low-level usage)
export { createRealDataSource } from './real-data-source';

// MockCall (for low-level usage)
export { MockCall, MockExitError } from './mock-call';
export type { MockCallOptions, YemotMessage } from './mock-call';
