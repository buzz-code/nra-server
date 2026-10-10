export function FormatString(str: string, val: string[]) {
  return str.replace(/{([\d]*)}/g, (_, index) => val[index]);
}
