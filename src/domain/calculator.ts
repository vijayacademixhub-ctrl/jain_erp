import { addDaysISO, dayIndexOf } from '../lib/dates';
import type { EngineRefs } from './clash';
import { EXCLUDED_LABELS } from './constants';
import type { DailyChange, DayIndex, Period, Program, Semester, Slot, SlotKind } from './types';

/*
 * Teaching-hours calculator.
 *
 * Rules (kept exactly):
 *  1. One hour per period.
 *  2. A cohort is Section + Subject + Teacher.
 *  3. Substitution credit goes to the teacher who actually took the class.
 *  4. "IR" (Industrial Relations) is a normal subject and is never dropped:
 *     exclusions match whole session labels only, never subject codes or substrings.
 *  5. Unit tests are reported separately; excluded sessions are listed, not counted.
 */

export interface CalcInput {
  program: Program;
  semesters: Semester[];
  includeSem1: boolean;
  slots: readonly Slot[];
  changes: readonly DailyChange[];
  weekStart: string;
  applyChanges: boolean;
  refs: EngineRefs;
}

export interface CohortRow {
  key: string;
  section: string;
  subjectCode: string;
  subjectName: string;
  teacherId: string;
  teacher: string;
  external: boolean;
  hours: number;
  kind: SlotKind;
  substituted: number;
}

export interface CalcResult {
  semesters: Semester[];
  cohorts: CohortRow[];
  teachers: { id: string; name: string; external: boolean; hours: number; cohorts: number }[];
  subjects: { code: string; name: string; hours: number; cohorts: number }[];
  sections: { id: string; label: string; hours: number }[];
  unitTests: { section: string; label: string; hours: number }[];
  excluded: { label: string; sessions: number; sections: string[] }[];
  totals: { teachingHours: number; cohorts: number; teachers: number; externalHours: number; excludedSessions: number; unitTestHours: number };
}

interface Occurrence {
  id: string;
  day: DayIndex;
  period: Period;
  sectionIds: string[];
  kind: SlotKind;
  subjectId?: string;
  teacherId?: string;
  label?: string;
  substituted?: boolean;
}

const EXCLUDED = new Set<string>(EXCLUDED_LABELS);

export function isExcludedLabel(label: string | undefined): boolean {
  return !!label && EXCLUDED.has(label);
}

export function effectiveSemesters(semesters: readonly Semester[], includeSem1: boolean): Semester[] {
  const set = new Set<Semester>(semesters.filter((s) => s !== 1));
  if (includeSem1) set.add(1);
  return [...set].sort((a, b) => a - b);
}

