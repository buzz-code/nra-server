import { getDataSourceToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { of } from 'rxjs';
import { Text } from '@shared/entities/Text.entity';
import { User } from '@shared/entities/User.entity';
import { getTextByUserCacheId } from '@shared/view-entities/TextByUser.entity';
import { TextCacheInvalidateInterceptor } from '../text-cache-invalidate.interceptor';

describe('TextCacheInvalidateInterceptor', () => {
  let interceptor: TextCacheInvalidateInterceptor;
  let dataSource: jest.Mocked<DataSource>;
  let userRepo: { find: jest.Mock };
  let queryResultCache: { remove: jest.Mock };

  beforeEach(async () => {
    queryResultCache = { remove: jest.fn().mockResolvedValue(undefined) };
    userRepo = { find: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]) };
    dataSource = {
      getRepository: jest.fn().mockReturnValue(userRepo),
      queryResultCache,
    } as any;

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

  it('invalidates only the affected user cache entry for a per-user override', (done) => {
    const text = { userId: 5, name: 'GREETING' } as Text;
    const mockCallHandler = { handle: () => of(text) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: async (result) => {
        expect(result).toBe(text);
        await Promise.resolve();
        expect(dataSource.getRepository).not.toHaveBeenCalledWith(User);
        expect(queryResultCache.remove).toHaveBeenCalledWith([getTextByUserCacheId(5, 'GREETING')]);
        done();
      },
    });
  });

  it('invalidates every user cache entry when the base text (userId=0) changes', (done) => {
    const text = { userId: 0, name: 'GREETING' } as Text;
    const mockCallHandler = { handle: () => of(text) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: async (result) => {
        expect(result).toBe(text);
        await Promise.resolve();
        expect(queryResultCache.remove).toHaveBeenCalledWith([
          getTextByUserCacheId(0, 'GREETING'),
          getTextByUserCacheId(1, 'GREETING'),
          getTextByUserCacheId(2, 'GREETING'),
        ]);
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
