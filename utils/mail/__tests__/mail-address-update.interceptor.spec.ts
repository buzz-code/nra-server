import { HttpService } from '@nestjs/axios';
import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MailAddress } from '@shared/entities/MailAddress.entity';
import { Observable, of, throwError } from 'rxjs';
import { MailAddressUpdateInterceptor } from '../mail-address-update.interceptor';
import { AxiosResponse } from 'axios';
import { mailWorkflowUrls } from '@shared/config/mail-workflows';

describe('MailAddressUpdateInterceptor', () => {
  let interceptor: MailAddressUpdateInterceptor;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    httpService = {
      post: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailAddressUpdateInterceptor,
        {
          provide: HttpService,
          useValue: httpService,
        },
      ],
    }).compile();

    interceptor = module.get<MailAddressUpdateInterceptor>(MailAddressUpdateInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    const mockMailAddress = {
      id: 1,
      alias: 'test-alias',
      entity: 'test-entity',
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    } as MailAddress;

    const mockCallHandler = {
      handle: () => of(mockMailAddress),
    };

    const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} } as any,
    });

    it('should allow request when validation passes', (done) => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            body: {
              alias: 'test-alias',
              entity: 'test-entity',
            },
          }),
        }),
      } as ExecutionContext;

      const validationResponse = createAxiosResponse({ valid: true });
      httpService.post.mockImplementation(() => of(validationResponse));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        next: (result) => {
          expect(httpService.post).toHaveBeenCalledWith(
            mailWorkflowUrls.validateMailQnique,
            expect.objectContaining({
              alias: 'test-alias',
              entity: 'test-entity',
            })
          );
          expect(result).toBeDefined();
          expect(result.alias).toBe('test-alias');
          done();
        },
      });
    });

    it('should throw BadRequestException when validation fails', (done) => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            body: {
              alias: 'test-alias',
              entity: 'test-entity',
            },
          }),
        }),
      } as ExecutionContext;

      const validationResponse = createAxiosResponse({ valid: false });
      httpService.post.mockImplementation(() => of(validationResponse));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        error: (error) => {
          expect(error).toBeInstanceOf(BadRequestException);
          expect(error.message).toBe('כתובת המייל כבר תפוסה');
          done();
        },
      });
    });

    it('should save webhook data on successful update', (done) => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            body: {
              alias: 'test-alias',
              entity: 'test-entity',
            },
          }),
        }),
      } as ExecutionContext;

      process.env.DOMAIN_NAME = 'test.domain';
      const validationResponse = createAxiosResponse({ valid: true });
      const webhookResponse = createAxiosResponse({ success: true });
      
      httpService.post
        .mockImplementationOnce(() => of(validationResponse))
        .mockImplementationOnce(() => of(webhookResponse));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        next: (result) => {
          expect(httpService.post).toHaveBeenCalledWith(
            mailWorkflowUrls.validateMailQnique,
            expect.objectContaining({
              alias: 'test-alias',
              entity: 'test-entity',
            })
          );
          expect(result).toBeDefined();
          done();
        },
      });
    });

    it('should handle webhook errors gracefully', (done) => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            body: {
              alias: 'test-alias',
              entity: 'test-entity',
            },
          }),
        }),
      } as ExecutionContext;

      process.env.DOMAIN_NAME = 'test.domain';
      const validationResponse = createAxiosResponse({ valid: true });
      
      httpService.post
        .mockImplementationOnce(() => of(validationResponse))
        .mockImplementationOnce(() => throwError(() => new Error('Webhook error')));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        next: (result) => {
          expect(httpService.post).toHaveBeenCalledWith(
            mailWorkflowUrls.validateMailQnique,
            expect.objectContaining({
              alias: 'test-alias',
              entity: 'test-entity',
            })
          );
          expect(result).toBeDefined();
          done();
        },
      });
    });

    it('should handle validation service errors', (done) => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            body: {
              alias: 'test-alias',
              entity: 'test-entity',
            },
          }),
        }),
      } as ExecutionContext;

      httpService.post.mockImplementation(() => 
        throwError(() => new Error('Validation service error'))
      );

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        error: (error) => {
          expect(error).toBeDefined();
          expect(error.message).toBe('Validation service error');
          done();
        },
      });
    });

    it('should handle missing request body', (done) => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            body: undefined
          }),
        }),
      } as ExecutionContext;

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        next: (result) => {
          expect(result).toEqual(mockMailAddress);
          expect(httpService.post).not.toHaveBeenCalled();
          done();
        },
        error: (error) => {
          done(error);
        }
      });
    });
  });
});