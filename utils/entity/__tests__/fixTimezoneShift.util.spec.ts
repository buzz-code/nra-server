import { Repository } from 'typeorm';
import { fixTimezoneShift, reinterpretUtcDigitsAsIsraelLocal } from '../fixTimezoneShift.util';

describe('reinterpretUtcDigitsAsIsraelLocal', () => {
  it('subtracts 3 hours for a summer (IDT, UTC+3) date', () => {
    const wrong = new Date('2026-09-01T10:24:59.401Z');
    const fixed = reinterpretUtcDigitsAsIsraelLocal(wrong);
    expect(fixed.toISOString()).toBe('2026-09-01T07:24:59.401Z');
  });

  it('subtracts 2 hours for a winter (IST, UTC+2) date', () => {
    const wrong = new Date('2026-01-15T10:00:00.000Z');
    const fixed = reinterpretUtcDigitsAsIsraelLocal(wrong);
    expect(fixed.toISOString()).toBe('2026-01-15T08:00:00.000Z');
  });
});

describe('fixTimezoneShift', () => {
  let mockRepository: jest.Mocked<Repository<any>>;
  let executeMock: jest.Mock;
  let whereMock: jest.Mock;
  let setMock: jest.Mock;
  let updateMock: jest.Mock;
  let createQueryBuilderMock: jest.Mock;

  beforeEach(() => {
    executeMock = jest.fn().mockResolvedValue(undefined);
    whereMock = jest.fn().mockReturnValue({ execute: executeMock });
    setMock = jest.fn().mockReturnValue({ where: whereMock });
    updateMock = jest.fn().mockReturnValue({ set: setMock });
    createQueryBuilderMock = jest.fn().mockReturnValue({ update: updateMock });

    mockRepository = {
      metadata: {
        columns: [
          { propertyName: 'id' },
          { propertyName: 'createdAt' },
          { propertyName: 'updatedAt' },
          { propertyName: 'name' },
        ],
      },
      find: jest.fn().mockResolvedValue([
        { id: 1, createdAt: new Date('2026-09-01T10:24:59.401Z'), updatedAt: new Date('2026-09-01T10:24:59.401Z') },
      ]),
      createQueryBuilder: createQueryBuilderMock,
    } as any;
  });

  it('returns a message and does nothing when no ids are given', async () => {
    const result = await fixTimezoneShift(mockRepository, []);
    expect(result).toBe('לא נבחרו רשומות');
    expect(mockRepository.find).not.toHaveBeenCalled();
  });

  it('returns a message and does nothing when the entity has no timestamp columns', async () => {
    mockRepository.metadata.columns = [{ propertyName: 'id' } as any, { propertyName: 'name' } as any];
    const result = await fixTimezoneShift(mockRepository, [1]);
    expect(result).toBe('אין עמודות תאריך לתיקון בטבלה זו');
    expect(mockRepository.find).not.toHaveBeenCalled();
  });

  it('updates createdAt/updatedAt via a raw query builder update, not save', async () => {
    const result = await fixTimezoneShift(mockRepository, [1]);

    expect(mockRepository.find).toHaveBeenCalledWith({
      where: { id: expect.any(Object) },
      select: ['id', 'createdAt', 'updatedAt'],
    });
    expect(setMock).toHaveBeenCalledWith({
      createdAt: new Date('2026-09-01T07:24:59.401Z'),
      updatedAt: new Date('2026-09-01T07:24:59.401Z'),
    });
    expect(whereMock).toHaveBeenCalledWith('id = :id', { id: 1 });
    expect(executeMock).toHaveBeenCalled();
    expect(result).toBe('תוקנו 1 רשומות');
  });

  it('skips rows with no valid date values', async () => {
    mockRepository.find = jest.fn().mockResolvedValue([{ id: 1, createdAt: null, updatedAt: null }]);

    const result = await fixTimezoneShift(mockRepository, [1]);

    expect(createQueryBuilderMock).not.toHaveBeenCalled();
    expect(result).toBe('תוקנו 0 רשומות');
  });
});
