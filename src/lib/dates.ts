import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { DayIndex } from '../domain/types';

const IST = 'Asia/Kolkata';

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' });
const hm = new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false });
const stamp = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const timeOnly = new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false });

/** Today's calendar date in IST, as yyyy-MM-dd. */
export function todayIST(now: Date = new Date()): string {
  return ymd.format(now);
}

/** Minutes since midnight, IST. */
export function minutesIST(now: Date = new Date()): number {
  const [h, m] = hm.format(now).split(':').map(Number);
  return h * 60 + m;
}

export function addDaysISO(date: string, n: number): string {
  return format(addDays(parseISO(date), n), 'yyyy-MM-dd');
}

export function diffDays(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(a), parseISO(b));
}

/** Monday = 0 … Saturday = 5, Sunday = null (no classes). */
export function dayIndexOf(date: string): DayIndex | null {
  const js = parseISO(date).getDay();
  if (js === 0) return null;
  return (js - 1) as DayIndex;
}

/** Monday of the week containing `date` (Sunday rolls forward to the next Monday). */
export function weekStartOf(date: string): string {
  const js = parseISO(date).getDay();
  if (js === 0) return addDaysISO(date, 1);
  return addDaysISO(date, -(js - 1));
}

export function dateOfWeekday(weekStart: string, day: DayIndex): string {
  return addDaysISO(weekStart, day);
}

export function fmtDate(date: string, pattern = 'EEE, d MMM yyyy'): string {
  return format(parseISO(date), pattern);
}

export function fmtShort(date: string): string {
  return format(parseISO(date), 'd MMM');
}

/** e.g. "06 Oct 2026, 11:42 IST" */
export function fmtStamp(iso: string): string {
  return `${stamp.format(new Date(iso))} IST`;
}

export function fmtTimeIST(iso: string): string {
  return timeOnly.format(new Date(iso));
}

/** Builds an ISO timestamp for an IST wall-clock time on a given date. */
export function istTimestamp(date: string, hhmm: string): string {
  return new Date(`${date}T${hhmm}:00+05:30`).toISOString();
}

export function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

export function relativeLabel(date: string, today: string): string {
  const d = diffDays(date, today);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  return fmtDate(date, 'EEE d MMM');
}
