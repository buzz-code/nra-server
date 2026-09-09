import { validate } from 'class-validator';
import { IsDigitsOnly } from '../is-digits-only';

describe('IsDigitsOnly', () => {
    it('should not return an error for undefined, null or an empty string', async () => {
        class Test {
            @IsDigitsOnly() key: string;
        }

        const test = new Test();
        expect(await validate(test)).toEqual([]);

        test.key = '';
        expect(await validate(test)).toEqual([]);
    });

    it('should not return an error for a digits-only string, leading zeros included', async () => {
        class Test {
            @IsDigitsOnly() key: string;
        }

        const test = new Test();
        test.key = '0123456789';
        expect(await validate(test)).toEqual([]);
    });

    it('should return an error if the value contains letters or symbols', async () => {
        class Test {
            @IsDigitsOnly() key: string;
        }

        const test = new Test();
        test.key = '12a34';
        expect(await validate(test)).not.toEqual([]);
    });

    it('should enforce an optional max length', async () => {
        class Test {
            @IsDigitsOnly(5) key: string;
        }

        const test = new Test();
        test.key = '123456';
        expect(await validate(test)).not.toEqual([]);

        test.key = '12345';
        expect(await validate(test)).toEqual([]);
    });
});
