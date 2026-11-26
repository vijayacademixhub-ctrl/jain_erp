import { addDaysISO } from '../lib/dates';
import { PERIODS } from './constants';
import type { Slot } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

function stamp(date: string, hhmm: string): string {
  return `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export interface IcsEvent {
  slot: Slot;
  title: string;
  location: string;
  description: string;
}

/**
 * Weekly-recurring calendar (RFC 5545) for a faculty timetable,
 * in Asia/Kolkata local time, repeating until the end of term.
 */
export function buildIcs(calName: string, weekStart: string, termEnd: string, events: IcsEvent[]): string {
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const until = `${termEnd.replace(/-/g, '')}T235959`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CMS Business School//Timetable Platform Demo//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(calName)}`,
    'X-WR-TIMEZONE:Asia/Kolkata',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Kolkata',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0530',
    'TZOFFSETTO:+0530',
    'TZNAME:IST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  for (const e of events) {
    const info = PERIODS[e.slot.period - 1];
    const date = addDaysISO(weekStart, e.slot.day);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.slot.id}-${weekStart}@timetable.cms.example`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Asia/Kolkata:${stamp(date, info.start)}`,
      `DTEND;TZID=Asia/Kolkata:${stamp(date, info.end)}`,
      `RRULE:FREQ=WEEKLY;UNTIL=${until}`,
      `SUMMARY:${esc(e.title)}`,
      `LOCATION:${esc(e.location)}`,
      `DESCRIPTION:${esc(e.description)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
