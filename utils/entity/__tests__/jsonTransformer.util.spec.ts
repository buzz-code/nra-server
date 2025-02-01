import JsonTransformer from "../jsonTransformer.util";

describe('JsonTransformerUtil', () => {
    it('should be defined', () => {
        expect(JsonTransformer).toBeDefined();
    });

    describe('to', () => {
        it('should be defined', () => {
            const jsonTransformer = new JsonTransformer();
            expect(jsonTransformer.to).toBeDefined();
        });

        it('should return a string', () => {
            const jsonTransformer = new JsonTransformer();
            const result = jsonTransformer.to({ id: 1 });
            expect(result).toBe('{"id":1}');
        });
    });

    describe('from', () => {
        it('should be defined', () => {
            const jsonTransformer = new JsonTransformer();
            expect(jsonTransformer.from).toBeDefined();
        });

        it('should return an object', () => {
            const jsonTransformer = new JsonTransformer();
            const result = jsonTransformer.from('{"id":1}');
            expect(result).toEqual({ id: 1 });
        });
    });
})