export function computeCalculator(input: CalcInput): CalcResult {
  const { refs, program } = input;
  const sems = effectiveSemesters(input.semesters, input.includeSem1);
  const inScope = (sectionIds: readonly string[]) =>
    sectionIds.some((id) => {
      const s = refs.sections[id];
      return s && s.program === program && sems.includes(s.semester);
    });

  // 1. Weekly occurrences from the master.
  const occ = new Map<string, Occurrence>();
  for (const s of input.slots) {
    if (!inScope(s.sectionIds)) continue;
    occ.set(s.id, {
      id: s.id,
      day: s.day,
      period: s.period,
      sectionIds: s.sectionIds.filter((id) => refs.sections[id]?.program === program && sems.includes(refs.sections[id].semester)),
      kind: s.kind,
      subjectId: s.subjectId,
      teacherId: s.facultyId,
      label: s.label,
    });
  }

  // 2. Published daily changes for the chosen week.
  if (input.applyChanges) {
    const weekEnd = addDaysISO(input.weekStart, 5);
    for (const c of input.changes) {
      if (c.status !== 'published' || c.date < input.weekStart || c.date > weekEnd) continue;
      if (c.type === 'substitution' && c.slotId) {
        const o = occ.get(c.slotId);
        if (o && c.facultyId) {
          o.teacherId = c.facultyId;
          o.substituted = true;
        }
      } else if (c.type === 'cancellation' && c.slotId) {
        occ.delete(c.slotId);
      } else if ((c.type === 'extra-class' || c.type === 'workshop') && c.sectionIds && c.period && inScope(c.sectionIds)) {
        const day = dayIndexOf(c.date);
        if (day === null) continue;
        occ.set(`x-${c.id}`, {
          id: `x-${c.id}`,
          day,
          period: c.period,
          sectionIds: c.sectionIds,
          kind: c.type === 'workshop' ? 'Fixed' : 'Regular',
          subjectId: c.subjectId,
          teacherId: c.facultyId,
          label: c.type === 'workshop' ? 'Workshop' : undefined,
        });
      }
      // Swaps and room changes move a class; the hour count is unchanged.
    }
  }

  const sectionName = (id: string) => {
    const s = refs.sections[id];
    return s ? `${s.program} ${s.semester}${s.name}` : id;
  };

  const cohorts = new Map<string, CohortRow>();
  const teacherHours = new Map<string, { hours: number; cohorts: Set<string> }>();
  const subjectHours = new Map<string, { code: string; name: string; hours: number; cohorts: Set<string> }>();
  const sectionCells = new Map<string, Set<string>>();
  const unitTests = new Map<string, { section: string; label: string; hours: number }>();
  const excluded = new Map<string, { label: string; sessions: number; sections: Set<string> }>();

  for (const o of occ.values()) {
    if (o.kind === 'Test' || o.label === 'Unit Test') {
      for (const id of o.sectionIds) {
        const k = `${id}|Unit Test`;
        const row = unitTests.get(k) ?? { section: sectionName(id), label: 'Unit Test', hours: 0 };
        row.hours += 1;
        unitTests.set(k, row);
      }
      continue;
    }
    if (isExcludedLabel(o.label)) {
      const row = excluded.get(o.label!) ?? { label: o.label!, sessions: 0, sections: new Set<string>() };
      row.sessions += 1;
      for (const id of o.sectionIds) row.sections.add(sectionName(id));
      excluded.set(o.label!, row);
      continue;
    }
    const sub = o.subjectId ? refs.subjects[o.subjectId] : undefined;
    if (!sub || !o.teacherId) continue;
    const teacher = refs.faculty[o.teacherId];

    // Cohort = Section + Subject + Teacher (electives: the semester pool is the section).
    const cohortSections =
      o.kind === 'OE' || o.kind === 'ME'
        ? [`${program} ${refs.sections[o.sectionIds[0]]?.semester ?? ''} ${o.kind} pool`]
        : o.sectionIds.map(sectionName);
    for (const sec of cohortSections) {
      const key = `${sec}|${sub.code}|${o.teacherId}`;
      const row =
        cohorts.get(key) ??
        ({
          key,
          section: sec,
          subjectCode: sub.code,
          subjectName: sub.name,
          teacherId: o.teacherId,
          teacher: teacher?.name ?? o.teacherId,
          external: teacher?.type === 'External',
          hours: 0,
          kind: o.kind,
          substituted: 0,
        } satisfies CohortRow);
      row.hours += 1;
      if (o.substituted) row.substituted += 1;
      cohorts.set(key, row);
    }

    // One hour per period for the teacher, however many sections are combined.
    const t = teacherHours.get(o.teacherId) ?? { hours: 0, cohorts: new Set<string>() };
    t.hours += 1;
    for (const sec of cohortSections) t.cohorts.add(`${sec}|${sub.code}`);
    teacherHours.set(o.teacherId, t);

    const sh = subjectHours.get(sub.code) ?? { code: sub.code, name: sub.name, hours: 0, cohorts: new Set<string>() };
    sh.hours += 1;
    for (const sec of cohortSections) sh.cohorts.add(`${sec}|${o.teacherId}`);
    subjectHours.set(sub.code, sh);

    // A section sits one class per period, even when electives run in parallel.
    for (const id of o.sectionIds) {
      const set = sectionCells.get(id) ?? new Set<string>();
      set.add(`${o.day}|${o.period}`);
      sectionCells.set(id, set);
    }
  }

  const cohortRows = [...cohorts.values()].sort(
    (a, b) => a.section.localeCompare(b.section) || a.subjectCode.localeCompare(b.subjectCode) || a.teacher.localeCompare(b.teacher),
  );
  const teachers = [...teacherHours.entries()]
    .map(([id, v]) => ({ id, name: refs.faculty[id]?.name ?? id, external: refs.faculty[id]?.type === 'External', hours: v.hours, cohorts: v.cohorts.size }))
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  const subjects = [...subjectHours.values()]
    .map((v) => ({ code: v.code, name: v.name, hours: v.hours, cohorts: v.cohorts.size }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const sections = Object.values(refs.sections)
    .filter((s) => s.program === program && sems.includes(s.semester))
    .map((s) => ({ id: s.id, label: sectionName(s.id), hours: sectionCells.get(s.id)?.size ?? 0 }));
  const unit = [...unitTests.values()].sort((a, b) => a.section.localeCompare(b.section));
  const excl = EXCLUDED_LABELS.map((label) => excluded.get(label))
    .filter((x): x is { label: string; sessions: number; sections: Set<string> } => !!x)
    .map((x) => ({ label: x.label, sessions: x.sessions, sections: [...x.sections].sort() }));

  const teachingHours = teachers.reduce((n, t) => n + t.hours, 0);
  return {
    semesters: sems,
    cohorts: cohortRows,
    teachers,
    subjects,
    sections,
    unitTests: unit,
    excluded: excl,
    totals: {
      teachingHours,
      cohorts: cohortRows.length,
      teachers: teachers.length,
      externalHours: teachers.filter((t) => t.external).reduce((n, t) => n + t.hours, 0),
      excludedSessions: excl.reduce((n, x) => n + x.sessions, 0),
      unitTestHours: unit.reduce((n, x) => n + x.hours, 0),
    },
  };
}
