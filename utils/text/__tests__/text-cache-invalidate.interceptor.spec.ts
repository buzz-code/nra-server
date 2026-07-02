import { getDataSourceToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { of } from 'rxjs';
import { Text } from '@shared/entities/Text.entity';
import { getTextByUserCacheId } from '@shared/view-entities/TextByUser.entity';
import { TextCacheInvalidateInterceptor } from '../text-cache-invalidate.interceptor';

describe('TextCacheInvalidateInterceptor', () => {
  let interceptor: TextCacheInvalidateInterceptor;
  let dataSource: jest.Mocked<DataSource>;
  let queryResultCache: { remove: jest.Mock };

  beforeEach(async () => {
    queryResultCache = { remove: jest.fn().mockResolvedValue(undefined) };
    dataSource = { queryResultCache } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TextCacheInvalidateInterceptor,
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    interceptor = module.get<TextCacheInvalidateInterceptor>(TextCacheInvalidateInterceptor);
  });

  const mockContext = {} as any;

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('invalidates the affected user cache entry after a write', (done) => {
    const text = { userId: 5, name: 'GREETING' } as Text;
    const mockCallHandler = { handle: () => of(text) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: async (result) => {
        expect(result).toBe(text);
        await Promise.resolve();
        expect(queryResultCache.remove).toHaveBeenCalledWith([getTextByUserCacheId(5, 'GREETING')]);
        done();
      },
    });
  });

  it('invalidates the base text cache entry (userId=0) when the base text changes', (done) => {
    const text = { userId: 0, name: 'GREETING' } as Text;
    const mockCallHandler = { handle: () => of(text) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: async (result) => {
        expect(result).toBe(text);
        await Promise.resolve();
        expect(queryResultCache.remove).toHaveBeenCalledWith([getTextByUserCacheId(0, 'GREETING')]);
        done();
      },
    });
  });

  it('does nothing when the handler result has no name (e.g. delete without returnDeleted)', (done) => {
    const mockCallHandler = { handle: () => of(undefined) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: async (result) => {
        expect(result).toBeUndefined();
        await Promise.resolve();
        expect(queryResultCache.remove).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
