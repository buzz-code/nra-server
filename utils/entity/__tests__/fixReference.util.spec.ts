import { Repository } from 'typeorm';
import { fixReferences } from '../fixReference.util';

describe('fixReference.util', () => {
  let mockRepository: jest.Mocked<Repository<any>>;
  let mockData: any[];

  beforeEach(() => {
    mockData = [
      {
        id: 1,
        oldField: 'value1',
        referenceField: 'old1',
        fillFields: jest.fn().mockResolvedValue(undefined),
      },
      {
        id: 2,
        oldField: 'value2',
        referenceField: 'old2',
        fillFields: jest.fn().mockResolvedValue(undefined),
      },
    ];

    mockRepository = {
      findBy: jest.fn().mockResolvedValue(mockData),
      save: jest.fn().mockResolvedValue(mockData),
    } as any;
  });

  it('should fix references for all provided ids', async () => {
    const ids = [1, 2];
    const referenceFields = { oldField: 'referenceField' };

    const result = await fixReferences(mockRepository, ids, referenceFields);

    expect(mockRepository.findBy).toHaveBeenCalledWith({ id: expect.any(Object) });
    expect(mockRepository.save).toHaveBeenCalledWith(mockData);
    expect(result).toBe('תוקנו 2 רשומות');
  });

  it('should clear reference fields and call fillFields for each item', async () => {
    const ids = [1];
    const referenceFields = { oldField: 'referenceField' };

    await fixReferences(mockRepository, ids, referenceFields);

    // Verify reference fields were cleared
    expect(mockData[0].referenceField).toBeNull();
    // Verify fillFields was called
    expect(mockData[0].fillFields).toHaveBeenCalled();
  });

  it('should handle empty result set', async () => {
    mockRepository.findBy.mockResolvedValueOnce([]);
    const ids = [1];
    const referenceFields = { oldField: 'referenceField' };

    const result = await fixReferences(mockRepository, ids, referenceFields);

    expect(mockRepository.save).toHaveBeenCalledWith([]);
    expect(result).toBe('תוקנו 0 רשומות');
  });

  it('should handle multiple reference fields', async () => {
    const ids = [1];
    const referenceFields = {
      field1: 'ref1',
      field2: 'ref2',
    };

    const mockDataWithMultipleFields = [{
      id: 1,
      field1: 'value1',
      field2: 'value2',
      ref1: 'old1',
      ref2: 'old2',
      fillFields: jest.fn().mockResolvedValue(undefined),
    }];

    mockRepository.findBy.mockResolvedValueOnce(mockDataWithMultipleFields);

    await fixReferences(mockRepository, ids, referenceFields);

    expect(mockDataWithMultipleFields[0].ref1).toBeNull();
    expect(mockDataWithMultipleFields[0].ref2).toBeNull();
  });

  it('should handle errors during fillFields', async () => {
    const ids = [1];
    const referenceFields = { oldField: 'referenceField' };
    const error = new Error('Fill fields failed');
    mockData[0].fillFields.mockRejectedValueOnce(error);

    await expect(fixReferences(mockRepository, ids, referenceFields))
      .rejects
      .toThrow('Fill fields failed');
  });
});