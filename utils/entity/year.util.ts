const startOfYear = new Date('2000-09-01');

function getCurrentGregorianYear() {
    const now = new Date(Date.now());
    const year = now.getFullYear();
    const isNextYear = now.getMonth() > startOfYear.getMonth() ||
        now.getMonth() === startOfYear.getMonth() && now.getDate() >= startOfYear.getDate();
        console.log('troubleshooting getCurrentGregorianYear()')
        console.log('isNextYear:', isNextYear)
        console.log('now month:', now.getMonth())
        console.log('now date:', now.getDate())
        console.log('startOfYear month:', startOfYear.getMonth())
        console.log('startOfYear date:', startOfYear.getDate())
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
