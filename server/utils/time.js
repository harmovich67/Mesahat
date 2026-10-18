import { DateTime } from 'luxon';

export const DEFAULT_TZ = 'Africa/Cairo';

/** Parses 'HH:MM' (also '24:00') on a given calendar date inside a timezone. */
export function atTime(dateISO, hhmm, tz = DEFAULT_TZ) {
  const [h, m] = hhmm.split(':').map(Number);
  const base = DateTime.fromISO(dateISO, { zone: tz }).startOf('day');
  return base.plus({ hours: h, minutes: m });
}

export const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && DateTime.fromISO(s).isValid;
export const isValidTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export const toJSDate = (dt) => dt.toUTC().toJSDate();

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/** weekday: 0 = Sunday .. 6 = Saturday (luxon uses 1 = Monday .. 7 = Sunday) */
export const weekdayOf = (dt) => dt.weekday % 7;

export function formatMoney(amount, currency = 'EGP') {
  const n = Number(amount || 0);
  const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
  return currency === 'EGP' ? `${num} ج.م` : `${num} ${currency}`;
}

export function formatDateTimeAr(date, tz = DEFAULT_TZ) {
  return DateTime.fromJSDate(new Date(date)).setZone(tz).setLocale('ar-EG').toFormat('d LLLL yyyy، h:mm a');
}
