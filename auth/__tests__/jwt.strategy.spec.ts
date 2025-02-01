jest.mock('../constants', () => ({
    jwtConstants: {
        secret: 'secret'
    }
}));

import { JwtStrategy, jwtFromRequest } from "../jwt.strategy";

describe('JwtStrategy', () => {
    it('should be defined', () => {
        const jwtStrategy = new JwtStrategy();
        expect(jwtStrategy).toBeDefined();
    });

    it('should return user profile excluding exp and iat fields', async () => {
        const jwtStrategy = new JwtStrategy();
        const payload = { sub: 1, username: 'testuser', exp: Date.now() + 1000, iat: Date.now() };
        const profile = await jwtStrategy.validate(payload);
        expect(profile).not.toHaveProperty('exp');
        expect(profile).not.toHaveProperty('iat');
        expect(profile).toEqual({ sub: 1, username: 'testuser' });
    });

    it('should extract jwt from request cookies', async () => {
        const request = {
            cookies: {
                Authentication: 'testtoken'
            }
        } as any;

        const jwt = jwtFromRequest(request);
        expect(jwt).toEqual('testtoken');
    });

    it('should return undefined if no token is provided', async () => {
        const request = {
            cookies: {}
        } as any;

        const jwt = jwtFromRequest(request);
        expect(jwt).toBeUndefined();
    });

    it('should return undefined if request is undefined', async () => {
        const jwt = jwtFromRequest(undefined);
        expect(jwt).toBeUndefined();
    });
});