import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../public.decorator';

class MockAuthGuardClass {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp()?.getRequest();
    if (!req?.headers?.authorization) {
      throw new UnauthorizedException();
    }
    const [type, token] = (req.headers.authorization || '').split(' ');
    if (type !== 'Bearer' || !token || token === 'invalid.token') {
      throw new UnauthorizedException();
    }
    return true;
  }
}

// Mock AuthGuard before importing JwtAuthGuard
jest.mock('@nestjs/passport', () => ({
  AuthGuard: jest.fn(() => MockAuthGuardClass),
}));

// Import after mocking
import { JwtAuthGuard } from '../jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let reflector: Reflector;
  let guard: JwtAuthGuard;
  let mockContext: ExecutionContext;
  let mockRequest: any;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);

    mockRequest = {
      headers: {
        authorization: 'Bearer valid.jwt.token'
      }
    };

    mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getType: jest.fn().mockReturnValue('http'),
      getArgs: jest.fn().mockReturnValue([]),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as ExecutionContext;
  });

  describe('constructor', () => {
    it('should create JwtAuthGuard instance', () => {
      expect(guard).toBeDefined();
      expect(guard).toBeInstanceOf(JwtAuthGuard);
    });
  });

  describe('canActivate', () => {
    it('should return true if endpoint is marked as public', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(true);
      expect(guard.canActivate(mockContext)).toBe(true);
      expect(reflector.get).toHaveBeenCalledWith(IS_PUBLIC, mockContext.getHandler());
    });

    it('should call super.canActivate if endpoint is not public', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should handle undefined IS_PUBLIC decorator', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      expect(guard.canActivate(mockContext)).toBeTruthy();
    });

    it('should throw UnauthorizedException when no authorization header', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      mockRequest.headers.authorization = undefined;
      
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });
  });

  describe('metadata resolution', () => {
    it('should check handler metadata first', () => {
      const handlerSpy = jest.spyOn(reflector, 'get').mockReturnValue(true);
      const classSpy = jest.spyOn(mockContext, 'getClass');
      
      guard.canActivate(mockContext);
      
      expect(handlerSpy).toHaveBeenCalled();
      expect(classSpy).not.toHaveBeenCalled();
    });

    it('should handle null context handler', () => {
      mockContext.getHandler = jest.fn().mockReturnValue(null);
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      mockRequest.headers.authorization = undefined;
      
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });
  });

  describe('error handling', () => {
    it('should handle invalid context type', () => {
      const invalidContext = {
        ...mockContext,
        switchToHttp: jest.fn().mockReturnValue(null)
      } as ExecutionContext;

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      
      expect(() => guard.canActivate(invalidContext)).toThrow();
    });

    it('should handle reflector.get throwing error', () => {
      jest.spyOn(reflector, 'get').mockImplementation(() => {
        throw new Error('Reflector error');
      });
      
      expect(() => guard.canActivate(mockContext)).toThrow('Reflector error');
    });

    it('should handle malformed JWT token', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      mockRequest.headers.authorization = 'Bearer invalid.token';
      
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });
  });

  describe('HTTP request handling', () => {
    it('should handle different HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      
      methods.forEach(method => {
        mockRequest.method = method;
        jest.spyOn(reflector, 'get').mockReturnValue(false);
        expect(guard.canActivate(mockContext)).toBeTruthy();
      });
    });

    it('should handle request without headers', () => {
      mockRequest.headers = undefined;
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('should handle malformed authorization header', () => {
      const invalidHeaders = [
        'Bearer',
        'bearer token',
        'Basic auth',
        '',
        undefined
      ];

      invalidHeaders.forEach(header => {
        mockRequest.headers.authorization = header;
        jest.spyOn(reflector, 'get').mockReturnValue(false);
        
        expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete request flow', async () => {
      const mockHandler = jest.fn();
      jest.spyOn(mockContext, 'getHandler').mockReturnValue(mockHandler);
      
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      mockRequest.headers.authorization = 'Bearer valid.jwt.token';
      
      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should properly chain auth checks', async () => {
      const mockHandler = jest.fn();
      jest.spyOn(mockContext, 'getHandler').mockReturnValue(mockHandler);
      
      // First check public decorator
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      
      // Then verify JWT
      mockRequest.headers.authorization = 'Bearer valid.jwt.token';
      
      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });
});
