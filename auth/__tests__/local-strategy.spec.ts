import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { LocalStrategy } from '../local.strategy';

describe('LocalStrategy', () => {
  let localStrategy: LocalStrategy;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: AuthService,
          useValue: {
            validateUser: jest.fn(),
          },
        },
      ],
    }).compile();

    localStrategy = module.get<LocalStrategy>(LocalStrategy);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(localStrategy).toBeDefined();
  });

  it('should return a user if credentials are valid', async () => {
    const user = { id: 1, username: 'testuser' };
    jest.spyOn(authService, 'validateUser').mockResolvedValue(user);

    const result = await localStrategy.validate('testuser', 'testpassword');

    expect(result).toEqual(user);
    expect(authService.validateUser).toHaveBeenCalledWith('testuser', 'testpassword');
  });

  it('should throw an UnauthorizedException if credentials are invalid', async () => {
    jest.spyOn(authService, 'validateUser').mockResolvedValue(null);

    await expect(localStrategy.validate('testuser', 'wrongpassword')).rejects.toThrow(UnauthorizedException);
    expect(authService.validateUser).toHaveBeenCalledWith('testuser', 'wrongpassword');
  });
});
