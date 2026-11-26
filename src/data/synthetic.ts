import type { EngineRefs } from '../domain/clash';
import type { DayIndex, Faculty, Period, Room, Section, Slot, Subject } from '../domain/types';
import { createRng } from './rng';

/**
 * Builds a large synthetic master timetable for load testing.
 * Used by the hidden /perf page and the engine performance test.
 */
export function buildSyntheticSlots(target: number, seed: number): { slots: Slot[]; refs: EngineRefs; sections: Section[] } {
  const rng = createRng(seed);
  const perSection = 43;
  const sectionCount = Math.ceil(target / perSection);
  const facultyCount = Math.max(60, Math.round(sectionCount * 4.2));

  const sections: Section[] = [];
  const rooms: Room[] = [];
  for (let i = 0; i < sectionCount; i++) {
    const program = i % 3 === 2 ? 'WOW' : 'BBA';
    const semester = ([1, 3, 5] as const)[i % 3];
    rooms.push({ id: `sr${i}`, name: `Room S${i}`, type: 'Classroom', capacity: 70, floor: 'Sim', bookable: false });
    sections.push({ id: `ss${i}`, program, semester, name: `S${i}`, strength: 55 + Math.floor(rng() * 12), shift: 1, homeRoomId: `sr${i}` });
  }
  const faculty: Faculty[] = Array.from({ length: facultyCount }, (_, i) => ({
    id: `sf${i}`,
    name: `Sim Faculty ${i + 1}`,
    short: `F${i + 1}`,
    designation: 'Assistant Professor',
    area: 'Finance',
    type: 'Internal',
    email: `sim${i}@cms.example`,
    window: [1, 8],
    weeklyTarget: 10,
  }));
  const subjects: Subject[] = Array.from({ length: 40 }, (_, i) => ({
    id: `sx${i}`,
    code: `SIM${i}`,
    name: `Simulated Subject ${i + 1}`,
    program: 'BBA',
    semester: 1,
    kind: 'Core',
    credits: 4,
    weeklyHours: 4,
    area: 'Finance',
  }));

  const slots: Slot[] = [];
  let n = 0;
  outer: for (let si = 0; si < sectionCount; si++) {
    for (let d = 0; d < 6; d++) {
      for (let p = 1; p <= 8; p++) {
        if (rng() > 0.9) continue;
        const fi = (si * 7 + d * 13 + p * 3 + Math.floor(rng() * 3)) % facultyCount;
        slots.push({
          id: `sim${n++}`,
          day: d as DayIndex,
          period: p as Period,
          sectionIds: [`ss${si}`],
          kind: 'Regular',
          subjectId: `sx${(si + p) % 40}`,
          facultyId: `sf${fi}`,
          roomId: `sr${si}`,
        });
        if (slots.length >= target) break outer;
      }
    }
  }

  const refs: EngineRefs = {
    sections: Object.fromEntries(sections.map((s) => [s.id, s])),
    rooms: Object.fromEntries(rooms.map((r) => [r.id, r])),
    faculty: Object.fromEntries(faculty.map((f) => [f.id, f])),
    subjects: Object.fromEntries(subjects.map((s) => [s.id, s])),
  };
  return { slots, refs, sections };
}

export interface SimUser {
  id: string;
  role: 'student' | 'faculty' | 'committee';
  sectionId?: string;
  facultyId?: string;
}

/** 2,000 simulated users: students spread over sections, faculty and committee members. */
export function buildSimUsers(sections: Section[], facultyIds: string[], total = 2000): SimUser[] {
  const users: SimUser[] = [];
  const committee = 20;
  const facultyN = Math.min(facultyIds.length, 120);
  const students = total - committee - facultyN;
  for (let i = 0; i < students; i++) users.push({ id: `u${i}`, role: 'student', sectionId: sections[i % sections.length].id });
  for (let i = 0; i < facultyN; i++) users.push({ id: `uf${i}`, role: 'faculty', facultyId: facultyIds[i] });
  for (let i = 0; i < committee; i++) users.push({ id: `uc${i}`, role: 'committee' });
  return users;
}
