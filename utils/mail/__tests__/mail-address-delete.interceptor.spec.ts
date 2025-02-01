import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { MailAddress } from '@shared/entities/MailAddress.entity';
import { of, throwError } from 'rxjs';
import { MailAddressDeleteInterceptor } from '../mail-address-delete.interceptor';
import { AxiosResponse } from 'axios';

describe('MailAddressDeleteInterceptor', () => {
  let interceptor: MailAddressDeleteInterceptor;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    httpService = {
      post: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailAddressDeleteInterceptor,
        {
          provide: HttpService,
          useValue: httpService,
        },
      ],
    }).compile();

    interceptor = module.get<MailAddressDeleteInterceptor>(MailAddressDeleteInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    const mockMailAddress = {
      id: 1,
      alias: 'test-alias',
      entity: 'test-entity',
    } as MailAddress;

    const mockCallHandler = {
      handle: () => of(mockMailAddress),
    };

    const mockContext = {} as any;

    const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} } as any,
    });

    beforeEach(() => {
      process.env.DOMAIN_NAME = 'test.domain';
    });

    it('should call webhook after successful deletion', (done) => {
      const webhookResponse = createAxiosResponse({ success: true });
      httpService.post.mockImplementation(() => of(webhookResponse));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        next: (result) => {
          expect(result).toBe(mockMailAddress);
          expect(httpService.post).toHaveBeenCalledWith(
            expect.any(String),
            {
              ...mockMailAddress,
              serverName: 'test.domain',
            }
          );
          done();
        },
      });
    });

    it('should handle webhook errors gracefully', (done) => {
      httpService.post.mockImplementation(() => 
        throwError(() => new Error('Webhook error'))
      );

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        next: (result) => {
          expect(result).toBe(mockMailAddress);
          expect(httpService.post).toHaveBeenCalledWith(
            expect.any(String),
            {
              ...mockMailAddress,
              serverName: 'test.domain',
            }
          );
          done();
        },
      });
    });

    it('should return handler result even if webhook fails', (done) => {
      httpService.post.mockImplementation(() => 
        throwError(() => new Error('Webhook error'))
      );

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        next: (result) => {
          expect(result).toBe(mockMailAddress);
          done();
        },
      });
    });

    it('should include server name in webhook payload', (done) => {
      const webhookResponse = createAxiosResponse({ success: true });
      httpService.post.mockImplementation(() => of(webhookResponse));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        next: () => {
          expect(httpService.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              serverName: 'test.domain',
            })
          );
          done();
        },
      });
    });
  });
});