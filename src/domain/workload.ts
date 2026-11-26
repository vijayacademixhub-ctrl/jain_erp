import { hashString } from '../data/rng';
import type { TermInfo } from '../data/seed';
import { dayIndexOf, diffDays } from '../lib/dates';
import { leaveDays } from './leave';
import type { DailyChange, Faculty, LeaveRequest, Slot } from './types';

export type WorkloadStatus = 'Completed' | 'On track' | 'Shortfall';

export interface WorkloadRow {
  faculty: Faculty;
  assignedWeekly: number;
  weeklyTarget: number;
  contractWeeks: number;
  termTarget: number;
  expected: number;
  delivered: number;
  leaveHours: number;
  subGained: number;
  subLost: number;
  pct: number;
  status: WorkloadStatus;
}

/**
 * Term-to-date workload per faculty: assigned weekly hours from the published master,
 * delivered hours adjusted for approved leave and published substitutions.
 */
export function computeWorkload(
  faculty: readonly Faculty[],
  slots: readonly Slot[],
  leaves: readonly LeaveRequest[],
  changes: readonly DailyChange[],
  term: TermInfo,
  today: string,
): WorkloadRow[] {
  const weekly = new Map<string, number>();
  const byFacDay = new Map<string, number>();
  const slotById = new Map(slots.map((s) => [s.id, s]));
  for (const s of slots) {
    if (!s.facultyId) continue;
    weekly.set(s.facultyId, (weekly.get(s.facultyId) ?? 0) + 1);
    byFacDay.set(`${s.facultyId}|${s.day}`, (byFacDay.get(`${s.facultyId}|${s.day}`) ?? 0) + 1);
  }

  const weeksElapsed = Math.max(0, Math.min(term.weeks, (diffDays(today, term.start) + 1) / 7));

  const leaveHours = new Map<string, number>();
  for (const l of leaves) {
    if (l.status !== 'Approved') continue;
    for (const d of leaveDays(l)) {
      if (d > today) continue;
      const di = dayIndexOf(d);
      if (di === null) continue;
      const n = l.periods.length ? l.periods.length : (byFacDay.get(`${l.facultyId}|${di}`) ?? 0);
      leaveHours.set(l.facultyId, (leaveHours.get(l.facultyId) ?? 0) + n);
    }
  }

  const gained = new Map<string, number>();
  const lost = new Map<string, number>();
  for (const c of changes) {
    if (c.status !== 'published' || c.type !== 'substitution' || !c.facultyId || c.date > today) continue;
    gained.set(c.facultyId, (gained.get(c.facultyId) ?? 0) + 1);
    const orig = c.slotId ? slotById.get(c.slotId)?.facultyId : undefined;
    if (orig) lost.set(orig, (lost.get(orig) ?? 0) + 1);
  }

  return faculty.map((f) => {
    const h = hashString(f.id);
    const assignedWeekly = weekly.get(f.id) ?? 0;
    const contractWeeks = f.type === 'External' ? 8 + (h % 4) : term.weeks;
    const termTarget = f.weeklyTarget * contractWeeks;
    const elapsed = Math.min(weeksElapsed, contractWeeks);
    const expected = f.weeklyTarget * elapsed;
    const noise = (h % 7) - 4; // compensation classes, missed periods, events
    const lv = leaveHours.get(f.id) ?? 0;
    const g = gained.get(f.id) ?? 0;
    const lo = lost.get(f.id) ?? 0;
    const delivered = Math.max(0, Math.round(assignedWeekly * elapsed + noise - lv + g - lo));
    const pct = termTarget ? Math.round((delivered / termTarget) * 100) : 0;
    let status: WorkloadStatus;
    if (termTarget > 0 && delivered >= termTarget) status = 'Completed';
    else if (delivered >= expected * 0.92) status = 'On track';
    else status = 'Shortfall';
    return {
      faculty: f,
      assignedWeekly,
      weeklyTarget: f.weeklyTarget,
      contractWeeks,
      termTarget,
      expected: Math.round(expected),
      delivered,
      leaveHours: lv,
      subGained: g,
      subLost: lo,
      pct,
      status,
    };
  });
}
