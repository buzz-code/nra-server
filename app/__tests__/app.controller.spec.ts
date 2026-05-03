import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { AuthService } from '@shared/auth/auth.service';
import { Response } from 'express';
import { UnauthorizedException } from '@nestjs/common';
import { AuthenticatedRequest } from '@shared/auth/auth.types';

describe('AppController', () => {
  let appController: AppController;
  let authService: AuthService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: AuthService,
          useValue: {
            getCookieWithJwtToken: jest.fn(user => {
              if (user) return 'cookie';
              throw new UnauthorizedException();
            }),
            getCookieForImpersonate: jest.fn(user => {
              if (user) return 'cookie';
              throw new UnauthorizedException();
            }),
            getCookieForLogOut: jest.fn().mockResolvedValue('Authentication=; HttpOnly; Path=/; Max-Age=0; SameSite=true'),
            registerUser: jest.fn().mockRejectedValue(new UnauthorizedException()),
            getProfile: jest.fn().mockResolvedValue({}),
            updateSettings: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    authService = app.get<AuthService>(AuthService);
  });

  it('should return hello message with startup timestamp', () => {
    expect(appController.getHello()).toMatch(/^Hello World! Server started at /);
  });

  it('should log in a user and return a success message', async () => {
    const req = { user: { email: 'test@example.com' } } as unknown as AuthenticatedRequest;
    const res = { setHeader: jest.fn(), send: jest.fn() } as unknown as Response;

    await appController.login(req, res);

    expect(authService.getCookieWithJwtToken).toHaveBeenCalledWith(req.user);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', 'cookie');
    expect(res.send).toHaveBeenCalledWith({ success: true });
  });

  it('should register a user and return a success message', async () => {
    const req = { user: { email: 'test@example.com' } } as unknown as AuthenticatedRequest;
    const res = { setHeader: jest.fn(), send: jest.fn() } as unknown as Response;

    await appController.register(req, res);

    expect(authService.getCookieWithJwtToken).toHaveBeenCalledWith(req.user);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', 'cookie');
    expect(res.send).toHaveBeenCalledWith({ success: true });
  });

  it('should throw an UnauthorizedException when login with unauthenticated user', async () => {
    const req = { user: null } as unknown as AuthenticatedRequest;
    const res = { setHeader: jest.fn(), send: jest.fn() } as unknown as Response;

    await expect(appController.login(req, res)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw an UnauthorizedException with non-admin user impersonation', async () => {
    const req = {
      user: { permissions: {} },
      body: { userId: 1 },
    } as unknown as AuthenticatedRequest;
    const res = { setHeader: jest.fn(), send: jest.fn() } as unknown as Response;

    await expect(appController.impersonate(req, res)).rejects.toThrow(UnauthorizedException);
  });

  it('should log out a user and return a success message', async () => {
    const responseMock = {
      setHeader: jest.fn(),
      sendStatus: jest.fn(),
    } as unknown as Response;

    await appController.logOut(responseMock);

    expect(responseMock.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.any(String));
    expect(responseMock.sendStatus).toHaveBeenCalledWith(200);
  });

  it("should return the user's profile information", async () => {
    const req = {
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
      },
    } as unknown as AuthenticatedRequest;
    const expectedProfile = { id: 1, email: 'test@example.com', name: 'Test User' };

    const profile = await appController.getProfile(req);

    expect(profile).toEqual(expectedProfile);
  });

  it('should impersonate a user and return a success message', async () => {
    const userId = 1;
    const responseMock = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;
    const req = {
      body: { userId },
      user: { permissions: { admin: true } },
    } as unknown as AuthenticatedRequest;

    await appController.impersonate(req, responseMock);

    expect(authService.getCookieForImpersonate).toHaveBeenCalledWith(userId);
    expect(responseMock.setHeader).toHaveBeenCalledWith('Set-Cookie', 'cookie');
    expect(responseMock.send).toHaveBeenCalledWith({ success: true });
  });

  it('should unimpersonate a user and return a success message', async () => {
    const responseMock = {
      setHeader: jest.fn(),
      sendStatus: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;
    const getCookieForLogOutSpy = jest.spyOn(authService, 'getCookieForLogOut').mockResolvedValue('cookie');

    await appController.unimpersonate({} as AuthenticatedRequest, responseMock);

    expect(getCookieForLogOutSpy).toHaveBeenCalled();
    expect(responseMock.setHeader).toHaveBeenCalledWith('Set-Cookie', 'cookie');
    expect(responseMock.sendStatus).toHaveBeenCalledWith(200);
  });

  it('should update user settings', async () => {
    const req = { user: { id: 1 } } as unknown as AuthenticatedRequest;
    const data = { key: 'value' };

    await appController.updateSettings(req, data);

    expect(authService.updateSettings).toHaveBeenCalledWith(1, data);
  });
});
