import { getCurrentHebrewYear, getHebrewYearByGregorianDate } from '../year.util';

describe('Year Util Behavior Tests - Current Logic', () => {
    // Save original Date.now
    const originalDateNow = Date.now;

    afterEach(() => {
        // Restore original Date.now
        global.Date.now = originalDateNow;
    });

    const testCases = [
        // Before September 1st - should use current Hebrew year
        { date: '2025-08-30T12:00:00Z', description: '30 August 2025 (before academic year)', expected: 5785 },
        { date: '2025-08-31T23:59:59Z', description: '31 August 2025 (last day before academic year)', expected: 5785 },
        
        // After September 1st - should use next Hebrew year (academic year logic)
        { date: '2025-09-01T00:00:00Z', description: '1 September 2025 (start of academic year)', expected: 5786 },
        { date: '2025-09-12T12:00:00Z', description: '12 September 2025 (before Rosh Hashana)', expected: 5786 },
        { date: '2025-09-16T12:00:00Z', description: '16 September 2025 (around Rosh Hashana)', expected: 5786 },
        { date: '2025-10-15T12:00:00Z', description: '15 October 2025 (after Rosh Hashana)', expected: 5786 },
        { date: '2025-12-31T23:59:59Z', description: '31 December 2025 (end of gregorian year)', expected: 5786 },
        
        // Next year cases
        { date: '2026-01-15T12:00:00Z', description: '15 January 2026 (middle of Hebrew year)', expected: 5786 },
        { date: '2026-06-15T12:00:00Z', description: '15 June 2026 (before new academic year)', expected: 5786 },
        { date: '2026-08-31T23:59:59Z', description: '31 August 2026 (before next academic year)', expected: 5786 },
        { date: '2026-09-01T00:00:00Z', description: '1 September 2026 (start of next academic year)', expected: 5787 },
        
        // Edge cases around different years
        { date: '2024-09-01T12:00:00Z', description: '1 September 2024', expected: 5785 },
        { date: '2024-08-31T12:00:00Z', description: '31 August 2024', expected: 5784 },
        
        // Very early in year
        { date: '2025-01-01T12:00:00Z', description: '1 January 2025 (middle of Hebrew year)', expected: 5785 },
        { date: '2025-06-15T12:00:00Z', description: '15 June 2025 (summer)', expected: 5785 },
    ];

    describe('getCurrentHebrewYear behavior documentation', () => {
        testCases.forEach(({ date, description, expected }) => {
            it(`should return ${expected} for ${description}`, () => {
                // Mock Date.now to return the test date
                jest.spyOn(global.Date, 'now').mockImplementation(() =>
                    new Date(date).valueOf()
                );

                const result = getCurrentHebrewYear();
                expect(result).toBe(expected);
                
                console.log(`${description}: ${result} (expected: ${expected})`);
            });
        });
    });

    describe('getHebrewYearByGregorianDate behavior documentation', () => {
        testCases.forEach(({ date, description, expected }) => {
            it(`should return ${expected} for ${description} using getHebrewYearByGregorianDate`, () => {
                const testDate = new Date(date);
                const result = getHebrewYearByGregorianDate(testDate);
                expect(result).toBe(expected);
                
                console.log(`${description} (via getHebrewYearByGregorianDate): ${result} (expected: ${expected})`);
            });
        });
    });

    // Edge case - exactly on the boundary
    describe('September 1st boundary cases', () => {
        it('should handle exact midnight on September 1st', () => {
            jest.spyOn(global.Date, 'now').mockImplementation(() =>
                new Date('2025-09-01T00:00:00Z').valueOf()
            );
            
            const result = getCurrentHebrewYear();
            expect(result).toBe(5786);
            console.log(`Exactly midnight Sept 1st 2025: ${result}`);
        });

        it('should handle one second before midnight on August 31st', () => {
            jest.spyOn(global.Date, 'now').mockImplementation(() =>
                new Date('2025-08-31T23:59:59Z').valueOf()
            );
            
            const result = getCurrentHebrewYear();
            expect(result).toBe(5785);
            console.log(`One second before midnight Aug 31st 2025: ${result}`);
        });
    });
});