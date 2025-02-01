import * as classValidator from 'class-validator';
import { IsUniqueDateRange } from "../is-unique-date-range";
import * as foreignKeyUtil from '../../entity/foreignKey.util';
import { DataSource, LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm';

const dataSource = new DataSource({ type: 'mysql' });
dataSource.getRepository = jest.fn().mockReturnValue({
    countBy: jest.fn(),
});
dataSource.destroy = jest.fn();

const Entity = jest.fn();

jest.mock('class-validator', () => ({
    registerDecorator: jest.fn(),
}));
jest.mock('../../entity/foreignKey.util', () => ({
    getDataSource: jest.fn(),
}));

let mockRequestContext = {
    currentContext: {
        req: {
            user: { id: 999 }
        }
    }
};

jest.mock('nestjs-request-context', () => ({
    get RequestContext() {
        return mockRequestContext;
    }
}));

describe('IsUniqueDateRange', () => {
    beforeEach(() => {
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;
        registerDecoratorSpy.mockClear();
        const getDataSourceSpy = foreignKeyUtil.getDataSource as jest.Mock;
        getDataSourceSpy.mockResolvedValue(dataSource);
        getDataSourceSpy.mockClear();
        const countBySpy = jest.spyOn(dataSource.getRepository(Entity), 'countBy');
        countBySpy.mockClear();
    });

    it('should validate non-overlapping date ranges', async () => {
        // Arrange
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;
        const getDataSourceSpy = foreignKeyUtil.getDataSource as jest.Mock;
        const countBySpy = jest.spyOn(dataSource.getRepository(Entity), 'countBy').mockResolvedValue(0);

        IsUniqueDateRange('startDate', 'endDate', [Entity])({}, 'propertyName');
        const validator = registerDecoratorSpy.mock.calls[0][0].validator;
        const data = {
            startDate: '2023-01-01',
            endDate: '2023-01-31',
            userId: 1
        };

        // Act
        const result = await validator.validate(data.startDate, { object: data });

        // Assert
        expect(getDataSourceSpy).toHaveBeenCalledWith([Entity]);
        expect(countBySpy).toHaveBeenCalledWith({
            startDate: LessThanOrEqual('2023-01-31'),
            endDate: MoreThanOrEqual('2023-01-01'),
            userId: 1,
            id: Not(-1)
        });
        expect(result).toBe(true);
    });

    it('should reject overlapping date ranges', async () => {
        // Arrange
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;
        const countBySpy = jest.spyOn(dataSource.getRepository(Entity), 'countBy').mockResolvedValue(1);

        IsUniqueDateRange('startDate', 'endDate', [Entity])({}, 'propertyName');
        const validator = registerDecoratorSpy.mock.calls[0][0].validator;
        const data = {
            startDate: '2023-01-15',
            endDate: '2023-02-15',
            userId: 1
        };

        // Act
        const result = await validator.validate(data.startDate, { object: data });

        // Assert
        expect(countBySpy).toHaveBeenCalledWith({
            startDate: LessThanOrEqual('2023-02-15'),
            endDate: MoreThanOrEqual('2023-01-15'),
            userId: 1,
            id: Not(-1)
        });
        expect(result).toBe(false);
    });

    it('should exclude current record when validating update', async () => {
        // Arrange
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;
        const countBySpy = jest.spyOn(dataSource.getRepository(Entity), 'countBy').mockResolvedValue(0);

        IsUniqueDateRange('startDate', 'endDate', [Entity])({}, 'propertyName');
        const validator = registerDecoratorSpy.mock.calls[0][0].validator;
        const data = {
            id: 1,
            startDate: '2023-01-01',
            endDate: '2023-01-31',
            userId: 1
        };

        // Act
        const result = await validator.validate(data.startDate, { object: data });

        // Assert
        expect(countBySpy).toHaveBeenCalledWith({
            startDate: LessThanOrEqual('2023-01-31'),
            endDate: MoreThanOrEqual('2023-01-01'),
            userId: 1,
            id: Not(1)
        });
        expect(result).toBe(true);
    });

    it('should handle missing user context gracefully', async () => {
        // Arrange
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;
        const countBySpy = jest.spyOn(dataSource.getRepository(Entity), 'countBy').mockResolvedValue(0);
        
        // Temporarily remove user context
        const originalContext = mockRequestContext;
        mockRequestContext = { currentContext: undefined };

        IsUniqueDateRange('startDate', 'endDate', [Entity])({}, 'propertyName');
        const validator = registerDecoratorSpy.mock.calls[0][0].validator;
        const data = {
            id: 1,
            startDate: '2023-01-01',
            endDate: '2023-01-31',
            userId: 1
        };

        // Act
        const result = await validator.validate(data.startDate, { object: data });

        // Restore user context
        mockRequestContext = originalContext;

        // Assert
        expect(countBySpy).toHaveBeenCalledWith({
            startDate: LessThanOrEqual('2023-01-31'),
            endDate: MoreThanOrEqual('2023-01-01'),
            userId: 1,
            id: Not(1)
        });
        expect(result).toBe(true);
    });

    it('should register decorator with correct constraints', () => {
        // Arrange
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;

        // Act
        IsUniqueDateRange('startDate', 'endDate', [Entity])({}, 'propertyName');

        // Assert
        expect(registerDecoratorSpy).toHaveBeenCalledWith(expect.objectContaining({
            constraints: ['startDate', 'endDate'],
            options: expect.objectContaining({
                message: 'there is already a record with overlapping dates for this user between $constraint1 and $constraint2'
            })
        }));
    });

    it('should validate when date fields do not exist in object', async () => {
        // Arrange
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;
        const countBySpy = jest.spyOn(dataSource.getRepository(Entity), 'countBy');

        IsUniqueDateRange('nonExistentStartDate', 'nonExistentEndDate', [Entity])({}, 'propertyName');
        const validator = registerDecoratorSpy.mock.calls[0][0].validator;
        const data = {
            id: 1,
            userId: 1
        };

        // Act
        const result = await validator.validate('some value', { object: data });

        // Assert
        expect(countBySpy).not.toHaveBeenCalled();
        expect(result).toBe(true);
    });
});
