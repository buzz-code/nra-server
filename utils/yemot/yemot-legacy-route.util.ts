// Sunset date for the unauthenticated /yemot/handle-call path. Unset = no cutoff.
export function getYemotLegacyRouteDeadline(): Date | null {
  const raw = process.env.YEMOT_LEGACY_ROUTE_DEADLINE;
  if (!raw) return null;
  const date = new Date(raw);
  return isNaN(date.getTime()) ? null : date;
}

export function isPastYemotLegacyRouteDeadline(): boolean {
  const deadline = getYemotLegacyRouteDeadline();
  return deadline !== null && Date.now() > deadline.getTime();
}

export const YEMOT_LEGACY_ROUTE_EXPIRED_MESSAGE =
  'התחברות זו הופסקה, יש לעדכן את קובץ ההגדרות (ext.ini) לקישור החדש. לעזרה, פנו למזכירות.';
