import 'reflect-metadata';
import { plainToClass, Type } from "class-transformer";
import { StringType, NumberType, DateType } from "../class-transformer";

describe('class-transformer', () => {
    it('string type', () => {
        class Test {
            @StringType key: any;
        }
        const test = { key: 1 };
        const result = plainToClass(Test, test);
        expect(result.key).toBe('1');

        const test2 = { key: 'a' };
        const result2 = plainToClass(Test, test2);
        expect(result2.key).toBe('a');
    });

    it('number type', () => {
        class Test {
            @NumberType key: any;
        }
        const test = { key: '1' };
        const result = plainToClass(Test, test);
        expect(result.key).toBe(1);

        const test2 = { key: 'a' };
        const result2 = plainToClass(Test, test2);
        expect(result2.key).toBe('a');
    });

    it('date type', () => {
        class Test {
            @DateType key: any;
        }
        const test = { key: new Date().toISOString() };
        const result = plainToClass(Test, test);
        expect(result.key).toBeInstanceOf(Date);

        const test2 = { key: 'a' };
        const result2 = plainToClass(Test, test2);
        expect(result2.key).toBe('a');
    });
});
