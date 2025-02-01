import * as DefaultValuesUtil from '../deafultValues.util';

describe('DefaultValuesUtil', () => {
    it('should be defined', () => {
        expect(DefaultValuesUtil).toBeDefined();
    });

    describe('fillDefaultReportDateValue', () => {
        it('should set reportDate if not defined', () => {
            const item = {} as any;
            DefaultValuesUtil.fillDefaultReportDateValue(item);
            expect(item.reportDate).toBeDefined();
        });

        it('should not set reportDate if already defined', () => {
            const item = { id: 1, reportDate: '2020-01-01' } as any;
            DefaultValuesUtil.fillDefaultReportDateValue(item);
            expect(item.reportDate).toBe('2020-01-01');
        });

        it('should not set reportDate if id is defined', () => {
            const item = { id: 1 } as any;
            DefaultValuesUtil.fillDefaultReportDateValue(item);
            expect(item.reportDate).toBeUndefined();
        });
    });

    describe('cleanDateFields', () => {
        it('should clean date fields', () => {
            const item = { id: 1, date: new Date().toISOString() } as any;
            DefaultValuesUtil.cleanDateFields(item, ['date']);
            expect(item.date.length).toBe(10);
        });
    });
})