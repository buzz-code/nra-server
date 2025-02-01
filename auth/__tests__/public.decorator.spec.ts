import { IS_PUBLIC, Public } from '../public.decorator';

describe('Public Decorator', () => {
    it('should set IS_PUBLIC metadata to true on a method', () => {
        class TestClass {
            @Public()
            testMethod() { }
        }

        const isPublicMetadata = Reflect.getMetadata(IS_PUBLIC, TestClass.prototype.testMethod);
        expect(isPublicMetadata).toBe(true);
    });

    it('should set IS_PUBLIC metadata to true on a class', () => {
        @Public()
        class TestClass { }

        const isPublicMetadata = Reflect.getMetadata(IS_PUBLIC, TestClass);
        expect(isPublicMetadata).toBe(true);
    });
});
