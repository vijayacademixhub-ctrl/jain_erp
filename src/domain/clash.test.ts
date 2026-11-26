import { describe, expect, it } from 'vitest';
import { generateSeed } from '../data/seed';
import { createRng } from '../data/rng';
import { ClashEngine, type EngineRefs, type LeaveLookup } from './clash';
import type { DayIndex, Period, Slot } from './types';
import { buildSyntheticSlots } from '../data/synthetic';

const TODAY = '2026-10-06'; // a Tuesday
const seed = generateSeed(TODAY);
const refs: EngineRefs = {
  sections: Object.fromEntries(seed.sections.map((s) => [s.id, s])),
  rooms: Object.fromEntries(seed.rooms.map((r) => [r.id, r])),
  faculty: Object.fromEntries(seed.faculty.map((f) => [f.id, f])),
  subjects: Object.fromEntries(seed.subjects.map((s) => [s.id, s])),
};

function engineFor(slots: Slot[], leave?: LeaveLookup) {
  const e = new ClashEngine(refs, leave);
  e.load(slots);
  return e;
}

describe('seed data', () => {
  it('is deterministic', () => {
    const again = generateSeed(TODAY);
    expect(again.publishedSlots).toEqual(seed.publishedSlots);
    expect(again.draftSlots).toEqual(seed.draftSlots);
  });

  it('publishes a timetable with no critical clashes', () => {
    const e = engineFor(seed.publishedSlots);
    expect(e.counts().critical).toBe(0);
  });

  it('places (almost) every required teaching hour', () => {
    const missing = seed.unplaced.reduce((n, u) => n + u.hours, 0);
    expect(missing).toBeLessThanOrEqual(4);
  });

  it('draft contains each deliberate demo scenario', () => {
    const e = engineFor(seed.draftSlots);
    const list = e.list();
    expect(list.filter((c) => c.type === 'faculty-double')).toHaveLength(1);
    expect(list.filter((c) => c.type === 'room-double')).toHaveLength(1);
    const cap = list.filter((c) => c.type === 'capacity');
    expect(cap).toHaveLength(1);
    expect(cap[0].message).toContain('Computer Lab 1');

    const fd = list.find((c) => c.type === 'faculty-double')!;
    const secs = fd.slotIds.map((id) => e.slots.get(id)!.sectionIds[0]).sort();
    expect(secs).toEqual(['bba1a', 'wow5b']);
  });

  it('does not flag the combined class', () => {
    const combined = seed.draftSlots.find((s) => s.kind === 'Combined')!;
    expect(combined.sectionIds).toEqual(['bba1a', 'bba1b']);
    const e = engineFor(seed.draftSlots);
    expect(e.clashesOf(combined.id)).toHaveLength(0);
  });
});

