import { AuthModule } from '../auth.module';
import { Module } from '@nestjs/common';

@Module({})
class FakeModule { }

describe('AuthModule', () => {
    it('should be defined', () => {
        const authModule = new AuthModule();
        expect(authModule).toBeDefined();
    });

    describe('forRoot', () => {
        it('forRoot() with no args returns empty imports', () => {
            const result = AuthModule.forRoot();
            expect(result.imports).toEqual([]);
        });

        it('forRoot({ userInitModule }) includes the module in imports', () => {
            const result = AuthModule.forRoot({ userInitModule: FakeModule });
            expect(result.imports).toContain(FakeModule);
        });

        it('returns a DynamicModule with module set to AuthModule', () => {
            const result = AuthModule.forRoot();
            expect(result.module).toBe(AuthModule);
        });
    });
});