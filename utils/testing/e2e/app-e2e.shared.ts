import { createTestApp, TestAppHelper } from './test-app.helper';
import { HttpTestUtils } from './test-utils';
import { DataSource } from 'typeorm';

/**
 * Creates the standard shared e2e test suite for an NRA application.
 * Covers: SQLite in-memory DB verification and GET / endpoint.
 *
 * Usage in each project's test/app.e2e-spec.ts:
 *   import { AppModule } from 'src/app.module';
 *   import { createSharedAppE2eTests } from '@shared/utils/testing/e2e/app-e2e.shared';
 *   createSharedAppE2eTests(AppModule);
 */
export function createSharedAppE2eTests(AppModule: any): void {
  describe('AppController (e2e)', () => {
    let testApp: TestAppHelper;
    let httpUtils: HttpTestUtils;

    beforeAll(async () => {
      testApp = createTestApp(AppModule);
      const app = await testApp.initializeApp();
      httpUtils = new HttpTestUtils(app);
    });

    afterAll(async () => {
      await testApp.cleanup();
    });

    it('should use SQLite in-memory database for E2E tests', () => {
      const dataSource = testApp.getService<DataSource>(DataSource);
      expect(dataSource).toBeDefined();
      expect(dataSource.options.type).toBe('sqlite');
      expect((dataSource.options as any).database).toBe(':memory:');
    });

    it('GET / should return 200 with Hello World message', () => {
      return httpUtils
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.text).toContain('Hello World!');
        });
    });
  });
}