describe('clash engine rules', () => {
  const base = seed.publishedSlots;
  const regular = base.find((s) => s.kind === 'Regular' && s.facultyId)!;

  it('flags a faculty double-booking and clears it when undone', () => {
    const e = engineFor(base);
    const other = base.find((s) => s.kind === 'Regular' && s.facultyId !== regular.facultyId && !(s.day === regular.day && s.period === regular.period))!;
    const moved: Slot = { ...other, facultyId: regular.facultyId, day: regular.day, period: regular.period, roomId: 'r401', sectionIds: other.sectionIds };
    // put the other section in a free cell to isolate the faculty clash
    e.upsert(moved);
    const types = e.clashesOf(moved.id).map((c) => c.type);
    expect(types).toContain('faculty-double');
    expect(e.clashesOf(regular.id).map((c) => c.type)).toContain('faculty-double');
    e.upsert(other);
    expect(e.clashesOf(regular.id).map((c) => c.type)).not.toContain('faculty-double');
  });

  it('flags a room double-booking', () => {
    const e = engineFor(base);
    const a = base.find((s) => s.kind === 'Regular' && s.roomId === 'r201')!;
    const b = base.find((s) => s.kind === 'Regular' && s.day === a.day && s.period === a.period && s.roomId !== a.roomId && s.roomId?.startsWith('r') && s.facultyId !== a.facultyId)!;
    e.upsert({ ...b, roomId: 'r201' });
    expect(e.clashesOf(b.id).some((c) => c.type === 'room-double' && c.severity === 'critical')).toBe(true);
  });

  it('flags a section double-booking but not parallel electives in one group', () => {
    const e = engineFor(base);
    const oe = base.filter((s) => s.kind === 'OE');
    for (const s of oe) expect(e.clashesOf(s.id).filter((c) => c.type === 'section-double')).toHaveLength(0);

    const a = base.find((s) => s.kind === 'Regular' && s.sectionIds[0] === 'bba3a')!;
    const extra: Slot = { id: 'x-dup', day: a.day, period: a.period, sectionIds: ['bba3a'], kind: 'Regular', subjectId: a.subjectId, roomId: 'r401' };
    e.upsert(extra);
    expect(e.clashesOf('x-dup').map((c) => c.type)).toContain('section-double');
  });

  it('flags approved leave as critical', () => {
    const leave: LeaveLookup = (fid, day) => (fid === regular.facultyId && day === regular.day ? { leaveId: 'L', type: 'Planned', date: '2026-10-08' } : null);
    const e = engineFor(base, leave);
    const c = e.clashesOf(regular.id).find((x) => x.type === 'faculty-leave');
    expect(c?.severity).toBe('critical');
  });

  it('warns when capacity is exceeded and when outside working hours', () => {
    const e = engineFor(base);
    const big = base.find((s) => s.kind === 'Regular' && s.sectionIds[0] === 'bba5d')!;
    e.upsert({ ...big, roomId: 'rmr1' });
    expect(e.clashesOf(big.id).find((c) => c.type === 'capacity')?.severity).toBe('warning');

    const ext = seed.faculty.find((f) => f.type === 'External' && f.window[0] === 5)!;
    const early: Slot = { id: 'x-early', day: 0, period: 1, sectionIds: [], kind: 'Regular', facultyId: ext.id };
    e.upsert(early);
    expect(e.clashesOf('x-early').map((c) => c.type)).toContain('working-hours');
  });

  it('gives an advisory for four periods in a row', () => {
    const fid = 'f99';
    const testRefs = { ...refs, faculty: { ...refs.faculty, [fid]: { ...seed.faculty[0], id: fid, window: [1, 8] as [Period, Period] } } };
    const e = new ClashEngine(testRefs);
    e.load([1, 2, 3, 4].map((p) => ({ id: `run${p}`, day: 2 as DayIndex, period: p as Period, sectionIds: [], kind: 'Regular' as const, facultyId: fid })));
    expect(e.list().find((c) => c.type === 'consecutive')?.severity).toBe('advisory');
  });

  it('names the other class in the message', () => {
    const e = engineFor(seed.draftSlots);
    const fd = e.list().find((c) => c.type === 'faculty-double')!;
    const mine = fd.slotIds.find((id) => e.slots.get(id)!.sectionIds[0] === 'bba1a')!;
    const text = e.describeFor(fd, mine);
    expect(text).toMatch(/is already in Semester 5, Section B \(WOW\), \w{3} Period \d, Room 305/);
  });
});

describe('incremental index', () => {
  it('matches a full recompute after many random edits', () => {
    const rng = createRng(7);
    const e = engineFor(seed.draftSlots);
    const ids = seed.draftSlots.map((s) => s.id);
    for (let i = 0; i < 400; i++) {
      const id = ids[Math.floor(rng() * ids.length)];
      const s = e.slots.get(id);
      if (!s) continue;
      if (rng() < 0.08) {
        e.remove(id);
        continue;
      }
      e.upsert({ ...s, day: Math.floor(rng() * 6) as DayIndex, period: (1 + Math.floor(rng() * 8)) as Period });
    }
    const fresh = engineFor([...e.slots.values()]);
    const a = e.list().map((c) => `${c.id}:${[...c.slotIds].sort().join(',')}`).sort();
    const b = fresh.list().map((c) => `${c.id}:${[...c.slotIds].sort().join(',')}`).sort();
    expect(a).toEqual(b);
  });

  it('checks an edit in under 5 ms with 5,000 slots loaded', () => {
    const { slots, refs: bigRefs } = buildSyntheticSlots(5000, 11);
    const e = new ClashEngine(bigRefs);
    e.load(slots);
    const rng = createRng(3);
    const t0 = performance.now();
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const s = slots[Math.floor(rng() * slots.length)];
      e.upsert({ ...s, day: Math.floor(rng() * 6) as DayIndex, period: (1 + Math.floor(rng() * 8)) as Period });
    }
    const avg = (performance.now() - t0) / N;
    expect(slots.length).toBeGreaterThanOrEqual(5000);
    expect(avg).toBeLessThan(5);
  });
});
