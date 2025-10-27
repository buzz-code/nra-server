import { camelCase, pascalCase } from 'change-case';

/**
 * Simple Repository Mock Builder
 *
 * Convention over configuration - entity name automatically maps to setup key.
 * Example: AttReport entity → setup.attReport (camelCase)
 * Example: saved tracking → setup.savedAttReports (saved + PascalCase + s)
 */

/**
 * Get entity name in camelCase for setup keys
 */
export function getEntityKey(EntityClass: Function): string {
  return camelCase(EntityClass.name);
}

/**
 * Get tracking array key for saved entities
 */
export function getTrackingKey(EntityClass: Function): string {
  return 'saved' + pascalCase(EntityClass.name) + 's';
}

/**
 * Simple repository mock builder - standard operations work out of the box
 */
export class RepositoryMockBuilder<TSetup, TContext> {
  constructor(
    private setup: TSetup,
    private context: TContext,
  ) {}

  /**
   * Create standard repository with all basic operations
   * Entity name automatically maps to setup key (camelCase)
   */
  standard<TEntity>(EntityClass: Function): any {
    const entityKey = getEntityKey(EntityClass); // AttReport → attReport
    const data = this.setup[entityKey];

    return {
      findOne: jest.fn().mockResolvedValue(data),
      find: jest.fn().mockResolvedValue(Array.isArray(data) ? data : []),
      create: jest.fn((dto) => ({ id: Date.now(), ...dto })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
  }

  /**
   * Create repository with save tracking
   * Convention: tracking array is at setup['saved' + PascalCase + 's']
   * Example: AttReport → setup.savedAttReports
   * Auto-initializes tracking array if it doesn't exist
   */
  withSaveTracking<TEntity>(EntityClass: Function): any {
    const standardRepo = this.standard(EntityClass);
    
    // Convention: saved + PascalCase + s
    const trackingKey = getTrackingKey(EntityClass);

    return {
      ...standardRepo,
      save: jest.fn((entity) => {
        // Auto-initialize tracking array if it doesn't exist
        if (!this.setup[trackingKey]) {
          this.setup[trackingKey] = [];
        }
        
        // Add entity to tracking array
        this.setup[trackingKey].push(entity);
        
        return Promise.resolve(entity);
      }),
    };
  }

  /**
   * Override specific methods
   */
  custom<TEntity>(EntityClass: Function, overrides: Partial<any>): any {
    const standardRepo = this.standard(EntityClass);
    return { ...standardRepo, ...overrides };
  }
}
