import { IsBoolean, validate } from 'class-validator';

jest.mock('../max-count-by-user-limit', () => ({
    MaxCountByUserLimit: IsBoolean,
}));

import {
    IsNotEmpty,
    MaxLength,
    IsNumber,
    IsInt,
    MaxCountByUserLimit,
    getTranslatedConstraint,
    IsDigitsOnly,
} from '../class-validator-he';

describe('class-validator-he', () => {
    describe('IsNotEmpty', () => {
        it('should return a function', () => {
            expect(IsNotEmpty()).toBeInstanceOf(Function);
        });

        it('should not return an error message if the value is not empty', async () => {
            class Test {
                @IsNotEmpty() key: string;
            }

            const test = new Test();
            test.key = 'test';
            const result = await validate(test);
            expect(result).toEqual([]);
        });

        it('should return an error message if the value is empty', async () => {
            class Test {
                @IsNotEmpty() key: string;
            }

            const test = new Test();
            const result = await validate(test);
            expect(result).not.toEqual([]);
        });
    });

    describe('MaxLength', () => {
        it('should return a function', () => {
            expect(MaxLength(10)).toBeInstanceOf(Function);
        });

        it('should not return an error message if the value is less than the max length', async () => {
            class Test {
                @MaxLength(10) key: string;
            }

            const test = new Test();
            test.key = 'test';
            const result = await validate(test);
            expect(result).toEqual([]);
        });

        it('should return an error message if the value is greater than the max length', async () => {
            class Test {
                @MaxLength(10) key: string;
            }

            const test = new Test();
            test.key = 'testtesttest';
            const result = await validate(test);
            expect(result).not.toEqual([]);
        });
    });

    describe('IsNumber', () => {
        it('should return a function', () => {
            expect(IsNumber()).toBeInstanceOf(Function);
        });

        it('should not return an error message if the value is a number', async () => {
            class Test {
                @IsNumber() key: number;
            }

            const test = new Test();
            test.key = 1.7;
            const result = await validate(test);
            expect(result).toEqual([]);
        });

        it('should return an error message if the value is not a number', async () => {
            class Test {
                @IsNumber() key: number;
            }

            const test = new Test();
            test.key = 'test' as any;
            const result = await validate(test);
            expect(result).not.toEqual([]);
        });
    });

    describe('IsInt', () => {
        it('should return a function', () => {
            expect(IsInt()).toBeInstanceOf(Function);
        });

        it('should not return an error message if the value is an integer', async () => {
            class Test {
                @IsInt() key: number;
            }

            const test = new Test();
            test.key = 1;
            const result = await validate(test);
            expect(result).toEqual([]);
        });

        it('should return an error message if the value is not an integer', async () => {
            class Test {
                @IsInt() key: number;
            }

            const test = new Test();
            test.key = 1.7;
            const result = await validate(test);
            expect(result).not.toEqual([]);
        });
    });

    describe('MaxCountByUserLimit', () => {
        it('should return a function', () => {
            expect(MaxCountByUserLimit(null, null)).toBeInstanceOf(Function);
        });

        it('should mock the function', async () => {
            class Test {
                @MaxCountByUserLimit(null, null) key: boolean;
            }

            const test = new Test();
            test.key = true;
            const result = await validate(test);
            expect(result).toEqual([]);
        });
    });

    describe('getTranslatedConstraint', () => {
        it('should return the correct translated constraint', () => {
            expect(getTranslatedConstraint('StudentByYear')).toBe('שיוך תלמידות');
        });
    });

    describe('IsDigitsOnly', () => {
        it('should return a function', () => {
            expect(IsDigitsOnly()).toBeInstanceOf(Function);
        });

        it('should not return an error message for undefined, null or an empty string', async () => {
            class Test {
                @IsDigitsOnly() key: string;
            }

            const test = new Test();
            const result = await validate(test);
            expect(result).toEqual([]);

            test.key = '';
            expect(await validate(test)).toEqual([]);
        });

        it('should not return an error message for a digits-only string, leading zeros included', async () => {
            class Test {
                @IsDigitsOnly() key: string;
            }

            const test = new Test();
            test.key = '0123456789';
            const result = await validate(test);
            expect(result).toEqual([]);
        });

        it('should return an error message if the value contains letters or symbols', async () => {
            class Test {
                @IsDigitsOnly() key: string;
            }

            const test = new Test();
            test.key = '12a34';
            const result = await validate(test);
            expect(result).not.toEqual([]);
        });

        it('should enforce an optional max length', async () => {
            class Test {
                @IsDigitsOnly(5) key: string;
            }

            const test = new Test();
            test.key = '123456';
            const result = await validate(test);
            expect(result).not.toEqual([]);
        });
    });
});
