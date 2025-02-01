// Mock dependencies
const registerDecoratorMock = jest.fn();
jest.doMock('class-validator', () => ({
    registerDecorator: registerDecoratorMock,
}));
jest.doMock('../current-user.util', () => ({
    getCurrentUser: jest.fn().mockReturnValue({
        permissions: {},
        id: 1,
    }),
}));
const getDataSourceMock = jest.fn().mockResolvedValue({
    getRepository: jest.fn().mockReturnValue({
        countBy: jest.fn().mockResolvedValue(5),
    }),
    destroy: jest.fn(),
});
jest.doMock('../../entity/foreignKey.util', () => ({
    getDataSource: getDataSourceMock,
}));

// Import the function
const { MaxCountByUserLimit } = require('../max-count-by-user-limit')

// Define the constraints and options
const entity = jest.fn();
const getMaxLimit = jest.fn().mockResolvedValue(10);
const entities = [jest.fn()];
const foreignKey = 'id';
const validationOptions = { message: 'max limit reached for $constraint1' };

// Mock the necessary objects
const object = {};
const propertyName = 'propertyName';
const value = 5;
const args = { object, propertyName };


describe('MaxCountByUserLimit', () => {
    beforeEach(() => {
        registerDecoratorMock.mockClear();
        getMaxLimit.mockClear();
    });

    // The function should successfully register a decorator with the given constraints and options.
    it('should successfully register a decorator with the given constraints and options', () => {
        // Define the constraints and options
        const entity = jest.fn();
        const getMaxLimit = jest.fn();
        const entities = [jest.fn()];
        const foreignKey = 'id';

        // Call the function
        MaxCountByUserLimit(entity, getMaxLimit, entities, foreignKey, validationOptions)(Object, 'propertyName');

        // Assert that the decorator is registered with the correct arguments
        expect(registerDecoratorMock).toHaveBeenCalledTimes(1);
        expect(registerDecoratorMock).toHaveBeenCalledWith({
            name: 'MaxCountByUserLimit',
            target: expect.any(Function),
            propertyName: 'propertyName',
            constraints: ['mockConstructor'],
            options: {
                message: 'max limit reached for $constraint1',
                ...validationOptions,
            },
            validator: expect.any(Object),
        });
    });

    // The function should validate the input value against the maximum limit returned by getMaxLimit function.
    it('should validate the input value against the maximum limit returned by getMaxLimit function', async () => {
        // Define the constraints and options

        // Call the function
        MaxCountByUserLimit(entity, getMaxLimit, entities, foreignKey, validationOptions)(Object, 'propertyName');

        // Get the validator function from the registered decorator
        const validatorFunction = registerDecoratorMock.mock.calls[0][0].validator.validate;

        // Call the validator function
        const result = await validatorFunction(value, args);

        // Assert that the result is true (count is less than max limit)
        expect(result).toBe(true);
    });

    // The function should handle the case where getMaxLimit function throws an error.
    it('should handle the case where getMaxLimit function throws an error', async () => {
        // Define the constraints and options
        const getMaxLimit = jest.fn().mockRejectedValue(new Error('Max limit error'));

        // Call the function
        MaxCountByUserLimit(entity, getMaxLimit, entities, foreignKey, validationOptions)(Object, 'propertyName');

        // Get the validator function from the registered decorator
        const validatorFunction = registerDecoratorMock.mock.calls[0][0].validator.validate;

        // Call the validator function
        const result = await validatorFunction(value, args);

        // Assert that the result is false (error occurred)
        expect(result).toBe(false);
    });
});
