import { APPROVERS, COMMITTEE_USER, SHIFTS } from '../domain/constants';
import type {
  DailyChange,
  DailyPublication,
  DayIndex,
  Faculty,
  FixedLabel,
  LeaveRequest,
  Memory,
  MockMail,
  Period,
  Room,
  RoomBooking,
  Section,
  Slot,
  Snapshot,
  Subject,
} from '../domain/types';
import { addDaysISO, dayIndexOf, istTimestamp, weekStartOf } from '../lib/dates';
import { buildFaculty, buildRooms, buildSections, buildSubjects } from './catalog';
import { createRng, shuffle, type Rng } from './rng';

export const SEED_VERSION = 3;
const SEED = 20260806;

export interface TermInfo {
  name: string;
  start: string;
  end: string;
  weeks: number;
}

export interface Scenario {
  id: string;
  title: string;
  detail: string;
  slotId?: string;
  sectionId?: string;
}

export interface SeedData {
  faculty: Faculty[];
  subjects: Subject[];
  rooms: Room[];
  sections: Section[];
  /** sectionId -> subjectId -> facultyId */
  assignments: Record<string, Record<string, string>>;
  publishedSlots: Slot[];
  draftSlots: Slot[];
  leaves: LeaveRequest[];
  changes: DailyChange[];
  publications: DailyPublication[];
  bookings: RoomBooking[];
  memories: Memory[];
  mails: MockMail[];
  snapshot: Snapshot;
  scenarios: Scenario[];
  term: TermInfo;
  unplaced: { sectionId: string; subjectId: string; hours: number }[];
}

interface FixedNeed {
  label: FixedLabel;
  count: number;
  who: 'careers' | 'class-teacher' | 'none';
  room?: 'home' | 'lab' | 'none';
}

const FIXED_BY_COHORT: Record<string, FixedNeed[]> = {
  BBA1: [
    { label: 'CT/Orientation', count: 1, who: 'class-teacher' },
    { label: 'LIB', count: 1, who: 'none', room: 'none' },
  ],
  BBA3: [
    { label: 'C2C', count: 1, who: 'careers' },
    { label: 'LIB', count: 1, who: 'none', room: 'none' },
  ],
  BBA5: [{ label: 'Training', count: 1, who: 'careers' }],
  WOW1: [
    { label: 'Training', count: 2, who: 'careers' },
    { label: 'C2C', count: 1, who: 'careers' },
    { label: 'CT/Orientation', count: 1, who: 'class-teacher' },
    { label: 'AI Toolkit', count: 1, who: 'careers', room: 'lab' },
  ],
  WOW3: [
    { label: 'Training', count: 2, who: 'careers' },
    { label: 'Rock Your Profile', count: 1, who: 'careers' },
    { label: 'Workshop', count: 1, who: 'careers' },
  ],
  WOW5: [
    { label: 'C2C', count: 1, who: 'careers' },
    { label: 'Training', count: 1, who: 'careers' },
    { label: 'LIB', count: 1, who: 'none', room: 'none' },
    { label: 'Workshop', count: 1, who: 'careers' },
  ],
};

export function termFor(today: string): TermInfo {
  const start = addDaysISO(weekStartOf(today), -7 * 9);
  const end = addDaysISO(start, 7 * 17 - 2);
  const month = Number(start.slice(5, 7));
  const year = Number(start.slice(0, 4));
  const name = month >= 6 ? `Odd Semester ${year}–${String(year + 1).slice(2)}` : `Even Semester ${year - 1}–${String(year).slice(2)}`;
  return { name, start, end, weeks: 17 };
}

export function generateSeed(today: string): SeedData {
  // Greedy placement can strand an hour or two; deterministic restarts find a complete timetable.
  let tt = buildTimetable(SEED);
  for (let i = 1; i < 60 && tt.unplacedMap.size > 0; i++) {
    const next = buildTimetable(SEED + i * 7919);
    if (next.unplacedMap.size < tt.unplacedMap.size) tt = next;
  }
  return finishSeed(today, tt);
}

