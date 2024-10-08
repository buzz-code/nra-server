const startOfYear = new Date('2000-09-01');

function getCurrentGregorianYear() {
    const now = new Date(Date.now());
    const year = now.getFullYear();
    const isNextYear = now.getMonth() > startOfYear.getMonth() ||
        now.getMonth() === startOfYear.getMonth() && now.getDate() >= startOfYear.getDate();
    return year + (isNextYear ? 1 : 0);
}

export function getCurrentHebrewYear() {
    const gregorianYear = getCurrentGregorianYear();
    return gregorianYear + 3760;
}

export function fillDefaultYearValue(item: { id: number, year: number }) {
    if (!item.id && !item.year) {
        item.year = getCurrentHebrewYear();
    }
}
