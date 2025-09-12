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

    describe('getCurrentHebrewYear with useAcademicYear parameter', () => {
        it('should return academic year when useAcademicYear=true (default)', () => {
            // 12 September 2025 - between academic year start and Rosh Hashana
            jest.spyOn(global.Date, 'now').mockImplementation(() =>
                new Date('2025-09-12T12:00:00Z').valueOf()
            );

            const academicYear = getCurrentHebrewYear(); // default is true
            const academicYearExplicit = getCurrentHebrewYear(true);

            expect(academicYear).toBe(5786); // Academic year
            expect(academicYearExplicit).toBe(5786); // Academic year
        });

        it('should return actual Hebrew year when useAcademicYear=false', () => {
            // 12 September 2025 - still in 5785 according to actual Hebrew calendar
            jest.spyOn(global.Date, 'now').mockImplementation(() =>
                new Date('2025-09-12T12:00:00Z').valueOf()
            );

            const actualYear = getCurrentHebrewYear(false);
            
            expect(actualYear).toBe(5785); // Actual Hebrew year (before Rosh Hashana)
        });

        it('should behave the same for both modes after Rosh Hashana', () => {
            // 20 October 2025 - after Rosh Hashana
            jest.spyOn(global.Date, 'now').mockImplementation(() =>
                new Date('2025-10-20T12:00:00Z').valueOf()
            );

            const academicYear = getCurrentHebrewYear(true);
            const actualYear = getCurrentHebrewYear(false);
            
            expect(academicYear).toBe(5786);
            expect(actualYear).toBe(5786);
        });

        it('should behave the same for both modes before September', () => {
            // 15 August 2025 - before academic year and before Rosh Hashana
            jest.spyOn(global.Date, 'now').mockImplementation(() =>
                new Date('2025-08-15T12:00:00Z').valueOf()
            );

            const academicYear = getCurrentHebrewYear(true);
            const actualYear = getCurrentHebrewYear(false);
            
            expect(academicYear).toBe(5785);
            expect(actualYear).toBe(5785);
        });
    });
})