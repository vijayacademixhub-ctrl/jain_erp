import { describe, expect, it } from 'vitest';
import { generateSeed } from '../data/seed';
import { computeCalculator, effectiveSemesters, isExcludedLabel, type CalcInput } from './calculator';
import type { EngineRefs } from './clash';
import type { DailyChange, Faculty, Section, Slot, Subject } from './types';

const sec = (id: string, name: string, semester: 1 | 3 | 5 = 3): Section => ({
  id,
  program: 'BBA',
  semester,
  name,
  strength: 60,
  shift: 2,
  homeRoomId: 'r1',
});
const fac = (id: string, type: 'Internal' | 'External' = 'Internal'): Faculty => ({
  id,
  name: `Teacher ${id}`,
  short: id,
  designation: 'x',
  area: 'HR & OB',
  type,
  email: '',
  window: [1, 8],
  weeklyTarget: 8,
});
const sub = (id: string, code: string): Subject => ({
  id,
  code,
  name: code === 'IR' ? 'Industrial Relations' : `Subject ${code}`,
  program: 'BBA',
  semester: 3,
  kind: 'Core',
  credits: 3,
  weeklyHours: 3,
  area: 'HR & OB',
});

const refs: EngineRefs = {
  sections: { a: sec('a', 'A'), b: sec('b', 'B'), c1: sec('c1', 'A', 1) },
  faculty: { t1: fac('t1'), t2: fac('t2'), t3: fac('t3', 'External') },
  subjects: { ir: sub('ir', 'IR'), hr: sub('hr', 'HRM'), x: sub('x', 'X101') },
  rooms: {},
};

const base = (slots: Slot[], extra: Partial<CalcInput> = {}): CalcInput => ({
  program: 'BBA',
  semesters: [3],
  includeSem1: false,
  slots,
  changes: [],
  weekStart: '2026-10-05',
  applyChanges: true,
  refs,
  ...extra,
});

let n = 0;
const slot = (p: Partial<Slot>): Slot => ({ id: `s${n++}`, day: 0, period: 3, sectionIds: ['a'], kind: 'Regular', ...p });

