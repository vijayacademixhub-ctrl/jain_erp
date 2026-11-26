import { describe, expect, it } from 'vitest';
import { generateSeed } from '../data/seed';
import { matchFaculty, parseIntent } from './chat';
import { resolveDay } from './daily';
import { makeLeaveLookup, UNPLANNED_CUTOFF_MIN, validateLeave, type LeaveInput } from './leave';
import type { DailyChange, LeaveRequest } from './types';

const TODAY = '2026-10-06'; // Tuesday
const base: LeaveInput = { type: 'Planned', from: '2026-10-07', to: '2026-10-07', periods: [], reason: 'Conference presentation' };

describe('leave rules', () => {
  it('accepts planned leave a day or more ahead', () => {
    expect(validateLeave(base, TODAY, 600)).toEqual({});
    expect(validateLeave({ ...base, from: '2026-10-08', to: '2026-10-08' }, TODAY, 600)).toEqual({});
  });

  it('rejects planned leave for today', () => {
    expect(validateLeave({ ...base, from: TODAY, to: TODAY }, TODAY, 600).from).toMatch(/at least 1 day ahead/);
  });

  it('allows unplanned leave until the morning of the day', () => {
    const u = { ...base, type: 'Unplanned' as const, from: TODAY, to: TODAY };
    expect(validateLeave(u, TODAY, UNPLANNED_CUTOFF_MIN - 1)).toEqual({});
    expect(validateLeave(u, TODAY, UNPLANNED_CUTOFF_MIN).from).toMatch(/closes at/);
    expect(validateLeave({ ...u, from: '2026-10-07', to: '2026-10-07' }, TODAY, 900)).toEqual({});
    expect(validateLeave({ ...u, from: '2026-10-09', to: '2026-10-09' }, TODAY, 600).from).toMatch(/Planned/);
  });

  it('validates the date range and reason', () => {
    expect(validateLeave({ ...base, to: '2026-10-06' }, TODAY, 600).to).toBeDefined();
    expect(validateLeave({ ...base, reason: 'x' }, TODAY, 600).reason).toBeDefined();
  });

  it('only approved leave reaches the clash engine, and cover clears it', () => {
    const leave: LeaveRequest = { id: 'L', facultyId: 'f01', type: 'Planned', from: '2026-10-08', to: '2026-10-08', periods: [], reason: 'x', status: 'Pending', submittedAt: '' };
    const week = '2026-10-05';
    expect(makeLeaveLookup([leave], week, [])('f01', 3, 2, 's1')).toBeNull();
    const approved = { ...leave, status: 'Approved' as const };
    expect(makeLeaveLookup([approved], week, [])('f01', 3, 2, 's1')?.type).toBe('Planned');
    expect(makeLeaveLookup([approved], week, [])('f01', 2, 2, 's1')).toBeNull();
    const cover: DailyChange = { id: 'c', date: '2026-10-08', type: 'substitution', status: 'draft', scope: 'date', slotId: 's1', facultyId: 'f02', createdAt: '', createdBy: '' };
    expect(makeLeaveLookup([approved], week, [cover])('f01', 3, 2, 's1')).toBeNull();
  });
});

describe('daily resolution', () => {
  const seed = generateSeed(TODAY);
  const slots = seed.publishedSlots.filter((s) => s.day === 1 && s.sectionIds[0] === 'bba3a' && s.kind === 'Regular');
  const [a, b] = slots;
  const mk = (c: Partial<DailyChange>): DailyChange => ({ id: Math.random().toString(36), date: TODAY, status: 'published', scope: 'date', createdAt: '2026-10-06T01:00:00Z', createdBy: 'x', type: 'cancellation', ...c });

  it('swaps periods and keeps the old period for strike-through', () => {
    const out = resolveDay(seed.publishedSlots, 1, [mk({ type: 'swap', slotId: a.id, swapWithSlotId: b.id })]);
    const ea = out.find((e) => e.slotId === a.id)!;
    expect(ea.period).toBe(b.period);
    expect(ea.previous?.period).toBe(a.period);
    expect(ea.status).toBe('changed');
  });

  it('marks substitutions, room changes and cancellations', () => {
    const out = resolveDay(seed.publishedSlots, 1, [mk({ type: 'substitution', slotId: a.id, facultyId: 'f99' }), mk({ type: 'room-change', slotId: a.id, roomId: 'rsem' }), mk({ type: 'cancellation', slotId: b.id })]);
    const ea = out.find((e) => e.slotId === a.id)!;
    expect(ea.facultyId).toBe('f99');
    expect(ea.previous?.facultyId).toBe(a.facultyId);
    expect(ea.roomId).toBe('rsem');
    expect(out.find((e) => e.slotId === b.id)!.status).toBe('cancelled');
  });
});

describe('assistant intents (scripted, no AI)', () => {
  const seed = generateSeed(TODAY);
  const ctx = { faculty: seed.faculty, rooms: seed.rooms, today: TODAY };

  it('reads an absence with a period range', () => {
    const i = parseIntent('Dr. Meera Iyer is absent Thursday periods 2 to 4', ctx);
    expect(i).toMatchObject({ kind: 'absence', facultyId: 'f01', date: '2026-10-08', from: 2, to: 4 });
  });

  it('asks which person when a surname is ambiguous', () => {
    expect(matchFaculty('Rao is absent today', seed.faculty).length).toBeGreaterThan(1);
    expect(parseIntent('Rao is absent today', ctx).kind).toBe('ambiguous-faculty');
  });

  it('understands room closures and memory', () => {
    expect(parseIntent('Room 305 is closed this week', ctx)).toMatchObject({ kind: 'room-closed', roomId: 'r305' });
    expect(parseIntent('Remember: Master Talk is every Friday period 6', ctx)).toMatchObject({ kind: 'remember', memKind: 'standing' });
    expect(parseIntent('Remember: Room 401 is reserved until 15 Oct', ctx)).toMatchObject({ kind: 'remember', memKind: 'time-bound', expires: '2026-10-15' });
  });

  it('never publishes and falls back politely', () => {
    expect(parseIntent('please publish the timetable', ctx).kind).toBe('publish');
    expect(parseIntent('what is the weather', ctx).kind).toBe('unknown');
  });
});
