import { DataToExcelReportGenerator } from "./data-to-excel.generator";

const generator = new DataToExcelReportGenerator(() => 'test');

describe('DataToExcelReportGenerator', () => {

    // Generates an Excel file buffer from input data with default worksheet name.
    it('should generate an Excel file buffer with default worksheet name', async () => {
        const data = {
            headerRow: ['Name', 'Age'],
            formattedData: [['John', 25], ['Jane', 30]],
        };
        const buffer = await generator.getFileBuffer(data);
        expect(buffer).toBeInstanceOf(Buffer);
    });

    // Generates an Excel file buffer from input data with custom worksheet name.
    it('should generate an Excel file buffer with custom worksheet name', async () => {
        const data = {
            headerRow: ['Name', 'Age'],
            formattedData: [['John', 25], ['Jane', 30]],
            sheetName: 'Custom Sheet',
        };
        const buffer = await generator.getFileBuffer(data);
        expect(buffer).toBeInstanceOf(Buffer);
    });

    // Generates an Excel file buffer from input data with special fields.
    it('should generate an Excel file buffer with special fields', async () => {
        const data = {
            headerRow: ['Name', 'Age'],
            formattedData: [['John', 25], ['Jane', 30]],
            specialFields: [
                { cell: { r: 1, c: 1 }, value: 'Total' },
                { cell: { r: 3, c: 2 }, value: 55 },
            ],
        };
        const buffer = await generator.getFileBuffer(data);
        expect(buffer).toBeInstanceOf(Buffer);
    });

    // Generates an Excel file buffer from input data with special fields outside of formatted data range.
    it('should generate an Excel file buffer with special fields outside of formatted data range', async () => {
        const data = {
            headerRow: ['Name', 'Age'],
            formattedData: [['John', 25], ['Jane', 30]],
            specialFields: [
                { cell: { r: 3, c: 1 }, value: 'Total' },
                { cell: { r: 5, c: 2 }, value: 55 },
            ],
        };
        const buffer = await generator.getFileBuffer(data);
        expect(buffer).toBeInstanceOf(Buffer);
    });

    // Generates an Excel file buffer from input data with special fields outside of worksheet range.
    it('should generate an Excel file buffer with special fields outside of worksheet range', async () => {
        const data = {
            headerRow: ['Name', 'Age'],
            formattedData: [['John', 25], ['Jane', 30]],
            specialFields: [
                { cell: { r: 10, c: 1 }, value: 'Total' },
                { cell: { r: 12, c: 2 }, value: 55 },
            ],
        };
        const buffer = await generator.getFileBuffer(data);
        expect(buffer).toBeInstanceOf(Buffer);
    });

    // Generates an Excel file buffer from input data with special fields with invalid cell address.
    // Generates an Excel file buffer from input data with special fields with invalid cell address.
    it('should generate an Excel file buffer with special fields with invalid cell address', async () => {
        const data = {
            headerRow: ['Name', 'Age'],
            formattedData: [['John', 25], ['Jane', 30]],
            specialFields: [
                { cell: { r: -1, c: 1 }, value: 'Total' },
                { cell: { r: 3, c: -2 }, value: 55 },
            ],
        };
        expect(async () => {
            await generator.getFileBuffer(data);
        }).rejects.toThrow();
    });
});
