import { DataSource, Repository } from 'typeorm';
import { getMailAddressForEntity } from '../mail-address.util';
import { MailAddress } from '@shared/entities/MailAddress.entity';

describe('Mail Address Utils', () => {
  let mockDataSource: jest.Mocked<DataSource>;
  let mockRepository: jest.Mocked<Repository<MailAddress>>;

  beforeEach(() => {
    mockRepository = {
      findOneBy: jest.fn(),
    } as any;

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    } as any;
  });

  describe('getMailAddressForEntity', () => {
    it('should return mail address when found', async () => {
      const userId = 1;
      const entity = 'test-entity';
      const domain = 'test.com';
      const mockMailAddress = {
        id: 1,
        userId: userId,
        entity: entity,
        alias: 'test-alias',
        createdAt: new Date(),
        updatedAt: new Date()
      } as MailAddress;

      mockRepository.findOneBy.mockResolvedValue(mockMailAddress);

      const result = await getMailAddressForEntity(userId, entity, mockDataSource, domain);

      expect(mockDataSource.getRepository).toHaveBeenCalledWith(MailAddress);
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ userId, entity });
      expect(result).toBe('test-alias@test.com');
    });

    it('should return undefined when mail address not found', async () => {
      const userId = 1;
      const entity = 'test-entity';
      const domain = 'test.com';

      mockRepository.findOneBy.mockResolvedValue(null);

      const result = await getMailAddressForEntity(userId, entity, mockDataSource, domain);

      expect(mockDataSource.getRepository).toHaveBeenCalledWith(MailAddress);
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ userId, entity });
      expect(result).toBeUndefined();
    });

    it('should use default domain if not provided', async () => {
      const userId = 1;
      const entity = 'test-entity';
      const mockMailAddress = {
        id: 1,
        userId: userId,
        entity: entity,
        alias: 'test-alias',
        createdAt: new Date(),
        updatedAt: new Date()
      } as MailAddress;

      mockRepository.findOneBy.mockResolvedValue(mockMailAddress);

      const result = await getMailAddressForEntity(userId, entity, mockDataSource);

      expect(result).toMatch(/test-alias@.*$/);
    });

    it('should handle repository errors', async () => {
      const userId = 1;
      const entity = 'test-entity';
      const error = new Error('Database error');

      mockRepository.findOneBy.mockRejectedValue(error);

      await expect(getMailAddressForEntity(userId, entity, mockDataSource))
        .rejects.toThrow('Database error');
    });
  });
});