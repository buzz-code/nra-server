import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { validateBulk, validateUserHasPaid, validateNotTrialEnded, getUserMailAddressFrom } from '../base-entity.util';
import { User } from '@shared/entities/User.entity';
import { IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { CrudValidationGroups } from '@dataui/crud';
import { Expose } from 'class-transformer';

// Create a proper entity class for testing
class TestEntity {
  @Expose()
  @IsNumber({}, { 
    always: true,
    groups: [CrudValidationGroups.CREATE]
  })
  @IsNotEmpty({ 
    always: true,
    groups: [CrudValidationGroups.CREATE] 
  })
  id: number;

  @Expose()
  @IsNumber({}, { 
    always: true,
    groups: [CrudValidationGroups.CREATE]
  })
  @IsNotEmpty({ 
    always: true,
    groups: [CrudValidationGroups.CREATE] 
  })
  userId: number;

  @Expose()
  @IsString({ 
    always: true,
    groups: [CrudValidationGroups.CREATE]
  })
  @IsNotEmpty({ 
    always: true,
    groups: [CrudValidationGroups.CREATE] 
  })
  name: string;
}

describe('base-entity.util', () => {
  let mockDataSource: Partial<DataSource>;
  let mockUserRepository: Partial<Repository<User>>;

  beforeEach(() => {
    mockUserRepository = {
      findOne: jest.fn(),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockUserRepository),
    };
  });

  describe('validateBulk', () => {
    it('should validate valid bulk data', async () => {
      const bulk = [
        { id: 1, userId: 1, name: 'Test 1' },
        { id: 2, userId: 2, name: 'Test 2' },
      ];

      await expect(validateBulk(bulk, TestEntity)).resolves.not.toThrow();
    });

    it('should throw error for invalid bulk data', async () => {
      const bulk = [
        { id: 'not-a-number', userId: 'not-a-number', name: 123 }, // All types are wrong
      ];

      await expect(validateBulk(bulk, TestEntity))
        .rejects
        .toThrow();
    });

    it('should throw error for empty bulk array', async () => {
      const bulk: any[] = [];

      await expect(validateBulk(bulk, TestEntity))
        .rejects
        .toThrow('bulk should not be empty');
    });
  });

  describe('validateUserHasPaid', () => {
    it('should allow paid user', async () => {
      mockUserRepository.findOne = jest.fn().mockResolvedValue({ isPaid: true });

      await expect(validateUserHasPaid({ id: 1 }, mockDataSource as DataSource))
        .resolves.not.toThrow();
    });

    it('should throw error for unpaid user', async () => {
      mockUserRepository.findOne = jest.fn().mockResolvedValue({ isPaid: false });

      await expect(validateUserHasPaid({ id: 1 }, mockDataSource as DataSource))
        .rejects.toThrow(BadRequestException);
    });

    it('should return early if no userId', async () => {
      await expect(validateUserHasPaid({}, mockDataSource as DataSource))
        .resolves.not.toThrow();
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('validateNotTrialEnded', () => {
    it('should allow paid user', async () => {
      mockUserRepository.findOne = jest.fn().mockResolvedValue({ 
        isPaid: true,
        additionalData: {}
      });

      await expect(validateNotTrialEnded({ id: 1 }, mockDataSource as DataSource))
        .resolves.not.toThrow();
    });

    it('should allow unpaid user in trial period', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      mockUserRepository.findOne = jest.fn().mockResolvedValue({ 
        isPaid: false,
        additionalData: {
          trialEndDate: futureDate.toISOString()
        }
      });

      await expect(validateNotTrialEnded({ id: 1 }, mockDataSource as DataSource))
        .resolves.not.toThrow();
    });

    it('should throw error for unpaid user with expired trial', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      mockUserRepository.findOne = jest.fn().mockResolvedValue({ 
        isPaid: false,
        additionalData: {
          trialEndDate: pastDate.toISOString()
        }
      });

      await expect(validateNotTrialEnded({ id: 1 }, mockDataSource as DataSource))
        .rejects.toThrow(BadRequestException);
    });

    it('should return early if no userId', async () => {
      await expect(validateNotTrialEnded({}, mockDataSource as DataSource))
        .resolves.not.toThrow();
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getUserMailAddressFrom', () => {
    const mockDomain = 'test.com';

    it('should return admin mail address for admin user', async () => {
      const result = await getUserMailAddressFrom(
        { permissions: { admin: true } },
        mockDataSource as DataSource,
        mockDomain
      );

      expect(result).toEqual({
        name: 'מערכת יומן',
        address: 'test@' + mockDomain
      });
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return default address if user has no mail config', async () => {
      mockUserRepository.findOne = jest.fn().mockResolvedValue({
        mailAddressAlias: null,
        mailAddressTitle: null
      });

      const result = await getUserMailAddressFrom(
        { id: 1, permissions: {} },
        mockDataSource as DataSource,
        mockDomain
      );

      expect(result).toEqual({
        name: 'יש להגדיר שם',
        address: 'test@' + mockDomain
      });
    });

    it('should return user mail address for configured user', async () => {
      mockUserRepository.findOne = jest.fn().mockResolvedValue({
        mailAddressAlias: 'user1',
        mailAddressTitle: 'Test User'
      });

      const result = await getUserMailAddressFrom(
        { id: 1, permissions: {} },
        mockDataSource as DataSource,
        mockDomain
      );

      expect(result).toEqual({
        name: 'Test User',
        address: 'user1@' + mockDomain
      });
    });
  });
});