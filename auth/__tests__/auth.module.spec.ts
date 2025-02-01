import { AuthModule } from "../auth.module";

describe('AuthModule', () => {
    it('should be defined', () => {
        const authModule = new AuthModule();
        expect(authModule).toBeDefined();
    });
})