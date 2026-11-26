import { addDaysISO, dayIndexOf, weekStartOf } from '../lib/dates';
import type { DayIndex, Faculty, Period, Room } from './types';

/* ------------------------------------------------------------------ */
/* Chat model                                                          */
/* ------------------------------------------------------------------ */

export interface SubItem {
  slotId: string;
  options: string[];
  chosen: string | null;
}

export interface RoomItem {
  slotId: string;
  date: string;
  options: string[];
  chosen: string | null;
}

export type ChatCard =
  | { type: 'substitutes'; date: string; facultyId: string; items: SubItem[]; status: 'proposed' | 'confirmed' | 'dismissed' }
  | { type: 'rooms'; roomId: string; items: RoomItem[]; status: 'proposed' | 'confirmed' | 'dismissed' }
  | { type: 'memory'; memoryId: string }
  | { type: 'capabilities' }
  | { type: 'choices'; prompt: string; options: string[] }
  | { type: 'link'; to: string; label: string };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  at: string;
  text: string;
  card?: ChatCard;
}

/* ------------------------------------------------------------------ */
/* Intent parsing (keywords + templates, no model)                     */
/* ------------------------------------------------------------------ */

export type Intent =
  | { kind: 'absence'; facultyId: string; date: string; day: DayIndex; from: Period; to: Period; wholeDay: boolean }
  | { kind: 'ambiguous-faculty'; matches: Faculty[]; original: string }
  | { kind: 'missing-faculty' }
  | { kind: 'room-closed'; roomId: string; dates: string[]; scopeLabel: string }
  | { kind: 'remember'; text: string; memKind: 'standing' | 'time-bound'; expires?: string }
  | { kind: 'free'; date: string; day: DayIndex; period: Period }
  | { kind: 'clashes' }
  | { kind: 'publish' }
  | { kind: 'help' }
  | { kind: 'sunday' }
  | { kind: 'unknown' };

export interface ParseCtx {
  faculty: readonly Faculty[];
  rooms: readonly Room[];
  today: string;
}

const DAY_WORDS: [RegExp, DayIndex][] = [
  [/\bmon(day)?\b/i, 0],
  [/\btue(s|sday)?\b/i, 1],
  [/\bwed(nesday)?\b/i, 2],
  [/\bthu(rs|rsday)?\b/i, 3],
  [/\bfri(day)?\b/i, 4],
  [/\bsat(urday)?\b/i, 5],
];

const TITLE = /^(dr|prof|mr|ms|ca|adv)\.?\s+/i;

function norm(s: string): string {
  return ` ${s.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ')} `;
}