function buildTimetable(seedNo: number) {
  const rng = createRng(seedNo);
  const faculty = buildFaculty();
  const subjects = buildSubjects();
  const rooms = buildRooms();
  const sections = buildSections();
  const facById = Object.fromEntries(faculty.map((f) => [f.id, f]));
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const secById = Object.fromEntries(sections.map((s) => [s.id, s]));
  const subByCode = Object.fromEntries(subjects.map((s) => [s.code, s]));

  const sched = new Scheduler(rng, facById, roomById);
  const cohort = (s: Section) => `${s.program}${s.semester}`;
  const sectionsOf = (program: string, sem: number) => sections.filter((s) => s.program === program && s.semester === sem);

  /* ---------- 1. teaching assignments ---------- */
  const assignments: Record<string, Record<string, string>> = {};
  const planned = new Map<string, number>();
  const plan = (id: string, h: number) => planned.set(id, (planned.get(id) ?? 0) + h);

  const choose = (area: Faculty['area'], shiftPeriods: Period[], hours: number, excludeExternal = false): Faculty => {
    const pool = faculty.filter((f) => {
      if (f.area !== area) return false;
      if (excludeExternal && f.type === 'External') return false;
      const overlap = shiftPeriods.filter((p) => p >= f.window[0] && p <= f.window[1]).length;
      if (overlap < 2) return false;
      if (f.type === 'External' && (planned.get(f.id) ?? 0) + hours > 6) return false;
      return true;
    });
    const candidates = pool.length ? pool : faculty.filter((f) => f.area === area && f.type === 'Internal');
    // Internal faculty carry the load; visiting faculty top up (see the pass below).
    const weight = (f: Faculty) => (planned.get(f.id) ?? 0) + (f.type === 'External' ? 4 : 0);
    const sorted = shuffle(candidates, rng).sort((a, b) => weight(a) - weight(b));
    return sorted[0];
  };

  for (const sec of sections) {
    assignments[sec.id] = {};
    const shift = SHIFTS[sec.shift].periods;
    for (const sub of subjects.filter((x) => x.program === sec.program && x.semester === sec.semester && x.kind === 'Core')) {
      let f: Faculty;
      if (sub.code === 'BBA104' && sec.name === 'B') f = facById[assignments['bba1a'][sub.id]];
      else f = choose(sub.area, shift, sub.weeklyHours);
      assignments[sec.id][sub.id] = f.id;
      plan(f.id, sub.weeklyHours);
    }
  }

  // Every visiting faculty member gets at least one contract, taken from the busiest internal colleague.
  for (const ext of faculty.filter((f) => f.type === 'External' && f.area !== 'Careers' && !planned.get(f.id))) {
    let best: { sec: Section; sub: Subject; from: string; load: number } | null = null;
    for (const sec of sections) {
      if (sec.id === 'bba1a' || sec.id === 'bba1b') continue; // keep the showcase sections with core faculty
      const overlap = SHIFTS[sec.shift].periods.filter((p) => p >= ext.window[0] && p <= ext.window[1]).length;
      if (overlap < 3) continue;
      for (const sub of subjects.filter((x) => x.program === sec.program && x.semester === sec.semester && x.kind === 'Core' && x.area === ext.area)) {
        const from = assignments[sec.id][sub.id];
        if (facById[from].type !== 'Internal') continue;
        const load = planned.get(from) ?? 0;
        if (!best || load > best.load) best = { sec, sub, from, load };
      }
    }
    if (!best) continue;
    assignments[best.sec.id][best.sub.id] = ext.id;
    plan(best.from, -best.sub.weeklyHours);
    plan(ext.id, best.sub.weeklyHours);
  }

  const electiveFaculty: Record<string, string> = {};
  for (const sub of subjects.filter((x) => x.kind !== 'Core')) {
    const secs = sectionsOf(sub.program, sub.semester);
    const f = choose(sub.area, SHIFTS[secs[0].shift].periods, sub.weeklyHours, true);
    electiveFaculty[sub.id] = f.id;
    plan(f.id, sub.weeklyHours);
  }

  const classTeacher: Record<string, string> = {};
  for (const sec of sections) {
    const pool = faculty.filter((f) => f.type === 'Internal' && f.area !== 'Careers');
    const f = pool.slice().sort((a, b) => (planned.get(a.id) ?? 0) - (planned.get(b.id) ?? 0))[0];
    classTeacher[sec.id] = f.id;
    plan(f.id, 1);
  }
  const careers = faculty.filter((f) => f.area === 'Careers');

  /* ---------- 2. fixed cross-section blocks ---------- */
  const master = [...sectionsOf('BBA', 5), ...sectionsOf('WOW', 3)];
  sched.place({ day: 4, period: 6, sectionIds: master.map((s) => s.id), kind: 'Fixed', label: 'Master Talk', roomId: 'raud' });
  for (const sec of [...sectionsOf('BBA', 1), ...sectionsOf('WOW', 5)]) {
    sched.place({ day: 5, period: 1, sectionIds: [sec.id], kind: 'Test', label: 'Unit Test', roomId: sec.homeRoomId });
  }
  const bc = subByCode['BBA104'];
  const combined = sched.place({
    day: 4,
    period: 3,
    sectionIds: ['bba1a', 'bba1b'],
    kind: 'Combined',
    subjectId: bc.id,
    facultyId: assignments['bba1a'][bc.id],
    roomId: 'rsem',
  });

  /* ---------- 3. parallel elective blocks ---------- */
  const electiveBlocks: { program: 'BBA'; sem: 3 | 5; kind: 'OE' | 'ME' }[] = [
    { program: 'BBA', sem: 3, kind: 'OE' },
    { program: 'BBA', sem: 5, kind: 'OE' },
    { program: 'BBA', sem: 5, kind: 'ME' },
  ];
  for (const blk of electiveBlocks) {
    const secs = sectionsOf(blk.program, blk.sem);
    const offerings = subjects.filter((x) => x.program === blk.program && x.semester === blk.sem && x.kind === blk.kind);
    const roomsFor = secs.map((s) => s.homeRoomId);
    const usedDays = new Set<number>();
    for (let b = 1; b <= 2; b++) {
      const cands = shuffle(sched.cellsFor(SHIFTS[secs[0].shift].periods), rng).filter(([d]) => !usedDays.has(d));
      for (const [d, p] of cands) {
        const ok =
          secs.every((s) => sched.secFree(s.id, d, p)) &&
          offerings.every((o, i) => sched.facFree(electiveFaculty[o.id], d, p) && sched.roomFree(roomsFor[i], d, p));
        if (!ok) continue;
        offerings.forEach((o, i) =>
          sched.place({
            day: d,
            period: p,
            sectionIds: secs.map((s) => s.id),
            kind: blk.kind,
            subjectId: o.id,
            facultyId: electiveFaculty[o.id],
            roomId: roomsFor[i],
            group: `${blk.kind}-${blk.program}${blk.sem}-${b}`,
          }),
        );
        usedDays.add(d);
        break;
      }
    }
  }

  /* ---------- 4. per-section fixed sessions ---------- */
  let careersTurn = 0;
  for (const sec of shuffle(sections, rng)) {
    for (const need of FIXED_BY_COHORT[cohort(sec)] ?? []) {
      for (let i = 0; i < need.count; i++) {
        let facultyId: string | undefined;
        if (need.who === 'class-teacher') facultyId = classTeacher[sec.id];
        if (need.who === 'careers') {
          const shift = SHIFTS[sec.shift].periods;
          const fits = careers.filter((f) => shift.some((p) => p >= f.window[0] && p <= f.window[1]));
          facultyId = fits[careersTurn++ % fits.length].id;
        }
        const roomPref = need.room === 'none' ? undefined : need.room === 'lab' ? 'rlab2' : sec.homeRoomId;
        sched.placeFlexible(sec, { kind: 'Fixed', label: need.label, facultyId, roomPref, avoidDay: -1 });
      }
    }
  }

  /* ---------- 5. core subjects, one hour at a time, interleaved ---------- */
  const tasks: { sec: Section; sub: Subject; h: number }[] = [];
  for (const sec of sections) {
    for (const sub of subjects.filter((x) => x.program === sec.program && x.semester === sec.semester && x.kind === 'Core')) {
      const already = sub.code === 'BBA104' && (sec.id === 'bba1a' || sec.id === 'bba1b') ? 1 : 0;
      for (let h = already; h < sub.weeklyHours; h++) tasks.push({ sec, sub, h });
    }
  }
  const ordered = shuffle(tasks, rng).sort((a, b) => a.h - b.h);
  const unplacedMap = new Map<string, number>();
  for (const t of ordered) {
    const ok = sched.placeCore(t.sec, t.sub, assignments[t.sec.id][t.sub.id]);
    if (!ok) unplacedMap.set(`${t.sec.id}|${t.sub.id}`, (unplacedMap.get(`${t.sec.id}|${t.sub.id}`) ?? 0) + 1);
  }

  const publishedSlots = sched.slots.map((s) => ({ ...s, sectionIds: [...s.sectionIds] }));

  /* ---------- 6. weekly targets ---------- */
  const assigned = new Map<string, number>();
  for (const s of publishedSlots) if (s.facultyId) assigned.set(s.facultyId, (assigned.get(s.facultyId) ?? 0) + 1);
  for (const f of faculty) {
    const a = assigned.get(f.id) ?? 0;
    const factor = f.type === 'External' ? 1 : 0.78 + rng() * 0.3;
    f.weeklyTarget = Math.max(f.type === 'External' ? 2 : 6, Math.round(a * factor));
  }

  return { faculty, subjects, rooms, sections, facById, secById, subByCode, sched, assignments, publishedSlots, combined, unplacedMap };
}

