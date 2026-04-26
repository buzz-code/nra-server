import { CrudRequest } from '@dataui/crud';
import { BaseEntityModuleOptions } from '@shared/base-entity/interface';

/**
 * Options that describe the expected shape of an entity config.
 * All fields are optional — only the assertions for the fields you provide are run.
 */
export interface EntityConfigTestOptions {
  /** The entity class the config should declare. */
  entity: Function;

  /**
   * Expected `config.query.join` value.
   * When provided, asserts that `config.query` is defined and its `join` deeply equals this value.
   */
  expectedJoins?: Record<string, { eager?: boolean } | object>;

  /**
   * Expected joins that `processReqForExport` sets on the request.
   * When provided, calls `processReqForExport` with a mock request and asserts the joins.
   * Supports `expect.objectContaining` style if you pass `expect.objectContaining(...)` as value.
   */
  expectedExportJoins?: Record<string, { eager?: boolean } | object> | ReturnType<typeof expect.objectContaining>;

  /**
   * Assertions for `getExportHeaders`.
   * - `count`: exact number of headers returned
   * - `includes`: one or more headers that must appear (uses `arrayContaining`)
   * - `first`: the very first header must equal this value exactly
   */
  expectedExportHeaders?: {
    count?: number;
    includes?: Array<{ value: string | Function; label: string }>;
    first?: { value: string | Function; label: string };
  };

  /**
   * Assertions for `getImportDefinition`.
   * - `importFieldsCount`: exact number of importFields
   * - `specialFieldsCount`: exact number of specialFields
   * - `hardCodedFieldsCount`: exact number of hardCodedFields
   * - `beforeSave`: expected beforeSave function
   */
  expectedImport?: {
    importFieldsCount?: number;
    specialFieldsCount?: number;
    hardCodedFieldsCount?: number;
    beforeSave?: Function;
  };

  /**
   * Inject extra `describe` blocks after the auto-generated assertions.
   * Use this for config-specific logic (custom service methods, unique edge cases, etc.).
   *
   * @example
   * customTests: () => {
   *   describe('calcMyLogic', () => {
   *     it('does the thing', () => { ... });
   *   });
   * }
   */
  customTests?: () => void;
}

/**
 * createEntityConfigTests
 *
 * Generates a standard Jest `describe` block that validates a NestJS entity config object
 * exported from a `*.config.ts` file.
 *
 * Tests auto-generated from `options`:
 *  - entity class identity check
 *  - query.join shape (when `expectedJoins` provided)
 *  - exporter presence (when any exporter option is provided)
 *  - processReqForExport join mutation (when `expectedExportJoins` provided)
 *  - getExportHeaders return value (when `expectedExportHeaders` provided)
 *  - getImportDefinition return structure (when `expectedImport` provided)
 *
 * Custom tests are appended at the bottom of the describe block via `customTests`.
 *
 * @example
 * // In my-entity.config.spec.ts
 * import config from '../my-entity.config';
 * import { MyEntity } from 'src/db/entities/MyEntity.entity';
 * import { createEntityConfigTests } from '@shared/utils/testing/entity-config-tester';
 *
 * createEntityConfigTests('MyEntityConfig', config, {
 *   entity: MyEntity,
 *   expectedJoins: { teacher: { eager: false } },
 *   expectedExportJoins: { teacher: { eager: true } },
 *   expectedExportHeaders: { count: 4, first: { value: 'teacher.name', label: 'מורה' } },
 * });
 */
export function createEntityConfigTests(
  name: string,
  config: BaseEntityModuleOptions,
  options: EntityConfigTestOptions,
): void {
  const {
    entity,
    expectedJoins,
    expectedExportJoins,
    expectedExportHeaders,
    expectedImport,
    customTests,
  } = options;

  describe(name, () => {
    // ── entity ──────────────────────────────────────────────────────────────
    it('should use the correct entity class', () => {
      expect(config.entity).toBe(entity);
    });

    // ── query.join ───────────────────────────────────────────────────────────
    if (expectedJoins !== undefined) {
      it('should have correct query.join configuration', () => {
        expect(config.query).toBeDefined();
        expect(config.query!.join).toEqual(expectedJoins);
      });
    }

    // ── exporter ─────────────────────────────────────────────────────────────
    const hasExporterAssertions =
      expectedExportJoins !== undefined ||
      expectedExportHeaders !== undefined ||
      expectedImport !== undefined;

    if (hasExporterAssertions) {
      it('should have an exporter defined', () => {
        expect(config.exporter).toBeDefined();
      });
    }

    // ── processReqForExport ──────────────────────────────────────────────────
    if (expectedExportJoins !== undefined) {
      it('processReqForExport should mutate request joins and call innerFunc', async () => {
        expect(config.exporter).toBeDefined();
        expect(config.exporter!.processReqForExport).toBeInstanceOf(Function);

        const mockReq = {
          options: { query: { join: {} } },
        } as unknown as CrudRequest;
        const mockInner = jest.fn((req: CrudRequest) => Promise.resolve(req) as any);

        await config.exporter!.processReqForExport!(mockReq, mockInner);

        expect(mockInner).toHaveBeenCalledWith(mockReq);
        expect(mockReq.options.query.join).toEqual(expectedExportJoins);
      });
    }

    // ── getExportHeaders ─────────────────────────────────────────────────────
    if (expectedExportHeaders !== undefined) {
      it('getExportHeaders should return expected headers', () => {
        expect(config.exporter).toBeDefined();
        expect(config.exporter!.getExportHeaders).toBeInstanceOf(Function);

        const headers = config.exporter!.getExportHeaders!([], undefined, undefined);

        expect(Array.isArray(headers)).toBe(true);

        if (expectedExportHeaders.count !== undefined) {
          expect(headers).toHaveLength(expectedExportHeaders.count);
        }

        if (expectedExportHeaders.first !== undefined) {
          expect(headers[0]).toEqual(expectedExportHeaders.first);
        }

        if (expectedExportHeaders.includes !== undefined && expectedExportHeaders.includes.length > 0) {
          expect(headers).toEqual(
            expect.arrayContaining(
              expectedExportHeaders.includes.map(h => expect.objectContaining(h)),
            ),
          );
        }
      });
    }

    // ── getImportDefinition ──────────────────────────────────────────────────
    if (expectedImport !== undefined) {
      it('getImportDefinition should return expected structure', () => {
        expect(config.exporter).toBeDefined();
        expect(config.exporter!.getImportDefinition).toBeInstanceOf(Function);

        const importDef = config.exporter!.getImportDefinition!([]);

        if (expectedImport.importFieldsCount !== undefined) {
          expect(importDef.importFields).toHaveLength(expectedImport.importFieldsCount);
        }

        if (expectedImport.specialFieldsCount !== undefined) {
          expect(importDef.specialFields).toHaveLength(expectedImport.specialFieldsCount);
        }

        if (expectedImport.hardCodedFieldsCount !== undefined) {
          expect(importDef.hardCodedFields).toHaveLength(expectedImport.hardCodedFieldsCount);
        }

        if (expectedImport.beforeSave !== undefined) {
          expect(importDef.beforeSave).toBe(expectedImport.beforeSave);
        }
      });
    }

    // ── custom tests ─────────────────────────────────────────────────────────
    if (customTests) {
      customTests();
    }
  });
}
