import { getCurrentHebrewYear, fillDefaultYearValue, getCurrentYearMonths } from '../year.util';


describe('yearUtil', () => {
    describe('getCurrentHebrewYear', () => {
        it('should return the correct Hebrew year for the current Gregorian year', () => {
            jest.spyOn(global.Date, 'now').mockImplementation(() =>
                new Date('2024-01-01T00:00:00Z').valueOf()
            );

            const hebrewYear = getCurrentHebrewYear();
            expect(hebrewYear).toBe(5784);
        });

        it('should return next year if after august', () => {
            jest.spyOn(global.Date, 'now').mockImplementation(() =>
                new Date('2024-09-01T00:00:00Z').valueOf()
            );

            const hebrewYear = getCurrentHebrewYear();
            expect(hebrewYear).toBe(5785);
        });
    });


    describe('fillDefaultYearValue', () => {
        it('should set the year to the current Hebrew year if both id and year are not provided', () => {
            const item = { id: undefined, year: undefined };
            fillDefaultYearValue(item);
            const currentHebrewYear = getCurrentHebrewYear();
            expect(item.year).toBe(currentHebrewYear);
        });

        it('should not modify the year if id or year is provided', () => {
            const item = { id: 1, year: 1234 };
            fillDefaultYearValue(item);
            expect(item.year).toBe(1234);
        });
    });

    describe('getCurrentYearMonths', () => {
        it('should return 12 items representing the months', () => {
            const months = getCurrentYearMonths();
            expect(months).toHaveLength(12);
        });

        it('should not repeat months', () => {
            const months = getCurrentYearMonths();
            const uniqueMonths = new Set(months.map(date => date.getMonth()));
            expect(uniqueMonths.size).toBe(12);
        });

        it('should be ordered in the order of the months', () => {
            const months = getCurrentYearMonths();
            for (let i = 0; i < months.length - 1; i++) {
                expect(months[i].getTime()).toBeLessThan(months[i + 1].getTime());
            }
        });

        it('should start with september', () => {
            const months = getCurrentYearMonths();
            expect(months[0].getMonth()).toBe(8);
        });

        it('should have different years for the first and last month', () => {
            const months = getCurrentYearMonths();
            expect(months[0].getFullYear()).not.toBe(months[11].getFullYear());
        });
    });
})