function finishSeed(today: string, tt: ReturnType<typeof buildTimetable>): SeedData {
  const { faculty, subjects, rooms, sections, facById, secById, subByCode, sched, assignments, publishedSlots, combined, unplacedMap } = tt;

  /* ---------- 7. demo scenarios on the draft ---------- */
  const draftSlots = publishedSlots.map((s) => ({ ...s, sectionIds: [...s.sectionIds] }));
  const scenarios: Scenario[] = [];
  const byId = new Map(draftSlots.map((s) => [s.id, s]));
  const subById = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const regular = (s: Slot) => s.kind === 'Regular' && !!s.facultyId;

  // (1) Faculty double-booked across Semester 1 and Semester 5.
  {
    const wowB = draftSlots.filter((s) => regular(s) && s.sectionIds[0] === 'wow5b' && s.roomId === 'r305');
    const prefer = [...wowB].sort((a, b) => a.period - b.period || a.day - b.day);
    let done = false;
    for (const w of prefer) {
      const f = facById[w.facultyId!];
      if (f.type !== 'Internal') continue;
      const target = draftSlots.find(
        (s) => regular(s) && s.sectionIds[0] === 'bba1a' && s.day === w.day && s.period === w.period && subById[s.subjectId!].area === f.area,
      );
      if (!target) continue;
      target.facultyId = f.id;
      scenarios.push({
        id: 'faculty-double',
        title: 'Faculty double-booked across Semester 1 and Semester 5',
        detail: `${f.name}: BBA Sem 1 · A and WOW Sem 5 · B, ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][w.day]} P${w.period}, Room 305`,
        slotId: target.id,
        sectionId: 'bba1a',
      });
      done = true;
      break;
    }
    if (!done) {
      const w = prefer[0];
      const target = draftSlots.find((s) => regular(s) && s.sectionIds[0] === 'bba1a' && s.day === w.day && s.period === w.period);
      if (target && w) {
        target.facultyId = w.facultyId;
        scenarios.push({ id: 'faculty-double', title: 'Faculty double-booked across Semester 1 and Semester 5', detail: facById[w.facultyId!].name, slotId: target.id, sectionId: 'bba1a' });
      }
    }
  }

  // (2) Room clash: BBA Sem 3 · C pointed at Room 305 while WOW Sem 5 · B sits there.
  {
    const wowB = draftSlots.filter((s) => s.sectionIds.includes('wow5b') && s.roomId === 'r305' && (s.period === 3 || s.period === 4));
    for (const w of wowB) {
      const target = draftSlots.find((s) => regular(s) && s.sectionIds[0] === 'bba3c' && s.day === w.day && s.period === w.period);
      if (!target) continue;
      target.roomId = 'r305';
      scenarios.push({
        id: 'room-double',
        title: 'Room clash',
        detail: `Room 305: BBA Sem 3 · C and WOW Sem 5 · B, ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][w.day]} P${w.period}`,
        slotId: target.id,
        sectionId: 'bba3c',
      });
      break;
    }
  }

  // (4) Capacity warning: BBA Sem 5 · D (68) in Computer Lab 1 (40 seats).
  {
    const ba = subByCode['BBA502'];
    const cands = draftSlots.filter((s) => s.sectionIds[0] === 'bba5d' && s.subjectId === ba.id);
    for (const c of cands) {
      const labBusy = draftSlots.some((s) => s.roomId === 'rlab1' && s.day === c.day && s.period === c.period);
      if (labBusy) continue;
      c.roomId = 'rlab1';
      scenarios.push({ id: 'capacity', title: 'Capacity warning', detail: 'BBA Sem 5 · D has 68 students; Computer Lab 1 seats 40', slotId: c.id, sectionId: 'bba5d' });
      break;
    }
  }

  // (6) Advisory: give one faculty member four periods in a row (at most two reassignments, same subject area).
  {
    const used = new Set(scenarios.map((s) => s.slotId));
    const teaches = (fid: string, d: number, p: number) => draftSlots.some((s) => s.facultyId === fid && s.day === d && s.period === p);
    let best: { f: Faculty; d: number; targets: Slot[] } | null = null;
    for (const f of faculty.filter((x) => x.type === 'Internal' && x.area !== 'Careers')) {
      for (let d = 0; d < 6 && !best; d++) {
        for (let w = 1; w <= 5; w++) {
          const targets: Slot[] = [];
          let ok = true;
          for (let q = w; q < w + 4 && ok; q++) {
            if (teaches(f.id, d, q)) continue;
            const t = draftSlots.find(
              (s) => regular(s) && s.day === d && s.period === q && !used.has(s.id) && s.facultyId !== f.id && subById[s.subjectId!]?.area === f.area,
            );
            if (t) targets.push(t);
            else ok = false;
          }
          if (ok && targets.length > 0 && targets.length <= 2) {
            best = { f, d, targets };
            break;
          }
        }
      }
      if (best) break;
    }
    if (best) {
      for (const t of best.targets) t.facultyId = best.f.id;
      scenarios.push({
        id: 'advisory',
        title: 'Long teaching run (advisory)',
        detail: `${best.f.name} teaches four periods in a row on ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][best.d]}`,
        slotId: best.targets[0].id,
        sectionId: best.targets[0].sectionIds[0],
      });
    }
  }

  // (5) Combined class that is correctly NOT flagged.
  scenarios.push({
    id: 'combined',
    title: 'Combined class (not flagged)',
    detail: 'BBA Sem 1 · A+B Business Communication, Fri P3, Seminar Hall (122 of 180 seats)',
    slotId: combined.id,
    sectionId: 'bba1a',
  });

  /* ---------- 8. leave, daily changes, bookings, mail ---------- */
  const week = weekStartOf(today);
  const todayIdx = dayIndexOf(today);
  const teachingDay = todayIdx === null ? addDaysISO(today, 1) : today;
  const teachingIdx = (dayIndexOf(teachingDay) ?? 0) as DayIndex;
  const thursday = addDaysISO(week, 3);

  const teachesOn = (fid: string, d: DayIndex) => draftSlots.filter((s) => s.facultyId === fid && s.day === d && s.kind === 'Regular');
  const pickTeacher = (preferred: string, d: DayIndex, area: Faculty['area'], avoid: string[]) => {
    if (teachesOn(preferred, d).length > 0 && !avoid.includes(preferred)) return preferred;
    const alt = faculty
      .filter((f) => f.area === area && f.type === 'Internal' && !avoid.includes(f.id))
      .sort((a, b) => teachesOn(b.id, d).length - teachesOn(a.id, d).length)[0];
    return alt.id;
  };
  const avoidIds = scenarios.map((s) => (s.slotId ? byId.get(s.slotId)?.facultyId : undefined)).filter(Boolean) as string[];
  const leaveFac = pickTeacher('f02', 3, 'Finance', avoidIds); // Prof. Arjun Rao
  const unplannedFac = pickTeacher('f25', teachingIdx, 'Analytics & Ops', [...avoidIds, leaveFac]); // Dr. Harish Murthy

  scenarios.push({
    id: 'leave',
    title: 'Leave clash',
    detail: `${facById[leaveFac].name} has approved planned leave on Thursday; ${teachesOn(leaveFac, 3).length} class(es) need cover`,
    slotId: teachesOn(leaveFac, 3)[0]?.id,
    sectionId: teachesOn(leaveFac, 3)[0]?.sectionIds[0],
  });

  const ts = (date: string, hhmm: string) => istTimestamp(date, hhmm);
  const leaves: LeaveRequest[] = [
    {
      id: 'lv-1001',
      facultyId: leaveFac,
      type: 'Planned',
      from: thursday,
      to: thursday,
      periods: [],
      reason: 'Presenting a paper at a national finance conference.',
      status: 'Approved',
      submittedAt: ts(addDaysISO(thursday, -2), '09:12'),
      decidedAt: ts(addDaysISO(thursday, -2), '11:40'),
      decidedBy: APPROVERS[1].name,
      remark: 'Approved. Please share notes with the substitute.',
    },
    {
      id: 'lv-1002',
      facultyId: unplannedFac,
      type: 'Unplanned',
      from: teachingDay,
      to: teachingDay,
      periods: [],
      reason: 'Down with fever since last night.',
      status: 'Approved',
      submittedAt: ts(teachingDay, '07:05'),
      decidedAt: ts(teachingDay, '07:20'),
      decidedBy: APPROVERS[0].name,
      remark: 'Get well soon. Substitutes being arranged.',
    },
    {
      id: 'lv-1003',
      facultyId: 'f10',
      type: 'Planned',
      from: addDaysISO(today, 2),
      to: addDaysISO(today, 2),
      periods: [],
      reason: 'Family function out of town.',
      status: 'Pending',
      submittedAt: ts(today, '08:31'),
    },
    {
      id: 'lv-1004',
      facultyId: 'f18',
      type: 'Planned',
      from: addDaysISO(today, 1),
      to: addDaysISO(today, 2),
      periods: [],
      reason: 'Attending a two-day faculty development programme.',
      status: 'Pending',
      submittedAt: ts(addDaysISO(today, -1), '16:02'),
    },
    {
      id: 'lv-1005',
      facultyId: 'f15',
      type: 'Unplanned',
      from: addDaysISO(today, 1),
      to: addDaysISO(today, 1),
      periods: [5, 6],
      reason: 'Client workshop has been extended into tomorrow afternoon.',
      status: 'Pending',
      submittedAt: ts(today, '10:15'),
    },
    {
      id: 'lv-0996',
      facultyId: 'f17',
      type: 'Planned',
      from: addDaysISO(today, -7),
      to: addDaysISO(today, -7),
      periods: [],
      reason: 'Medical appointment.',
      status: 'Approved',
      submittedAt: ts(addDaysISO(today, -9), '12:10'),
      decidedAt: ts(addDaysISO(today, -9), '15:22'),
      decidedBy: APPROVERS[2].name,
      remark: 'Approved.',
    },
    {
      id: 'lv-0998',
      facultyId: 'f11',
      type: 'Planned',
      from: addDaysISO(today, -3),
      to: addDaysISO(today, -3),
      periods: [],
      reason: 'Personal work.',
      status: 'Rejected',
      submittedAt: ts(addDaysISO(today, -5), '10:44'),
      decidedAt: ts(addDaysISO(today, -5), '14:05'),
      decidedBy: APPROVERS[0].name,
      remark: 'Unit test week for Sem 3. Please reschedule.',
    },
    {
      id: 'lv-1000',
      facultyId: 'f12',
      type: 'Planned',
      from: addDaysISO(week, 7),
      to: addDaysISO(week, 8),
      periods: [],
      reason: 'Invited speaker at a marketing summit.',
      status: 'Approved',
      submittedAt: ts(addDaysISO(today, -2), '09:30'),
      decidedAt: ts(addDaysISO(today, -1), '10:05'),
      decidedBy: APPROVERS[1].name,
      remark: 'Approved. Swap requests to be filed with TTC.',
    },
  ];

  const mails: MockMail[] = [];
  for (const lv of leaves.filter((l) => l.status === 'Pending')) {
    for (const a of APPROVERS) {
      mails.push({
        id: `ml-${lv.id}-${a.name.split(' ')[0].toLowerCase()}`,
        at: lv.submittedAt,
        kind: 'leave-request',
        leaveId: lv.id,
        from: 'timetable@cms.example',
        to: a.email,
        toName: a.name,
        subject: `Leave request: ${facById[lv.facultyId].name} (${lv.type})`,
      });
    }
    mails.push({
      id: `ml-${lv.id}-receipt`,
      at: lv.submittedAt,
      kind: 'leave-receipt',
      leaveId: lv.id,
      from: 'timetable@cms.example',
      to: facById[lv.facultyId].email,
      toName: facById[lv.facultyId].name,
      subject: 'We received your leave request',
    });
  }

  // Published changes for today (07:45 IST) plus one draft, so the daily view has something to show.
  const changes: DailyChange[] = [];
  const publications: DailyPublication[] = [];
  if (todayIdx !== null) {
    const pub: DailyPublication = { id: 'pub-seed-1', date: today, publishedAt: ts(today, '07:45'), publishedBy: APPROVERS[0].name, changeIds: [] };
    const onToday = publishedSlots.filter((s) => s.day === todayIdx);
    const rc = onToday.find((s) => s.kind === 'Regular' && s.sectionIds[0] === 'bba3b' && s.roomId !== 'rsem' && !onToday.some((o) => o.roomId === 'rsem' && o.period === s.period));
    if (rc) changes.push({ id: 'dc-1', date: today, type: 'room-change', status: 'published', scope: 'date', slotId: rc.id, roomId: 'rsem', reason: 'Guest session needs the larger hall.', createdAt: ts(today, '07:30'), createdBy: APPROVERS[0].name, publicationId: pub.id });
    const w1 = onToday.filter((s) => s.kind === 'Regular' && s.sectionIds.length === 1 && s.sectionIds[0] === 'wow1a');
    const a = w1.find((s) => s.period === 3) ?? w1[0];
    const b = w1.find((s) => s.id !== a?.id && s.period !== a?.period && s.facultyId !== a?.facultyId);
    if (a && b && sched.facFree(a.facultyId!, todayIdx, b.period) && sched.facFree(b.facultyId!, todayIdx, a.period)) {
      changes.push({ id: 'dc-2', date: today, type: 'swap', status: 'published', scope: 'date', slotId: a.id, swapWithSlotId: b.id, reason: 'Faculty request: lab prep clash.', createdAt: ts(today, '07:32'), createdBy: APPROVERS[0].name, publicationId: pub.id });
    }
    const cx = onToday.find((s) => s.kind === 'Regular' && s.sectionIds[0] === 'bba5c' && s.facultyId !== unplannedFac);
    if (cx) changes.push({ id: 'dc-3', date: today, type: 'cancellation', status: 'published', scope: 'date', slotId: cx.id, reason: 'Faculty on external examination duty; class to be compensated on Saturday.', createdAt: ts(today, '07:36'), createdBy: APPROVERS[0].name, publicationId: pub.id });
    pub.changeIds = changes.map((c) => c.id);
    if (pub.changeIds.length) publications.push(pub);

    // One draft extra class waiting to be published.
    for (const sec of sections) {
      const free = SHIFTS[sec.shift].periods.find((p) => sched.secFree(sec.id, todayIdx, p));
      if (!free) continue;
      const sub = subjects.find((x) => x.program === sec.program && x.semester === sec.semester && x.kind === 'Core')!;
      const fid = assignments[sec.id][sub.id];
      if (!sched.facFree(fid, todayIdx, free) || !sched.roomFree(sec.homeRoomId, todayIdx, free)) continue;
      changes.push({ id: 'dc-4', date: today, type: 'extra-class', status: 'draft', scope: 'date', sectionIds: [sec.id], period: free, subjectId: sub.id, facultyId: fid, roomId: sec.homeRoomId, reason: 'Doubt-clearing session before the unit test.', createdAt: ts(today, '09:10'), createdBy: COMMITTEE_USER });
      break;
    }
  }

  const bookings: RoomBooking[] = [];
  const book = (roomId: string, date: string, period: Period, purpose: string, by: string) => {
    const d = dayIndexOf(date);
    if (d === null || !sched.roomFree(roomId, d, period)) return;
    bookings.push({ id: `bk-${bookings.length + 1}`, roomId, date, period, purpose, bookedBy: by, createdAt: ts(addDaysISO(date, -1), '15:00') });
  };
  book('rbrd', today, 5, 'TTC weekly review', COMMITTEE_USER);
  book('rmr1', today, 3, 'Interview panel: visiting faculty', APPROVERS[1].name);
  book('rsem', addDaysISO(today, 1), 6, 'Guest lecture: careers in fintech', 'Dr. Fatima Sheikh');
  book('rlab1', addDaysISO(today, 2), 7, 'Placement aptitude test', 'Ms. Megha Kulkarni');
  book('rmr2', addDaysISO(today, 1), 2, 'Accreditation document review', APPROVERS[2].name);

  const memories: Memory[] = [
    { id: 'mem-1', text: 'Unit tests for BBA Sem 1 and WOW Sem 5 run on Saturday, period 1.', kind: 'standing', createdAt: ts(addDaysISO(today, -20), '10:00') },
    { id: 'mem-2', text: 'Room 401 is held for the accreditation visit.', kind: 'time-bound', createdAt: ts(addDaysISO(today, -2), '12:00'), expires: addDaysISO(today, 4) },
  ];

  const yesterday = addDaysISO(today, -1);
  const snapshot: Snapshot = {
    id: 'snap-12',
    version: 12,
    publishedAt: ts(yesterday, '18:30'),
    publishedBy: APPROVERS[0].name,
    slots: publishedSlots,
    summary: { critical: 0, warning: 0, advisory: 0 },
  };

  const unplaced = [...unplacedMap.entries()].map(([k, hours]) => {
    const [sectionId, subjectId] = k.split('|');
    return { sectionId, subjectId, hours };
  });

  void secById;
  return {
    faculty,
    subjects,
    rooms,
    sections,
    assignments,
    publishedSlots,
    draftSlots,
    leaves,
    changes,
    publications,
    bookings,
    memories,
    mails,
    snapshot,
    scenarios,
    term: termFor(today),
    unplaced,
  };
}

