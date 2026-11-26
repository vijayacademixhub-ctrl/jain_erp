import type { ClashEngine } from './clash';
import { onLeave } from './leave';
import type { Faculty, LeaveRequest, Period, Slot, Subject } from './types';

export interface SubCandidate {
  faculty: Faculty;
  score: number;
  sameArea: boolean;
  load: number;
  reasons: string[];
}

export interface RankInput {
  /** Engine loaded with the resolved timetable for that date. */
  dayEngine: ClashEngine;
  slot: Slot;
  date: string;
  faculty: readonly Faculty[];
  subjects: Record<string, Subject>;
  leaves: readonly LeaveRequest[];
  /** Weekly assigned hours per faculty (workload). */
  loads: Map<string, number>;
  exclude?: readonly string[];
  limit?: number;
}

/**
 * Ranked substitutes: free in that period, not on leave, inside working hours,
 * same subject area first, then lowest workload.
 */
export function rankSubstitutes(input: RankInput): SubCandidate[] {
  const { dayEngine, slot, date, faculty, subjects, leaves, loads } = input;
  const subject = slot.subjectId ? subjects[slot.subjectId] : undefined;
  const exclude = new Set([slot.facultyId, ...(input.exclude ?? [])]);
  const out: SubCandidate[] = [];
  for (const f of faculty) {
    if (exclude.has(f.id)) continue;
    if (f.area === 'Careers' && subject) continue;
    if (!dayEngine.isFacultyFree(f.id, slot.day, slot.period)) continue;
    if (onLeave(leaves, f.id, date, slot.period)) continue;
    if (slot.period < f.window[0] || slot.period > f.window[1]) continue;
    const sameArea = !!subject && f.area === subject.area;
    const load = loads.get(f.id) ?? 0;
    const reasons = [`Free at P${slot.period}`];
    if (sameArea) reasons.push(`Same area (${f.area})`);
    reasons.push(`${load} h/week`);
    if (f.type === 'External') reasons.push('Visiting');
    out.push({ faculty: f, sameArea, load, reasons, score: (sameArea ? 0 : 100) + load + (f.type === 'External' ? 5 : 0) });
  }
  out.sort((a, b) => a.score - b.score || a.faculty.name.localeCompare(b.faculty.name));
  return out.slice(0, input.limit ?? 5);
}

export interface RoomCandidate {
  roomId: string;
  name: string;
  capacity: number;
  type: string;
}

export function periodsBetween(from: Period, to: Period): Period[] {
  const out: Period[] = [];
  for (let p = from; p <= to; p++) out.push(p as Period);
  return out;
}
