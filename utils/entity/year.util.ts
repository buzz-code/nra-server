import { toJewishDate, toGregorianDate, JewishMonth } from 'jewish-date';

const startOfYear = new Date('2000-09-01');

const getGregorianYearByStartDate = (yearStartDate: Date, now: Date) => {
    const year = now.getFullYear();
    const isNextYear = now.getMonth() > yearStartDate.getMonth() ||
        now.getMonth() === yearStartDate.getMonth() && now.getDate() >= yearStartDate.getDate();
    return year + (isNextYear ? 1 : 0);
}

const getCurrentGregorianYearByStartDate = (yearStartDate: Date) => {
    const now = new Date(Date.now());
    return getGregorianYearByStartDate(yearStartDate, now);
}


const getCurrentGregorianYear = () => {
    return getCurrentGregorianYearByStartDate(startOfYear);
}

function getRoshHashanaDate(gregorianYear: number): Date {
    const roshHashana = toGregorianDate({
        year: gregorianYear + 3761,
        monthName: JewishMonth.Tishri,
        day: 1
    });
    return roshHashana;
}

function isInProblematicPeriod(now: Date): boolean {
    const year = now.getFullYear();
    const academicYearStart = new Date(year, startOfYear.getMonth(), startOfYear.getDate());
    const roshHashana = getRoshHashanaDate(year);

    return now >= academicYearStart && now < roshHashana;
}

export const getHebrewYearByGregorianDate = (gregorianDate: Date) => {
    const jewishDate = toJewishDate(gregorianDate);
    let hebrewYear = jewishDate.year;

    if (isInProblematicPeriod(gregorianDate)) {
        hebrewYear += 1;
    }

    return hebrewYear;
}

export const getCurrentHebrewYear = () => {
    const now = new Date(Date.now());
    return getHebrewYearByGregorianDate(now);
}

export function fillDefaultYearValue(item: { id: number, year: number }) {
    if (!item.id && !item.year) {
        item.year = getCurrentHebrewYear();
    }
}

export function getCurrentYearMonths(): Date[] {
    const currentGregorianYear = getCurrentGregorianYear();
    const startMonth = startOfYear.getMonth();
    const yearMonths = Array.from({ length: 12 }, (_, i) => new Date(currentGregorianYear - 1, startMonth + i, 1));
    return yearMonths.sort((a, b) => a.getTime() - b.getTime());
}