/* ------------------------------------------------------------------ */
/* Greedy scheduler used only by the seed                              */
/* ------------------------------------------------------------------ */

type NewSlot = Omit<Slot, 'id'>;

class Scheduler {
  slots: Slot[] = [];
  private f = new Set<string>();
  private r = new Set<string>();
  private s = new Set<string>();
  private subjDay = new Set<string>();
  private facDayPeriods = new Map<string, Set<number>>();
  private n = 0;
  private rng: Rng;
  private fac: Record<string, Faculty>;
  private rooms: Record<string, Room>;

  constructor(rng: Rng, fac: Record<string, Faculty>, rooms: Record<string, Room>) {
    this.rng = rng;
    this.fac = fac;
    this.rooms = rooms;
  }

  cellsFor(periods: Period[]): [DayIndex, Period][] {
    const out: [DayIndex, Period][] = [];
    for (let d = 0 as DayIndex; d < 6; d = (d + 1) as DayIndex) for (const p of periods) out.push([d, p]);
    return out;
  }

  facFree(id: string, d: number, p: number) {
    return !this.f.has(`${id}|${d}|${p}`);
  }
  roomFree(id: string, d: number, p: number) {
    return !this.r.has(`${id}|${d}|${p}`);
  }
  secFree(id: string, d: number, p: number) {
    return !this.s.has(`${id}|${d}|${p}`);
  }

