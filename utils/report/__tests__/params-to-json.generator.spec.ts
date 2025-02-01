import { ParamsToJsonReportGenerator } from "../params-to-json.generator";

const generator = new ParamsToJsonReportGenerator(() => 'test');

describe('ParamsToJsonReportGenerator', () => {
    it('should return a Buffer containing the JSON stringified version of the input data', async () => {
        const data = { name: 'John', age: 30 };
        const expectedBuffer = Buffer.from(JSON.stringify(data, null, 2));

        const result = await generator.getFileBuffer(data);

        expect(result).toEqual(expectedBuffer);
    });

    it('should handle empty input data', async () => {
        const data = {};
        const expectedBuffer = Buffer.from(JSON.stringify(data, null, 2));

        const result = await generator.getFileBuffer(data);

        expect(result).toEqual(expectedBuffer);
    });

    it('should handle input data with undefined or null values', async () => {
        const data = { name: 'John', age: null, address: undefined };
        const expectedBuffer = Buffer.from(JSON.stringify(data, null, 2));

        const result = await generator.getFileBuffer(data);

        expect(result).toEqual(expectedBuffer);
    });
});
