import * as classValidator from 'class-validator';
import { IsUniqueCombination } from "../is-unique-combination";
import * as foreignKeyUtil from '../../entity/foreignKey.util';
import { DataSource, Not } from 'typeorm';

const dataSource = new DataSource({ type: 'mysql' });
dataSource.getRepository = jest.fn().mockReturnValue({
    countBy: jest.fn(),
});
dataSource.destroy = jest.fn();

const Entity = jest.fn();
const Entity1 = jest.fn();
const Entity2 = jest.fn();

jest.mock('class-validator', () => ({
    registerDecorator: jest.fn(),
}));
jest.mock('../../entity/foreignKey.util', () => ({
    getDataSource: jest.fn(),
}));

describe('IsUniqueCombination', () => {

    beforeEach(() => {
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;
        registerDecoratorSpy.mockClear();
        const getDataSourceSpy = foreignKeyUtil.getDataSource as jest.Mock;
        getDataSourceSpy.mockResolvedValue(dataSource);
        getDataSourceSpy.mockClear();
    });

    // The function successfully registers a decorator with the name 'IsUniqueCombination'.
    it('should successfully register a decorator with the name \'IsUniqueCombination\'', () => {
        // Arrange
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;

        // Act
        IsUniqueCombination()({}, 'propertyName');

        // Assert
        expect(registerDecoratorSpy).toHaveBeenCalledWith({
            name: 'IsUniqueCombination',
            target: Object,
            propertyName: 'propertyName',
            constraints: ['propertyName'],
            options: {
                message: 'there is already a record with same values for this user and $constraint1',
            },
            validator: expect.any(Object),
        });
    });

    // The decorator is registered with the correct target, propertyName, and options.
    it('should register the decorator with the correct target, propertyName, and options', () => {
        // Arrange
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;

        // Act
        IsUniqueCombination(['otherProperty'], [])({}, 'propertyName');

        // Assert
        expect(registerDecoratorSpy).toHaveBeenCalledWith({
            name: 'IsUniqueCombination',
            target: Object,
            propertyName: 'propertyName',
            constraints: ['otherProperty, propertyName'],
            options: {
                message: 'there is already a record with same values for this user and $constraint1',
            },
            validator: expect.any(Object),
        });
    });

    // The function correctly validates a unique combination of properties.
    it('should correctly validate a unique combination of properties', async () => {
        // Arrange
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;
        const getDataSourceSpy = foreignKeyUtil.getDataSource as jest.Mock;
        const countBySpy = jest.spyOn(dataSource.getRepository(Entity), 'countBy').mockResolvedValue(0);
        IsUniqueCombination([], [Entity])({ propertyName: 'value' }, 'propertyName');
        const validator = registerDecoratorSpy.mock.calls[0][0].validator;
        const data = { propertyName: 'value', otherProperty: 'value' };

        // Act
        const result = await validator.validate(data.propertyName, { object: data });

        // Assert
        expect(getDataSourceSpy).toHaveBeenCalledWith([Entity]);
        expect(countBySpy).toHaveBeenCalledWith({
            propertyName: 'value',
            id: Not(-1),
        });
        expect(result).toBe(true);
    });

    // The function correctly handles the case when there are multiple entities.
    it('should correctly handle the case when there are multiple entities', async () => {
        // Arrange
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;
        const getDataSourceSpy = foreignKeyUtil.getDataSource as jest.Mock;
        const countBySpy = jest.spyOn(dataSource.getRepository(Entity2), 'countBy').mockResolvedValue(0);
        IsUniqueCombination(['otherProperty'], [Entity1, Entity2])({ otherProperty: 'value' }, 'propertyName');
        const validator = registerDecoratorSpy.mock.calls[0][0].validator;
        const data = { propertyName: 'value', otherProperty: 'value' };

        // Act
        const result = await validator.validate(data.propertyName, { object: data });

        // Assert
        expect(getDataSourceSpy).toHaveBeenCalledWith([Entity1, Entity2]);
        expect(countBySpy).toHaveBeenCalledWith({
            propertyName: 'value',
            otherProperty: 'value',
            id: Not(-1),
        });
        expect(result).toBe(true);
    });

    // The function correctly handles the case when there are no otherProperties.
    it('should correctly handle the case when there are no otherProperties', async () => {
        // Arrange
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;
        const getDataSourceSpy = foreignKeyUtil.getDataSource as jest.Mock;
        const countBySpy = jest.spyOn(dataSource.getRepository(Entity), 'countBy').mockResolvedValue(0);
        IsUniqueCombination([], [Entity])({ propertyName: 'value' }, 'propertyName');
        const validator = registerDecoratorSpy.mock.calls[0][0].validator;
        const data = { propertyName: 'value' };

        // Act
        const result = await validator.validate(data.propertyName, { object: data });

        // Assert
        expect(getDataSourceSpy).toHaveBeenCalledWith([Entity]);
        expect(countBySpy).toHaveBeenCalledWith({
            propertyName: 'value',
            id: Not(-1),
        });
        expect(result).toBe(true);
    });

    // The function correctly handles the case when there is only one otherProperty.
    it('should correctly handle the case when there is only one otherProperty', async () => {
        // Arrange
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;
        const getDataSourceSpy = foreignKeyUtil.getDataSource as jest.Mock;
        const countBySpy = jest.spyOn(dataSource.getRepository(Entity), 'countBy').mockResolvedValue(0);
        IsUniqueCombination(['otherProperty'], [Entity])({ otherProperty: 'value' }, 'propertyName');
        const validator = registerDecoratorSpy.mock.calls[0][0].validator;
        const data = { propertyName: 'value', otherProperty: 'value' };

        // Act
        const result = await validator.validate(data.propertyName, { object: data });

        // Assert
        expect(getDataSourceSpy).toHaveBeenCalledWith([Entity]);
        expect(countBySpy).toHaveBeenCalledWith({
            propertyName: 'value',
            otherProperty: 'value',
            id: Not(-1),
        });
        expect(result).toBe(true);
    });

    it('should handle the case when data.id is defined', async () => {
        // Arrange
        const registerDecoratorSpy = classValidator.registerDecorator as jest.Mock;
        const getDataSourceSpy = foreignKeyUtil.getDataSource as jest.Mock;
        const countBySpy = jest.spyOn(dataSource.getRepository(Entity), 'countBy').mockResolvedValue(0);
        IsUniqueCombination([], [Entity])({ propertyName: 'value', id: 1 }, 'propertyName');
        const validator = registerDecoratorSpy.mock.calls[0][0].validator;
        const data = { propertyName: 'value', id: 1 };

        // Act
        const result = await validator.validate(data.propertyName, { object: data });

        // Assert
        expect(getDataSourceSpy).toHaveBeenCalledWith([Entity]);
        expect(countBySpy).toHaveBeenCalledWith({
            propertyName: 'value',
            id: Not(1),
        });
        expect(result).toBe(true);
    });
});
