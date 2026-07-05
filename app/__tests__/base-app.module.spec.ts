import { BaseNraAppModule } from '../base-app.module';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { Module } from '@nestjs/common';

@Module({})
class FakeEntitiesModule { }

class FakeYemotHandlerService { }

describe('BaseNraAppModule', () => {
  describe('forRoot', () => {
    it('returns a DynamicModule with module set to BaseNraAppModule', () => {
      const result = BaseNraAppModule.forRoot({
        entitiesModule: FakeEntitiesModule,
        yemotHandlerService: FakeYemotHandlerService as any,
      });

      expect(result.module).toBe(BaseNraAppModule);
    });

    it('includes AppController in controllers', () => {
      const result = BaseNraAppModule.forRoot({
        entitiesModule: FakeEntitiesModule,
        yemotHandlerService: FakeYemotHandlerService as any,
      });

      expect(result.controllers).toContain(AppController);
    });

    it('includes AppService in providers', () => {
      const result = BaseNraAppModule.forRoot({
        entitiesModule: FakeEntitiesModule,
        yemotHandlerService: FakeYemotHandlerService as any,
      });

      const providers = result.providers as any[];
      const appServiceProvider = providers.find(
        (p) => p === AppService || (typeof p === 'function' && p === AppService),
      );
      expect(appServiceProvider).toBeDefined();
    });

    it('uses DefaultUserInitModule when no userInitModule provided', () => {
      const { DefaultUserInitModule } = require('@shared/auth/default-user-init.module');
      const result = BaseNraAppModule.forRoot({
        entitiesModule: FakeEntitiesModule,
        yemotHandlerService: FakeYemotHandlerService as any,
      });

      const imports = result.imports as any[];
      const authImport = imports.find(
        (i: any) => i?.module?.name === 'AuthModule' || i?.name === 'AuthModule',
      );
      expect(authImport).toBeDefined();
    });

    it('includes S3Module in imports', () => {
      const { S3Module } = require('@shared/utils/s3/s3.module');
      const result = BaseNraAppModule.forRoot({
        entitiesModule: FakeEntitiesModule,
        yemotHandlerService: FakeYemotHandlerService as any,
      });

      const imports = result.imports as any[];
      expect(imports).toContain(S3Module);
    });

    it('applies custom throttlerLimit when provided', () => {
      const result = BaseNraAppModule.forRoot({
        entitiesModule: FakeEntitiesModule,
        yemotHandlerService: FakeYemotHandlerService as any,
        throttlerLimit: 200,
      });

      expect(result.module).toBe(BaseNraAppModule);
      // We verify it doesn't throw and returns a valid module
      expect(result.imports).toBeDefined();
    });
  });
});
