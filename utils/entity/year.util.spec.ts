import { getCurrentHebrewYear, fillDefaultYearValue } from './year.util';


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
})