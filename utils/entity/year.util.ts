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

const getHebrewYearByGregorianYear = (gregorianYear: number) => {
    return gregorianYear + 3760;
}

const getCurrentGregorianYear = () => {
    return getCurrentGregorianYearByStartDate(startOfYear);
}

export const getCurrentHebrewYear = () => {
    const currentGregorianYear = getCurrentGregorianYear();
    return getHebrewYearByGregorianYear(currentGregorianYear);
}

export function fillDefaultYearValue(item: { id: number, year: number }) {
    if (!item.id && !item.year) {
        item.year = getCurrentHebrewYear();
    }
}

export function getCurrentYearMonths() {
    const currentYear = getCurrentGregorianYear();
    return Array.from({ length: 12 }, (_, i) => {
        const monthDate = new Date(currentYear, i, 1);
        monthDate.setFullYear(getGregorianYearByStartDate(startOfYear, monthDate));
        return monthDate;
    })
        .sort((a, b) => a.getTime() - b.getTime());
}
