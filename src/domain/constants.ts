import type { DayIndex, FixedLabel, Period, Program, Semester, ShiftId } from './types';

export const DAYS: readonly string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_INDEXES: readonly DayIndex[] = [0, 1, 2, 3, 4, 5];

export interface PeriodInfo {
  p: Period;
  start: string;
  end: string;
}

export const PERIODS: readonly PeriodInfo[] = [
  { p: 1, start: '08:00', end: '08:55' },
  { p: 2, start: '09:00', end: '09:55' },
  { p: 3, start: '10:10', end: '11:05' },
  { p: 4, start: '11:10', end: '12:05' },
  { p: 5, start: '12:45', end: '13:40' },
  { p: 6, start: '13:45', end: '14:40' },
  { p: 7, start: '14:50', end: '15:45' },
  { p: 8, start: '15:50', end: '16:45' },
];
export const ALL_PERIODS: readonly Period[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** Breaks that follow a period, shown as thin separators in grids. */
export const BREAK_AFTER: Partial<Record<Period, string>> = { 2: 'Tea', 4: 'Lunch', 6: 'Break' };

export interface ShiftInfo {
  id: ShiftId;
  name: string;
  periods: Period[];
  start: string;
  end: string;
}

export const SHIFTS: Record<ShiftId, ShiftInfo> = {
  1: { id: 1, name: 'Shift 1 · Morning', periods: [1, 2, 3, 4], start: '08:00', end: '12:05' },
  2: { id: 2, name: 'Shift 2 · Midday', periods: [3, 4, 5, 6], start: '10:10', end: '14:40' },
  3: { id: 3, name: 'Shift 3 · Afternoon', periods: [5, 6, 7, 8], start: '12:45', end: '16:45' },
};

export const PROGRAMS: readonly Program[] = ['BBA', 'WOW'];
export const SEMESTERS: readonly Semester[] = [1, 3, 5];

/** Sessions that never count as teaching hours in the calculator. */
export const EXCLUDED_LABELS: readonly FixedLabel[] = [
  'CT/Orientation',
  'C2C',
  'LIB',
  'Training',
  'Master Talk',
  'Workshop',
  'AI Toolkit',
  'Rock Your Profile',
];

export const FIXED_LABEL_NAMES: Record<FixedLabel, string> = {
  'Unit Test': 'Unit Test',
  'Master Talk': 'Master Talk',
  'CT/Orientation': 'Class Teacher / Orientation',
  C2C: 'Campus to Corporate',
  LIB: 'Library Hour',
  Training: 'Skills Training',
  Workshop: 'Workshop',
  'AI Toolkit': 'AI Toolkit',
  'Rock Your Profile': 'Rock Your Profile',
};

export const APPROVERS = [
  { name: 'Chaitra', role: 'Timetable Committee', email: 'chaitra@cms.example' },
  { name: 'Krishna Koppa', role: 'Timetable Committee', email: 'krishna.koppa@cms.example' },
  { name: 'Jai Shree', role: 'Timetable Committee', email: 'jai.shree@cms.example' },
] as const;

export const COMMITTEE_USER = 'TTC Admin';

export function periodInfo(p: Period): PeriodInfo {
  return PERIODS[p - 1];
}

export function periodLabel(p: Period): string {
  const info = periodInfo(p);
  return `P${p} · ${info.start}–${info.end}`;
}
