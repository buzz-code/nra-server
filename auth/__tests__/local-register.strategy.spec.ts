import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { LocalRegisterStrategy, validate, verify } from '../local-register.strategy';

jest.mock('passport-local', () => {
    return {
        Strategy: class MockStrategy { },
    }
});

describe('LocalRegisterStrategy', () => {
    let localRegisterStrategy: LocalRegisterStrategy;
    let authService: AuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LocalRegisterStrategy,
                {
                    provide: AuthService,
                    useValue: {
                        registerUser: jest.fn(),
                    },
                },
            ],
        }).compile();

        localRegisterStrategy = module.get<LocalRegisterStrategy>(LocalRegisterStrategy);
        authService = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(localRegisterStrategy).toBeDefined();
    });

    it('validate should return a user if registration is successful', async () => {
        const user = { id: 1, username: 'testuser' };
        jest.spyOn(authService, 'registerUser').mockResolvedValue(user);

        const req = { body: { userInfo: {} } } as Request;
        const result = await validate(authService, req, 'testuser', 'testpassword');

        expect(result).toEqual(user);
        expect(authService.registerUser).toHaveBeenCalledWith('testuser', 'testpassword', req.body.userInfo);
    });

    it('validate should handle errors properly during registration', async () => {
        const error = new UnauthorizedException('Registration failed');
        jest.spyOn(authService, 'registerUser').mockRejectedValue(error);

        const req = { body: { userInfo: {} } } as Request;

        await expect(validate(authService, req, 'testuser', 'testpassword')).rejects.toThrow(UnauthorizedException);
        expect(authService.registerUser).toHaveBeenCalledWith('testuser', 'testpassword', req.body.userInfo);
    });

    it('verify should call done with user if registration is successful', async () => {
        const user = { id: 1, username: 'testuser' };
        jest.spyOn(authService, 'registerUser').mockResolvedValue(user);

        const req = { body: { userInfo: {} } } as Request;
        const done = jest.fn();

        await verify(authService, req, 'testuser', 'testpassword', done);

        expect(done).toHaveBeenCalledWith(null, user);
        expect(authService.registerUser).toHaveBeenCalledWith('testuser', 'testpassword', req.body.userInfo);
    });

    it('verify should call done with error if registration fails', async () => {
        const error = new UnauthorizedException('Registration failed');
        jest.spyOn(authService, 'registerUser').mockRejectedValue(error);

        const req = { body: { userInfo: {} } } as Request;
        const done = jest.fn();

        await verify(authService, req, 'testuser', 'testpassword', done);

        expect(done).toHaveBeenCalledWith(error);
        expect(authService.registerUser).toHaveBeenCalledWith('testuser', 'testpassword', req.body.userInfo);
    });
});
