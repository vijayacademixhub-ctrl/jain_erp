import { addDaysISO, diffDays, fmtDate } from '../lib/dates';
import type { LeaveLookup } from './clash';
import type { DailyChange, LeaveRequest, LeaveType, Period } from './types';

/** Unplanned leave for the same day must reach the committee before this time (IST). */
export const UNPLANNED_CUTOFF_MIN = 9 * 60 + 30;
export const UNPLANNED_CUTOFF_LABEL = '09:30 IST';

export interface LeaveInput {
  type: LeaveType;
  from: string;
  to: string;
  periods: Period[];
  reason: string;
}

/**
 * Planned leave: apply at least a day ahead (1 to 2 days' notice).
 * Unplanned leave: can be applied until the morning of the day itself.
 */
export function validateLeave(input: LeaveInput, today: string, nowMinutes: number): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.from) errors.from = 'Choose a start date.';
  if (!input.to) errors.to = 'Choose an end date.';
  if (input.from && input.to && input.to < input.from) errors.to = 'End date cannot be before the start date.';
  if (input.from && input.to && diffDays(input.to, input.from) > 6) errors.to = 'A single request can cover at most 7 days.';
  if (input.reason.trim().length < 8) errors.reason = 'Add a short reason (at least 8 characters).';

  if (input.from) {
    const ahead = diffDays(input.from, today);
    if (ahead < 0) errors.from = 'Leave cannot start in the past.';
    else if (input.type === 'Planned' && ahead < 1) {
      errors.from = 'Planned leave must be applied at least 1 day ahead (ideally 2). For today, choose Unplanned.';
    } else if (input.type === 'Unplanned') {
      if (ahead === 0 && nowMinutes >= UNPLANNED_CUTOFF_MIN) {
        errors.from = `Unplanned leave for today closes at ${UNPLANNED_CUTOFF_LABEL}. Call the Timetable Committee, or choose tomorrow.`;
      } else if (ahead > 1) {
        errors.from = 'More than a day ahead counts as Planned leave. Switch the type to Planned.';
      }
    }
  }
  return errors;
}

export function leaveCovers(l: LeaveRequest, date: string, period?: Period): boolean {
  if (date < l.from || date > l.to) return false;
  if (period === undefined || l.periods.length === 0) return true;
  return l.periods.includes(period);
}

export function leaveDays(l: LeaveRequest): string[] {
  const out: string[] = [];
  for (let d = l.from; d <= l.to; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

/**
 * Leave lookup for the master builder: only APPROVED leave in the selected week counts,
 * and a class that already has a substitution or cancellation for that date is covered.
 */
export function makeLeaveLookup(leaves: readonly LeaveRequest[], weekStart: string, changes: readonly DailyChange[]): LeaveLookup {
  const byFaculty = new Map<string, LeaveRequest[]>();
  for (const l of leaves) {
    if (l.status !== 'Approved') continue;
    const list = byFaculty.get(l.facultyId) ?? [];
    list.push(l);
    byFaculty.set(l.facultyId, list);
  }
  const covered = new Set<string>();
  for (const c of changes) {
    if ((c.type === 'substitution' || c.type === 'cancellation') && c.slotId) covered.add(`${c.slotId}|${c.date}`);
  }
  return (facultyId, day, period, slotId) => {
    const list = byFaculty.get(facultyId);
    if (!list) return null;
    const date = addDaysISO(weekStart, day);
    for (const l of list) {
      if (!leaveCovers(l, date, period)) continue;
      if (covered.has(`${slotId}|${date}`)) return null;
      return { leaveId: l.id, type: l.type, date: fmtDate(date, 'd MMM') };
    }
    return null;
  };
}

/** Leave lookup for a single calendar date (daily timetable, substitutes). */
export function onLeave(leaves: readonly LeaveRequest[], facultyId: string, date: string, period?: Period): LeaveRequest | undefined {
  return leaves.find((l) => l.status === 'Approved' && l.facultyId === facultyId && leaveCovers(l, date, period));
}
