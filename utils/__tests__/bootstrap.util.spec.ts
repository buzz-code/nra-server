import { bootstrapNraApplication, readPackageJsonName } from '../bootstrap.util';
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn(),
  },
  Reflector: jest.fn().mockImplementation(() => ({})),
}));

// Mock all external modules used in setupApplication
jest.mock('@nestjs/swagger', () => ({
  SwaggerModule: { createDocument: jest.fn(() => ({})), setup: jest.fn() },
  DocumentBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setVersion: jest.fn().mockReturnThis(),
    addTag: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnThis(),
  })),
}));
jest.mock('nestjs-pino', () => ({
  Logger: jest.fn(),
  LoggerErrorInterceptor: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('body-parser', () => ({ json: jest.fn(() => jest.fn()), urlencoded: jest.fn(() => jest.fn()) }));
jest.mock('cookie-parser', () => jest.fn(() => jest.fn()));
jest.mock('@shared/guards/maintenance.guard', () => ({ MaintenanceGuard: jest.fn().mockImplementation(() => ({})) }));

describe('readPackageJsonName', () => {
  it('should return the name from package.json', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ name: 'test-app' }) as any);
    expect(readPackageJsonName()).toBe('test-app');
    jest.restoreAllMocks();
  });

  it('should return nra-app when package.json is missing', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('File not found');
    });
    expect(readPackageJsonName()).toBe('nra-app');
    jest.restoreAllMocks();
  });
});

describe('bootstrapNraApplication', () => {
  it('should create app, setup, and listen on port 3000', async () => {
    const mockYemotRouter = { getRouter: jest.fn().mockReturnValue(jest.fn()) };
    const mockHttpServer: any = {};
    const mockApp = {
      useLogger: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      useGlobalGuards: jest.fn(),
      enableCors: jest.fn(),
      use: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockReturnValue(mockYemotRouter),
      getHttpServer: jest.fn().mockReturnValue(mockHttpServer),
    };
    (NestFactory.create as jest.Mock).mockResolvedValue(mockApp);

    class MockModule { }
    await bootstrapNraApplication(MockModule);

    expect(NestFactory.create).toHaveBeenCalledWith(MockModule);
    expect(mockApp.listen).toHaveBeenCalledWith(3000);
  });

  it('should set keepAliveTimeout and headersTimeout above Caddy\'s upstream keepalive', async () => {
    const mockYemotRouter = { getRouter: jest.fn().mockReturnValue(jest.fn()) };
    const mockHttpServer: any = {};
    const mockApp = {
      useLogger: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      useGlobalGuards: jest.fn(),
      enableCors: jest.fn(),
      use: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockReturnValue(mockYemotRouter),
      getHttpServer: jest.fn().mockReturnValue(mockHttpServer),
    };
    (NestFactory.create as jest.Mock).mockResolvedValue(mockApp);

    class MockModule { }
    await bootstrapNraApplication(MockModule);

    expect(mockHttpServer.keepAliveTimeout).toBe(35_000);
    expect(mockHttpServer.headersTimeout).toBe(36_000);
  });

  it('should listen on the explicit options port when provided', async () => {
    const mockYemotRouter = { getRouter: jest.fn().mockReturnValue(jest.fn()) };
    const mockApp = {
      useLogger: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      useGlobalGuards: jest.fn(),
      enableCors: jest.fn(),
      use: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockReturnValue(mockYemotRouter),
      getHttpServer: jest.fn().mockReturnValue({}),
    };
    (NestFactory.create as jest.Mock).mockResolvedValue(mockApp);

    class MockModule { }
    await bootstrapNraApplication(MockModule, { port: 4100 });

    expect(mockApp.listen).toHaveBeenCalledWith(4100);
  });

  it('should skip yemot router setup when the service is not registered', async () => {
    const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const mockApp = {
      useLogger: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      useGlobalGuards: jest.fn(),
      enableCors: jest.fn(),
      use: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockImplementation((token) => {
        if (token && token.name === 'YemotRouterService') {
          throw new Error('Nest could not find YemotRouterService');
        }
        return logger;
      }),
      getHttpServer: jest.fn().mockReturnValue({}),
    };
    (NestFactory.create as jest.Mock).mockResolvedValue(mockApp);

    class MockModule { }

    await expect(bootstrapNraApplication(MockModule)).resolves.toBeUndefined();
    expect(mockApp.listen).toHaveBeenCalledWith(3000);
  });

  it('should rethrow unexpected errors from yemot router setup', async () => {
    const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const unexpectedError = new Error('getRouter failed unexpectedly');
    const mockApp = {
      useLogger: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      useGlobalGuards: jest.fn(),
      enableCors: jest.fn(),
      use: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockImplementation((token) => {
        if (token && token.name === 'YemotRouterService') {
          return { getRouter: () => { throw unexpectedError; } };
        }
        return logger;
      }),
    };
    (NestFactory.create as jest.Mock).mockResolvedValue(mockApp);

    class MockModule { }

    await expect(bootstrapNraApplication(MockModule)).rejects.toThrow('getRouter failed unexpectedly');
  });
});