  place(slot: NewSlot): Slot {
    const full: Slot = { id: `m${(++this.n).toString(36).padStart(3, '0')}`, ...slot };
    this.slots.push(full);
    if (full.facultyId) {
      this.f.add(`${full.facultyId}|${full.day}|${full.period}`);
      const k = `${full.facultyId}|${full.day}`;
      if (!this.facDayPeriods.has(k)) this.facDayPeriods.set(k, new Set());
      this.facDayPeriods.get(k)!.add(full.period);
    }
    if (full.roomId) this.r.add(`${full.roomId}|${full.day}|${full.period}`);
    for (const id of full.sectionIds) this.s.add(`${id}|${full.day}|${full.period}`);
    if (full.subjectId) for (const id of full.sectionIds) this.subjDay.add(`${id}|${full.subjectId}|${full.day}`);
    return full;
  }

  /** Would adding `p` give this faculty a run of 4+ consecutive periods that day? */
  private longRun(fid: string, d: number, p: number): boolean {
    const set = new Set(this.facDayPeriods.get(`${fid}|${d}`) ?? []);
    set.add(p);
    let run = 1;
    for (let q = p - 1; set.has(q); q--) run++;
    for (let q = p + 1; set.has(q); q++) run++;
    return run >= 4;
  }

  private dayLoad(fid: string, d: number): number {
    return this.facDayPeriods.get(`${fid}|${d}`)?.size ?? 0;
  }

