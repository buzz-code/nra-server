import { LocalAuthGuard } from '../local-auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

// Mock implementation of AuthGuard for testing different scenarios
const mockCanActivate = jest.fn();
jest.mock('@nestjs/passport', () => {
  return {
    AuthGuard: jest.fn().mockImplementation(() => {
      return class {
        canActivate(context: ExecutionContext) {
          return mockCanActivate(context);
        }
      };
    }),
  };
});

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;
  let mockExecutionContext: ExecutionContext;

  beforeEach(() => {
    guard = new LocalAuthGuard();
    mockCanActivate.mockReset();

    // Setup mock execution context
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          body: {
            username: 'testuser',
            password: 'password123'
          }
        }),
        getResponse: jest.fn().mockReturnValue({}),
      }),
      getType: jest.fn().mockReturnValue('http'),
      getClass: jest.fn(),
      getHandler: jest.fn(),
    } as any;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should use local strategy', () => {
    const { AuthGuard } = require('@nestjs/passport');
    expect(AuthGuard).toHaveBeenCalledWith('local');
  });

  it('should allow valid authentication', async () => {
    mockCanActivate.mockResolvedValue(true);
    
    const result = await guard.canActivate(mockExecutionContext);
    
    expect(result).toBe(true);
    expect(mockCanActivate).toHaveBeenCalledWith(mockExecutionContext);
  });

  it('should reject invalid authentication', async () => {
    mockCanActivate.mockRejectedValue(new UnauthorizedException());
    
    await expect(guard.canActivate(mockExecutionContext))
      .rejects
      .toThrow(UnauthorizedException);
  });

  it('should handle missing credentials', async () => {
    const contextWithoutCreds = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          body: {}
        })
      }),
      getType: jest.fn().mockReturnValue('http'),
      getClass: jest.fn(),
      getHandler: jest.fn(),
    } as any;

    mockCanActivate.mockRejectedValue(new UnauthorizedException('Missing credentials'));
    
    await expect(guard.canActivate(contextWithoutCreds))
      .rejects
      .toThrow(UnauthorizedException);
  });

  it('should handle non-HTTP request context', async () => {
    const nonHttpContext = {
      switchToHttp: jest.fn().mockReturnValue(null),
      getType: jest.fn().mockReturnValue('rpc'),
      getClass: jest.fn(),
      getHandler: jest.fn(),
    } as any;

    mockCanActivate.mockRejectedValue(new Error('Invalid context'));
    
    await expect(guard.canActivate(nonHttpContext))
      .rejects
      .toThrow('Invalid context');
  });

  it('should handle malformed request', async () => {
    const malformedContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(null)
      }),
      getType: jest.fn().mockReturnValue('http'),
      getClass: jest.fn(),
      getHandler: jest.fn(),
    } as any;

    mockCanActivate.mockRejectedValue(new Error('Invalid request'));
    
    await expect(guard.canActivate(malformedContext))
      .rejects
      .toThrow('Invalid request');
  });

  it('should pass through custom error messages', async () => {
    const customError = new UnauthorizedException('Custom auth error');
    mockCanActivate.mockRejectedValue(customError);
    
    await expect(guard.canActivate(mockExecutionContext))
      .rejects
      .toThrow('Custom auth error');
  });

  it('should handle successful authentication with user data', async () => {
    const userData = { id: 1, username: 'testuser' };
    mockCanActivate.mockImplementation(async (context) => {
      const request = context.switchToHttp().getRequest();
      request.user = userData;
      return true;
    });

    await guard.canActivate(mockExecutionContext);
    
    const request = mockExecutionContext.switchToHttp().getRequest();
    expect(request.user).toEqual(userData);
  });
});