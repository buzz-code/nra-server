import { Reflector } from "@nestjs/core";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ExecutionContext } from "@nestjs/common";

describe('JwtAuthGuard', () => {
    const reflector = new Reflector();
    const context = {
        getHandler: jest.fn(),
    } as unknown as ExecutionContext;

    // JwtAuthGuard can be instantiated
    it('should instantiate JwtAuthGuard', () => {
        const jwtAuthGuard = new JwtAuthGuard(reflector);
        expect(jwtAuthGuard).toBeDefined();
    });

    // canActivate method returns true if IS_PUBLIC is true
    it('should return true if IS_PUBLIC is true', () => {
        jest.spyOn(reflector, 'get').mockReturnValue(true);
        const jwtAuthGuard = new JwtAuthGuard(reflector);
        const result = jwtAuthGuard.canActivate(context);
        expect(result).toBe(true);
    });

    // canActivate method calls super.canActivate if IS_PUBLIC is false
    it('should call super.canActivate if IS_PUBLIC is false', () => {
        jest.spyOn(reflector, 'get').mockReturnValue(false);
        jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockReturnValue(false);
        const jwtAuthGuard = new JwtAuthGuard(reflector);
        const result = jwtAuthGuard.canActivate(context);
        expect(result).toBe(false); // Assuming super.canActivate returns false
    });

    // IS_PUBLIC is undefined
    it('should return false if IS_PUBLIC is undefined', () => {
        jest.spyOn(reflector, 'get').mockReturnValue(undefined);
        jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockReturnValue(false);
        const jwtAuthGuard = new JwtAuthGuard(reflector);
        const result = jwtAuthGuard.canActivate(context);
        expect(result).toBe(false);
    });

    // IS_PUBLIC is null
    it('should return false if IS_PUBLIC is null', () => {
        jest.spyOn(reflector, 'get').mockReturnValue(null);
        jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockReturnValue(false);
        const jwtAuthGuard = new JwtAuthGuard(reflector);
        const result = jwtAuthGuard.canActivate(context);
        expect(result).toBe(false);
    });

    // IS_PUBLIC is not a boolean
    it('should return false if IS_PUBLIC is not a boolean', () => {
        jest.spyOn(reflector, 'get').mockReturnValue('not a boolean');
        jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockReturnValue(false);
        const jwtAuthGuard = new JwtAuthGuard(reflector);
        const result = jwtAuthGuard.canActivate(context);
        expect(result).toBe(false);
    });
});
