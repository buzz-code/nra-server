import * as gematriya from "gematriya";
import { getIndexByJewishMonth, getJewishMonthInHebrew, getJewishMonthsInOrder, JewishMonth, JewishMonthType, toJewishDate } from 'jewish-date';
import { getCurrentHebrewYear } from "../entity/year.util";

const pointedMonths = {
  [JewishMonth.Nisan]: 'נִיסָן',
  [JewishMonth.Iyyar]: 'אִיָּר',
  [JewishMonth.Sivan]: 'סִיוָן',
  [JewishMonth.Tammuz]: 'תַּמּוּז',
  [JewishMonth.Av]: 'אָב',
  [JewishMonth.Elul]: 'אֱלוּל',
  [JewishMonth.Tishri]: 'תִּשְׁרֵי',
  [JewishMonth.Cheshvan]: 'חֶשְׁוָן',
  [JewishMonth.Kislev]: 'כִּסְלֵו',
  [JewishMonth.Tevet]: 'טֵבֵת',
  [JewishMonth.Shevat]: 'שְׁבָט',
  [JewishMonth.Adar]: 'אֲדָר',
  [JewishMonth.AdarI]: 'אֲדָר א׳',
  [JewishMonth.AdarII]: 'אֲדָר ב׳',
};


const hebrewLettersNames = {
  'א': 'אָלֶף',
  'ב': 'בֵּית',
  'ג': 'גִּימֵל',
  'ד': 'דָּלֶת',
  'ה': 'הֵא',
  'ו': 'וָו',
  'ז': 'זַיִן',
  'ח': 'חֵית',
  'ט': 'טֵית',
  'י': 'יוּד',
  'כ': 'כַּף',
  'ל': 'לָמֶד',
  'מ': 'מֵם',
  'נ': 'נוּן',
  'ס': 'סָמֶךְ',
  'ע': 'עַיִן',
  'פ': 'פֵּא',
  'צ': 'צָדִי',
  'ק': 'קוֹף',
  'ר': 'רֵישׁ',
  'ש': 'שִׁין',
  'ת': 'תָּו',
};

export function gematriyaLetters(number: number): string {
  const letters = gematriya(number);
  return letters.replace(/["'״׳]/g, '')
    .split('')
    .map(letter => hebrewLettersNames[letter] || letter)
    .join(' ');
}

export function getHebrewMonthsList(hebrewYear: number = getCurrentHebrewYear()) {
  return getJewishMonthsInOrder(hebrewYear)
    .map((month) => month as JewishMonthType)
    .map((month) => ({ month, index: getIndexByJewishMonth(month) }))
    .filter(({ index }) => index !== 0)
    .map(({ month, index }, key) => ({
      month,
      index,
      key: key + 1,
      name: getJewishMonthInHebrew(month),
    }));
}

export function formatHebrewDateForIVR(date: Date): string {
  const hebrewDateObj = toJewishDate(date);
  const datePart = gematriyaLetters(hebrewDateObj.day);
  const monthPart = pointedMonths[hebrewDateObj.monthName];
  const yearPart = gematriyaLetters(hebrewDateObj.year % 1000);
  return `${datePart} ${monthPart} ${yearPart}`;
}