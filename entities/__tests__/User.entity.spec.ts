import { User } from "../User.entity";

class MockUser extends User {}

describe('User Entity', () => {
    it('should hash password', async () => {
        const user = new MockUser();
        user.password = 'password';
        await user.hashPassword();
        expect(user.password).not.toBe('password');
    });
});