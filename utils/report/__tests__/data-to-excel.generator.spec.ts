import { DataToExcelReportGenerator, getDateDataValidation, getIntegerDataValidation } from "../data-to-excel.generator";

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

describe('getIntegerDataValidation', () => {
    // Generates an Excel data validation object for integers with default values.
    it('should generate an Excel data validation object for integers with default values', () => {
        const dataValidation = getIntegerDataValidation();
        expect(dataValidation).toHaveProperty('type', 'whole');
        expect(dataValidation).toHaveProperty('operator', 'between');
        expect(dataValidation).toHaveProperty('formulae', [0, 999]);
        expect(dataValidation).toHaveProperty('allowBlank', true);
        expect(dataValidation).toHaveProperty('error', 'הערך חייב להיות מספר חיובי');
        expect(dataValidation).toHaveProperty('errorTitle', 'הערך אינו מספר חיובי');
    });

    // Generates an Excel data validation object for integers with custom values.
    it('should generate an Excel data validation object for integers with custom values', () => {
        const dataValidation = getIntegerDataValidation(false, 'Invalid number', 'Invalid number');
        expect(dataValidation).toHaveProperty('type', 'whole');
        expect(dataValidation).toHaveProperty('operator', 'between');
        expect(dataValidation).toHaveProperty('formulae', [0, 999]);
        expect(dataValidation).toHaveProperty('allowBlank', false);
        expect(dataValidation).toHaveProperty('error', 'Invalid number');
        expect(dataValidation).toHaveProperty('errorTitle', 'Invalid number');
    });
});

describe('getDateDataValidation', () => {
    // Generates an Excel data validation object for dates with default values.
    it('should generate an Excel data validation object for dates with default values', () => {
        const dataValidation = getDateDataValidation();
        expect(dataValidation).toHaveProperty('type', 'date');
        expect(dataValidation).toHaveProperty('formulae', expect.any(Array));
        expect(dataValidation).toHaveProperty('allowBlank', true);
        expect(dataValidation).toHaveProperty('error', 'הערך חייב להיות תאריך תקין');
        expect(dataValidation).toHaveProperty('errorTitle', 'הערך אינו תאריך תקין');
    });

    // Generates an Excel data validation object for dates with custom values.
    it('should generate an Excel data validation object for dates with custom values', () => {
        const dataValidation = getDateDataValidation(false, 'Invalid date', 'Invalid date');
        expect(dataValidation).toHaveProperty('type', 'date');
        expect(dataValidation).toHaveProperty('formulae', expect.any(Array));
        expect(dataValidation).toHaveProperty('allowBlank', false);
        expect(dataValidation).toHaveProperty('error', 'Invalid date');
        expect(dataValidation).toHaveProperty('errorTitle', 'Invalid date');
    });
});