  private pickRoom(sec: Section, d: number, p: number, pref?: string): string | undefined {
    const strength = sec.strength;
    if (pref && this.roomFree(pref, d, p) && this.rooms[pref].capacity >= strength) return pref;
    if (this.roomFree(sec.homeRoomId, d, p)) return sec.homeRoomId;
    const spare = Object.values(this.rooms)
      .filter((r) => r.type === 'Classroom' && r.capacity >= strength && this.roomFree(r.id, d, p))
      .sort((a, b) => a.capacity - b.capacity)[0];
    return spare?.id;
  }

  placeFlexible(sec: Section, o: { kind: 'Fixed'; label: FixedLabel; facultyId?: string; roomPref?: string; avoidDay: number }): boolean {
    const periods = SHIFTS[sec.shift].periods;
    const cands = shuffle(this.cellsFor(periods), this.rng).sort((a, b) => b[1] - a[1]);
    for (const [d, p] of cands) {
      if (!this.secFree(sec.id, d, p)) continue;
      if (o.facultyId) {
        const f = this.fac[o.facultyId];
        if (!this.facFree(o.facultyId, d, p) || p < f.window[0] || p > f.window[1]) continue;
      }
      let roomId: string | undefined;
      if (o.roomPref) {
        roomId = this.pickRoom(sec, d, p, o.roomPref);
        if (!roomId) continue;
      }
      this.place({ day: d, period: p, sectionIds: [sec.id], kind: 'Fixed', label: o.label, facultyId: o.facultyId, roomId });
      return true;
    }
    return false;
  }

  placeCore(sec: Section, sub: Subject, fid: string): boolean {
    const f = this.fac[fid];
    const periods = SHIFTS[sec.shift].periods.filter((p) => p >= f.window[0] && p <= f.window[1]);
    const cands = shuffle(this.cellsFor(periods), this.rng);
    let best: { d: DayIndex; p: Period; score: number; room: string } | null = null;
    for (const [d, p] of cands) {
      if (!this.secFree(sec.id, d, p) || !this.facFree(fid, d, p)) continue;
      const room = this.pickRoom(sec, d, p, sub.needsLab ? 'rlab2' : undefined);
      if (!room) continue;
      let score = 0;
      if (this.subjDay.has(`${sec.id}|${sub.id}|${d}`)) score += 50;
      if (this.longRun(fid, d, p)) score += 200;
      score += this.dayLoad(fid, d) * 4;
      if (sub.needsLab && room !== 'rlab2') score += 3;
      if (!best || score < best.score) best = { d, p, score, room };
    }
    if (!best) return false;
    this.place({ day: best.d, period: best.p, sectionIds: [sec.id], kind: 'Regular', subjectId: sub.id, facultyId: fid, roomId: best.room });
    return true;
  }
}
