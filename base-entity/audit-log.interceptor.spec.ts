import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { AuditLog } from '@shared/entities/AuditLog.entity';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { tap } from 'rxjs/operators';
import { of, firstValueFrom } from 'rxjs';
import { getDataSourceToken } from '@nestjs/typeorm';

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let mockRepository: Partial<Repository<AuditLog>>;
  let mockDataSource: Partial<DataSource>;
  let mockExecutionContext: ExecutionContext;

  beforeEach(async () => {
    mockRepository = {
      save: jest.fn().mockResolvedValue({}),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogInterceptor,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    interceptor = module.get<AuditLogInterceptor>(AuditLogInterceptor);

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          originalUrl: '/entity/1',
          method: 'POST',
          params: { id: '1' },
          user: { id: 123 },
        }),
        getResponse: jest.fn().mockReturnValue({
          statusCode: 200,
        }),
      }),
    } as any;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log audit data on successful request', async () => {
    const mockData = { id: 1, name: 'Test' };
    const next = {
      handle: () => of(mockData),
    };

    await firstValueFrom(interceptor.intercept(mockExecutionContext, next).pipe(
      tap(() => {
        expect(mockDataSource.getRepository).toHaveBeenCalledWith(AuditLog);
        expect(mockRepository.save).toHaveBeenCalledWith({
          userId: 123,
          entityId: 1,
          entityName: 'entity',
          entityData: mockData,
          operation: 'POST',
        });
      }),
    ));
  });

  it('should truncate long values in audit data', async () => {
    const longString = 'a'.repeat(25_000_000);
    const mockData = { id: 1, longField: longString };
    const next = {
      handle: () => of(mockData),
    };

    await firstValueFrom(interceptor.intercept(mockExecutionContext, next).pipe(
      tap(() => {
        expect(mockRepository.save).toHaveBeenCalled();
        const saveCall = (mockRepository.save as jest.Mock).mock.calls[0][0];
        const serializedData = JSON.stringify(saveCall.entityData.longField);
        expect(serializedData.length).toBeLessThanOrEqual(20_000_003);
      }),
    ));
  }, 10000);

  it('should handle missing entity id in params', async () => {
    const mockCtx = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          originalUrl: '/entity',
          method: 'GET',
          params: {},
          user: { id: 123 },
        }),
        getResponse: jest.fn().mockReturnValue({
          statusCode: 200,
        }),
      }),
    } as any;

    const next = {
      handle: () => of({ id: 1 }),
    };

    await firstValueFrom(interceptor.intercept(mockCtx, next).pipe(
      tap(() => {
        expect(mockRepository.save).toHaveBeenCalled();
        const saveCall = (mockRepository.save as jest.Mock).mock.calls[0][0];
        expect(saveCall.entityId).toBeNaN();
      }),
    ));
  });

  it('should extract entity name from URL path', async () => {
    const mockCtx = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          originalUrl: '/custom-entity/1/details',
          method: 'GET',
          params: { id: '1' },
          user: { id: 123 },
        }),
        getResponse: jest.fn().mockReturnValue({
          statusCode: 200,
        }),
      }),
    } as any;

    const next = {
      handle: () => of({ id: 1 }),
    };

    await firstValueFrom(interceptor.intercept(mockCtx, next).pipe(
      tap(() => {
        expect(mockRepository.save).toHaveBeenCalled();
        const saveCall = (mockRepository.save as jest.Mock).mock.calls[0][0];
        expect(saveCall.entityName).toBe('custom-entity');
      }),
    ));
  });
});