export function matchFaculty(text: string, faculty: readonly Faculty[]): Faculty[] {
  const t = norm(text);
  const scored: { f: Faculty; score: number }[] = [];
  for (const f of faculty) {
    const parts = f.name.replace(TITLE, '').toLowerCase().replace(/[^a-z\s']/g, '').split(/\s+/);
    const first = parts[0];
    const last = parts[parts.length - 1];
    let score = 0;
    if (t.includes(` ${parts.join(' ')} `)) score = 3;
    else if (t.includes(` ${first} `) && t.includes(` ${last} `)) score = 3;
    else if (t.includes(` ${last} `)) score = 1;
    else if (t.includes(` ${first} `)) score = 1;
    if (score) scored.push({ f, score });
  }
  if (!scored.length) return [];
  const best = Math.max(...scored.map((s) => s.score));
  return scored.filter((s) => s.score === best).map((s) => s.f);
}

/** Resolves "Tuesday" to the next Tuesday (today counts), "today" and "tomorrow" to dates. */
export function parseDate(text: string, today: string): { date: string; day: DayIndex } | 'sunday' | null {
  const t = text.toLowerCase();
  if (/\btoday\b/.test(t)) {
    const d = dayIndexOf(today);
    return d === null ? 'sunday' : { date: today, day: d };
  }
  if (/\btomorrow\b/.test(t)) {
    const date = addDaysISO(today, 1);
    const d = dayIndexOf(date);
    return d === null ? 'sunday' : { date, day: d };
  }
  for (const [re, day] of DAY_WORDS) {
    if (re.test(t)) {
      for (let i = 0; i < 7; i++) {
        const date = addDaysISO(today, i);
        if (dayIndexOf(date) === day) return { date, day };
      }
    }
  }
  if (/\bsun(day)?\b/.test(t)) return 'sunday';
  return null;
}

export function parsePeriods(text: string): { from: Period; to: Period; whole: boolean } {
  const t = text.toLowerCase();
  const range =
    t.match(/periods?\s*(\d)\s*(?:to|-|–|—|through|till|until|and)\s*(?:period\s*|p)?(\d)/) ?? t.match(/\bp\s*(\d)\s*(?:to|-|–|—)\s*p?\s*(\d)\b/);
  const clamp = (n: number) => Math.min(8, Math.max(1, n)) as Period;
  if (range) {
    const a = clamp(Number(range[1]));
    const b = clamp(Number(range[2]));
    return { from: Math.min(a, b) as Period, to: Math.max(a, b) as Period, whole: false };
  }
  const single = t.match(/periods?\s*(\d)/) ?? t.match(/\bp(\d)\b/);
  if (single) {
    const p = clamp(Number(single[1]));
    return { from: p, to: p, whole: false };
  }
  return { from: 1, to: 8, whole: true };
}

export function matchRoom(text: string, rooms: readonly Room[]): Room | undefined {
  const t = text.toLowerCase();
  const num = t.match(/\broom\s*(\d{3})\b/) ?? t.match(/\b(\d{3})\b/);
  if (num) return rooms.find((r) => r.id === `r${num[1]}`);
  if (/seminar/.test(t)) return rooms.find((r) => r.id === 'rsem');
  if (/auditorium/.test(t)) return rooms.find((r) => r.id === 'raud');
  if (/board\s?room/.test(t)) return rooms.find((r) => r.id === 'rbrd');
  if (/lab\s*1\b/.test(t)) return rooms.find((r) => r.id === 'rlab1');
  if (/lab\s*2\b/.test(t)) return rooms.find((r) => r.id === 'rlab2');
  if (/meeting room\s*1/.test(t)) return rooms.find((r) => r.id === 'rmr1');
  if (/meeting room\s*2/.test(t)) return rooms.find((r) => r.id === 'rmr2');
  return undefined;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function parseExpiry(text: string, today: string): string | undefined {
  const t = text.toLowerCase();
  const week = weekStartOf(today);
  if (/\bthis week\b/.test(t)) return addDaysISO(week, 5);
  if (/\bnext week\b/.test(t)) return addDaysISO(week, 12);
  if (/\btoday\b/.test(t)) return today;
  if (/\btomorrow\b/.test(t)) return addDaysISO(today, 1);
  const forN = t.match(/\bfor (?:the next )?(\d+) (day|week)s?\b/);
  if (forN) return addDaysISO(today, Number(forN[1]) * (forN[2] === 'week' ? 7 : 1));
  const until = t.match(/\b(?:until|till|through)\s+(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/);
  if (until) {
    const year = Number(today.slice(0, 4));
    const m = MONTHS.indexOf(until[2]) + 1;
    let date = `${year}-${String(m).padStart(2, '0')}-${String(Number(until[1])).padStart(2, '0')}`;
    if (date < today) date = `${year + 1}${date.slice(4)}`;
    return date;
  }
  const untilDay = t.match(/\b(?:until|till|through)\s+(mon|tue|wed|thu|fri|sat)/);
  if (untilDay) {
    const d = parseDate(untilDay[1], today);
    if (d && d !== 'sunday') return d.date;
  }
  return undefined;
}

export function parseIntent(raw: string, ctx: ParseCtx): Intent {
  const text = raw.trim();
  const t = text.toLowerCase();
  if (!t) return { kind: 'unknown' };

  const remember = text.match(/^\s*(?:remember|note|keep in mind|memo)\s*[:,-]?\s+(.+)$/i);
  if (remember) {
    const body = remember[1].trim().replace(/\.$/, '');
    const standing = /\b(every|always|each|standing|permanent(ly)?|weekly|all (term|semester))\b/i.test(body);
    const expires = parseExpiry(body, ctx.today);
    if (expires && !standing) return { kind: 'remember', text: body, memKind: 'time-bound', expires };
    return { kind: 'remember', text: body, memKind: standing || !expires ? 'standing' : 'time-bound', expires: standing ? undefined : expires };
  }

  if (/\bpublish\b/.test(t)) return { kind: 'publish' };

  const closed = /\b(closed|unavailable|not available|under maintenance|maintenance|out of service|blocked|shut)\b/.test(t);
  const room = matchRoom(text, ctx.rooms);
  if (room && closed) {
    const week = weekStartOf(ctx.today);
    let dates: string[];
    let scopeLabel = 'this week';
    if (/\btoday\b/.test(t)) {
      dates = [ctx.today];
      scopeLabel = 'today';
    } else if (/\btomorrow\b/.test(t)) {
      dates = [addDaysISO(ctx.today, 1)];
      scopeLabel = 'tomorrow';
    } else {
      dates = [0, 1, 2, 3, 4, 5].map((d) => addDaysISO(week, d)).filter((d) => d >= ctx.today);
    }
    return { kind: 'room-closed', roomId: room.id, dates: dates.filter((d) => dayIndexOf(d) !== null), scopeLabel };
  }

  const absent = /\b(absent|on leave|leave|unavailable|not available|sick|unwell|away|off today|cannot come|can't come|won't be)\b/.test(t);
  if (absent) {
    const matches = matchFaculty(text, ctx.faculty);
    if (matches.length === 0) return { kind: 'missing-faculty' };
    if (matches.length > 1) return { kind: 'ambiguous-faculty', matches: matches.slice(0, 5), original: text };
    const when = parseDate(text, ctx.today) ?? (dayIndexOf(ctx.today) !== null ? { date: ctx.today, day: dayIndexOf(ctx.today)! } : 'sunday');
    if (when === 'sunday') return { kind: 'sunday' };
    const p = parsePeriods(text);
    return { kind: 'absence', facultyId: matches[0].id, date: when.date, day: when.day, from: p.from, to: p.to, wholeDay: p.whole };
  }

  if (/\b(who('s| is)? free|free faculty|who can (cover|take)|available faculty|anyone free)\b/.test(t)) {
    const when = parseDate(text, ctx.today) ?? (dayIndexOf(ctx.today) !== null ? { date: ctx.today, day: dayIndexOf(ctx.today)! } : 'sunday');
    if (when === 'sunday') return { kind: 'sunday' };
    const p = parsePeriods(text);
    return { kind: 'free', date: when.date, day: when.day, period: p.whole ? 1 : p.from };
  }

  if (/\b(clash|clashes|conflict|conflicts|issues)\b/.test(t)) return { kind: 'clashes' };
  if (/^(hi|hello|hey|help|namaste)\b|what can you do|\bhelp\b/.test(t)) return { kind: 'help' };
  return { kind: 'unknown' };
}

export const EXAMPLE_PROMPTS = [
  'Dr. Meera Iyer is absent Tuesday periods 2 to 4',
  'Room 305 is closed this week',
  'Remember: Master Talk is every Friday period 6',
  'Who is free tomorrow period 3?',
  'How many clashes are open?',
];
