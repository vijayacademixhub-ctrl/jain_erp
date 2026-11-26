import type { ClashEngine, EngineRefs } from './clash';
import { DAY_INDEXES, SHIFTS } from './constants';
import type { DayIndex, Period, Slot } from './types';

export interface FixSuggestions {
  faculty: { id: string; name: string; load: number; sameArea: boolean }[];
  rooms: { id: string; name: string; capacity: number }[];
  periods: { day: DayIndex; period: Period }[];
}

/**
 * Suggestions for resolving a clash on one slot: free faculty (same area first, lowest load),
 * free rooms that fit the class, and alternative periods where faculty, room and sections are all free.
 */
export function suggestFixes(engine: ClashEngine, slot: Slot, refs: EngineRefs, onLeave: (facultyId: string, day: DayIndex, period: Period) => boolean): FixSuggestions {
  const subject = slot.subjectId ? refs.subjects[slot.subjectId] : undefined;
  const strength = engine.strengthOf(slot);

  const faculty = Object.values(refs.faculty)
    .filter((f) => f.id !== slot.facultyId)
    .filter((f) => (subject ? f.area === subject.area : f.area === 'Careers' || f.type === 'Internal'))
    .filter((f) => slot.period >= f.window[0] && slot.period <= f.window[1])
    .filter((f) => engine.isFacultyFree(f.id, slot.day, slot.period))
    .filter((f) => !onLeave(f.id, slot.day, slot.period))
    .map((f) => ({ id: f.id, name: f.name, load: engine.facultyLoad(f.id), sameArea: !!subject && f.area === subject.area }))
    .sort((a, b) => a.load - b.load || a.name.localeCompare(b.name))
    .slice(0, 4);

  const home = slot.sectionIds.length === 1 ? refs.sections[slot.sectionIds[0]]?.homeRoomId : undefined;
  const rooms = Object.values(refs.rooms)
    .filter((r) => r.id !== slot.roomId && r.capacity >= strength && r.type !== 'Meeting Room' && r.type !== 'Boardroom')
    .filter((r) => engine.isRoomFree(r.id, slot.day, slot.period))
    .sort((a, b) => (a.id === home ? -1 : b.id === home ? 1 : 0) || a.capacity - b.capacity)
    .slice(0, 4)
    .map((r) => ({ id: r.id, name: r.name, capacity: r.capacity }));

  const shiftPeriods = slot.sectionIds.length ? SHIFTS[refs.sections[slot.sectionIds[0]]?.shift ?? 1].periods : ([1, 2, 3, 4, 5, 6, 7, 8] as Period[]);
  const periods: { day: DayIndex; period: Period }[] = [];
  const days = [slot.day, ...DAY_INDEXES.filter((d) => d !== slot.day)];
  for (const d of days) {
    for (const p of shiftPeriods) {
      if (d === slot.day && p === slot.period) continue;
      if (!slot.sectionIds.every((s) => engine.isSectionFree(s, d, p, slot.id))) continue;
      if (slot.facultyId) {
        if (!engine.isFacultyFree(slot.facultyId, d, p, slot.id)) continue;
        const f = refs.faculty[slot.facultyId];
        if (f && (p < f.window[0] || p > f.window[1])) continue;
        if (onLeave(slot.facultyId, d, p)) continue;
      }
      if (slot.roomId && !engine.isRoomFree(slot.roomId, d, p, slot.id)) continue;
      periods.push({ day: d, period: p });
      if (periods.length >= 6) break;
    }
    if (periods.length >= 6) break;
  }

  return { faculty, rooms, periods };
}