describe('calculator rules', () => {
  it('counts one hour per period', () => {
    const r = computeCalculator(base([slot({ subjectId: 'hr', facultyId: 't1', period: 3 }), slot({ subjectId: 'hr', facultyId: 't1', period: 4 }), slot({ subjectId: 'hr', facultyId: 't1', day: 2 })]));
    expect(r.teachers.find((t) => t.id === 't1')?.hours).toBe(3);
    expect(r.totals.teachingHours).toBe(3);
  });

  it('defines a cohort as Section + Subject + Teacher', () => {
    const r = computeCalculator(
      base([
        slot({ subjectId: 'hr', facultyId: 't1', sectionIds: ['a'] }),
        slot({ subjectId: 'hr', facultyId: 't1', sectionIds: ['b'], day: 1 }),
        slot({ subjectId: 'hr', facultyId: 't2', sectionIds: ['a'], day: 2 }),
        slot({ subjectId: 'hr', facultyId: 't1', sectionIds: ['a'], day: 3 }),
      ]),
    );
    expect(r.cohorts.map((c) => `${c.section}/${c.subjectCode}/${c.teacherId}/${c.hours}`)).toEqual([
      'BBA 3A/HRM/t1/2',
      'BBA 3A/HRM/t2/1',
      'BBA 3B/HRM/t1/1',
    ]);
  });

  it('gives a combined class one hour for the teacher but a cohort per section', () => {
    const r = computeCalculator(base([slot({ subjectId: 'hr', facultyId: 't1', sectionIds: ['a', 'b'], kind: 'Combined' })]));
    expect(r.teachers[0].hours).toBe(1);
    expect(r.cohorts).toHaveLength(2);
  });

  it('credits a substitution to the teacher who actually took the class', () => {
    const s = slot({ subjectId: 'hr', facultyId: 't1' });
    const change: DailyChange = {
      id: 'c1',
      date: '2026-10-05',
      type: 'substitution',
      status: 'published',
      scope: 'date',
      slotId: s.id,
      facultyId: 't2',
      createdAt: '',
      createdBy: '',
    };
    const r = computeCalculator(base([s], { changes: [change] }));
    expect(r.teachers.map((t) => t.id)).toEqual(['t2']);
    expect(r.cohorts[0].teacherId).toBe('t2');
    expect(r.cohorts[0].substituted).toBe(1);

    const draft = computeCalculator(base([s], { changes: [{ ...change, status: 'draft' }] }));
    expect(draft.teachers.map((t) => t.id)).toEqual(['t1']);
  });

  it('never drops IR', () => {
    const r = computeCalculator(base([slot({ subjectId: 'ir', facultyId: 't1' }), slot({ subjectId: 'ir', facultyId: 't1', day: 4 })]));
    expect(r.subjects.find((s) => s.code === 'IR')?.hours).toBe(2);
    expect(isExcludedLabel('IR')).toBe(false);
  });

  it('lists excluded sessions and unit tests separately without counting them', () => {
    const r = computeCalculator(
      base([
        slot({ subjectId: 'hr', facultyId: 't1' }),
        slot({ kind: 'Fixed', label: 'Master Talk', day: 4, period: 6 }),
        slot({ kind: 'Fixed', label: 'AI Toolkit', facultyId: 't3', day: 1 }),
        slot({ kind: 'Fixed', label: 'Rock Your Profile', facultyId: 't3', day: 2 }),
        slot({ kind: 'Test', label: 'Unit Test', day: 5, period: 1 }),
      ]),
    );
    expect(r.totals.teachingHours).toBe(1);
    expect(r.excluded.map((x) => x.label)).toEqual(['Master Talk', 'AI Toolkit', 'Rock Your Profile']);
    expect(r.unitTests).toEqual([{ section: 'BBA 3A', label: 'Unit Test', hours: 1 }]);
    expect(r.teachers.find((t) => t.id === 't3')).toBeUndefined();
  });

  it('flags external faculty', () => {
    const r = computeCalculator(base([slot({ subjectId: 'x', facultyId: 't3' })]));
    expect(r.teachers[0].external).toBe(true);
    expect(r.cohorts[0].external).toBe(true);
  });

  it('honours the Semester 1 switch', () => {
    expect(effectiveSemesters([3, 5], false)).toEqual([3, 5]);
    expect(effectiveSemesters([3], true)).toEqual([1, 3]);
    expect(effectiveSemesters([1, 3], false)).toEqual([3]);
    const slots = [slot({ subjectId: 'hr', facultyId: 't1', sectionIds: ['c1'] }), slot({ subjectId: 'hr', facultyId: 't2', sectionIds: ['a'] })];
    expect(computeCalculator(base(slots)).teachers.map((t) => t.id)).toEqual(['t2']);
    expect(computeCalculator(base(slots, { includeSem1: true })).teachers).toHaveLength(2);
  });

  it('removes cancelled classes and adds extra classes', () => {
    const s = slot({ subjectId: 'hr', facultyId: 't1' });
    const mk = (c: Partial<DailyChange>): DailyChange => ({ id: `c${n++}`, date: '2026-10-06', status: 'published', scope: 'date', createdAt: '', createdBy: '', type: 'cancellation', ...c });
    const r = computeCalculator(
      base([s], {
        changes: [mk({ type: 'cancellation', slotId: s.id }), mk({ type: 'extra-class', sectionIds: ['b'], period: 5, subjectId: 'x', facultyId: 't2' })],
      }),
    );
    expect(r.teachers.map((t) => `${t.id}:${t.hours}`)).toEqual(['t2:1']);
  });
});

describe('calculator on the seeded timetable', () => {
  const seed = generateSeed('2026-10-06');
  const seedRefs: EngineRefs = {
    sections: Object.fromEntries(seed.sections.map((s) => [s.id, s])),
    rooms: Object.fromEntries(seed.rooms.map((r) => [r.id, r])),
    faculty: Object.fromEntries(seed.faculty.map((f) => [f.id, f])),
    subjects: Object.fromEntries(seed.subjects.map((s) => [s.id, s])),
  };

  it('keeps IR for all four BBA Sem 5 sections', () => {
    const r = computeCalculator({ ...base(seed.publishedSlots), refs: seedRefs, semesters: [5] });
    const ir = r.subjects.find((s) => s.code === 'IR');
    expect(ir?.hours).toBe(12);
    expect(r.cohorts.filter((c) => c.subjectCode === 'IR')).toHaveLength(4);
  });

  it('reports sensible section hours (one class per period, electives counted once)', () => {
    const r = computeCalculator({ ...base(seed.publishedSlots), refs: seedRefs, semesters: [3, 5], includeSem1: true });
    for (const s of r.sections) expect(s.hours).toBeLessThanOrEqual(24);
    expect(r.excluded.some((x) => x.label === 'Master Talk')).toBe(true);
  });
});
