import { DAY_SHORT, SHIFTS } from './constants';
import type { Clash, DayIndex, Faculty, LeaveType, Period, Room, Section, Severity, Slot, Subject } from './types';

export interface EngineRefs {
  sections: Record<string, Section>;
  rooms: Record<string, Room>;
  faculty: Record<string, Faculty>;
  subjects: Record<string, Subject>;
}

export interface LeaveHit {
  leaveId: string;
  type: LeaveType;
  date: string;
}

/** Returns the approved leave that covers this faculty member for this slot, or null. */
export type LeaveLookup = (facultyId: string, day: DayIndex, period: Period, slotId: string) => LeaveHit | null;

export interface ChangeSet {
  /** Slots whose clash list changed. */
  slots: Set<string>;
  /** Section cell keys (`section|day|period`) whose slot list changed. */
  cells: Set<string>;
}

export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, advisory: 2 };

const EMPTY: readonly string[] = Object.freeze([]);
const NO_CLASHES: readonly Clash[] = Object.freeze([]);

export function cellKey(sectionId: string, day: DayIndex, period: Period): string {
  return `${sectionId}|${day}|${period}`;
}

export function sectionLabel(s: Section): string {
  return `${s.program} Sem ${s.semester} · ${s.name}`;
}

/**
 * Incremental clash index.
 *
 * Slots are indexed by faculty, room and section for each (day, period).
 * An edit only re-evaluates the handful of keys it touches, so a check
 * costs the same with 50 slots or 5,000.
 */
export class ClashEngine {
  readonly slots = new Map<string, Slot>();

  private fac = new Map<string, Set<string>>();
  private room = new Map<string, Set<string>>();
  private sec = new Map<string, Set<string>>();
  private facDay = new Map<string, Set<string>>();
  private elect = new Map<string, Set<string>>();
  private groups = new Map<string, Set<string>>();
  private facLoad = new Map<string, number>();

  private keyed = new Map<string, Clash>();
  private keyedBySlot = new Map<string, Set<string>>();
  private single = new Map<string, Clash[]>();
  private bySlot = new Map<string, readonly Clash[]>();
  private cellArrays = new Map<string, readonly string[]>();
  private listCache: Clash[] | null = null;

  private refs: EngineRefs;
  private leave: LeaveLookup;

  constructor(refs: EngineRefs, leave: LeaveLookup = () => null) {
    this.refs = refs;
    this.leave = leave;
  }

  /* ---------------------------- public API ---------------------------- */

  load(slots: Iterable<Slot>): void {
    this.slots.clear();
    for (const m of [this.fac, this.room, this.sec, this.facDay, this.elect, this.groups]) m.clear();
    this.facLoad.clear();
    this.keyed.clear();
    this.keyedBySlot.clear();
    this.single.clear();
    this.bySlot.clear();
    this.cellArrays.clear();
    this.listCache = null;

    for (const s of slots) {
      this.slots.set(s.id, s);
      for (const k of this.keysOf(s)) this.addKey(k, s.id);
      if (s.facultyId) this.facLoad.set(s.facultyId, (this.facLoad.get(s.facultyId) ?? 0) + 1);
    }
    for (const k of this.allKeys()) this.evalKey(k);
    for (const s of this.slots.values()) this.single.set(s.id, this.evalSingle(s));
    for (const id of this.slots.keys()) this.rebuildSlot(id);
    for (const [k, set] of this.sec) this.cellArrays.set(k.slice(2), Array.from(set));
  }

  upsert(slot: Slot): ChangeSet {
    const prev = this.slots.get(slot.id);
    const touched = new Set<string>();
    const cells = new Set<string>();
    if (prev) {
      for (const k of this.keysOf(prev)) {
        this.removeKey(k, prev.id);
        touched.add(k);
      }
      if (prev.facultyId) this.facLoad.set(prev.facultyId, (this.facLoad.get(prev.facultyId) ?? 1) - 1);
    }
    this.slots.set(slot.id, slot);
    for (const k of this.keysOf(slot)) {
      this.addKey(k, slot.id);
      touched.add(k);
    }
    if (slot.facultyId) this.facLoad.set(slot.facultyId, (this.facLoad.get(slot.facultyId) ?? 0) + 1);
    return this.settle(touched, cells, [slot.id], prev ? [prev] : []);
  }

  remove(id: string): ChangeSet {
    const prev = this.slots.get(id);
    const cells = new Set<string>();
    if (!prev) return { slots: new Set(), cells };
    const touched = new Set<string>();
    for (const k of this.keysOf(prev)) {
      this.removeKey(k, id);
      touched.add(k);
    }
    if (prev.facultyId) this.facLoad.set(prev.facultyId, (this.facLoad.get(prev.facultyId) ?? 1) - 1);
    this.slots.delete(id);
    this.single.delete(id);
    const res = this.settle(touched, cells, [], [prev]);
    this.bySlot.delete(id);
    this.keyedBySlot.delete(id);
    res.slots.add(id);
    return res;
  }

  /** Swap the leave lookup (e.g. after a leave is approved) and re-check leave for every slot. */
  setLeaveLookup(leave: LeaveLookup): ChangeSet {
    this.leave = leave;
    const changed = new Set<string>();
    for (const s of this.slots.values()) {
      this.single.set(s.id, this.evalSingle(s));
      if (this.rebuildSlot(s.id)) changed.add(s.id);
    }
    if (changed.size) this.listCache = null;
    return { slots: changed, cells: new Set() };
  }

  clashesOf(slotId: string): readonly Clash[] {
    return this.bySlot.get(slotId) ?? NO_CLASHES;
  }

  cell(sectionId: string, day: DayIndex, period: Period): readonly string[] {
    return this.cellArrays.get(cellKey(sectionId, day, period)) ?? EMPTY;
  }

  cellByKey(key: string): readonly string[] {
    return this.cellArrays.get(key) ?? EMPTY;
  }

  list(): Clash[] {
    if (this.listCache) return this.listCache;
    const out: Clash[] = [...this.keyed.values()];
    for (const arr of this.single.values()) out.push(...arr);
    out.sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.day - b.day || a.period - b.period || a.id.localeCompare(b.id),
    );
    this.listCache = out;
    return out;
  }

  counts(): Record<Severity, number> {
    const c: Record<Severity, number> = { critical: 0, warning: 0, advisory: 0 };
    for (const x of this.list()) c[x.severity]++;
    return c;
  }

  facultyLoad(facultyId: string): number {
    return this.facLoad.get(facultyId) ?? 0;
  }

  isFacultyFree(facultyId: string, day: DayIndex, period: Period, exceptSlotId?: string): boolean {
    return isFree(this.fac.get(`f|${facultyId}|${day}|${period}`), exceptSlotId);
  }

  isRoomFree(roomId: string, day: DayIndex, period: Period, exceptSlotId?: string): boolean {
    return isFree(this.room.get(`r|${roomId}|${day}|${period}`), exceptSlotId);
  }

  isSectionFree(sectionId: string, day: DayIndex, period: Period, exceptSlotId?: string): boolean {
    return isFree(this.sec.get(`s|${sectionId}|${day}|${period}`), exceptSlotId);
  }

  slotsOfFaculty(facultyId: string, day: DayIndex): Slot[] {
    const set = this.facDay.get(`fd|${facultyId}|${day}`);
    if (!set) return [];
    return [...set].map((id) => this.slots.get(id)!).sort((a, b) => a.period - b.period);
  }

  slotsInRoom(roomId: string, day: DayIndex, period: Period): Slot[] {
    const set = this.room.get(`r|${roomId}|${day}|${period}`);
    return set ? [...set].map((id) => this.slots.get(id)!) : [];
  }

  /** Clashes the slot would have if it were saved, without keeping the change. */
  probe(slot: Slot): Clash[] {
    const prev = this.slots.get(slot.id);
    this.upsert(slot);
    const out = [...this.clashesOf(slot.id)];
    if (prev) this.upsert(prev);
    else this.remove(slot.id);
    return out;
  }

  /** Human sentence naming the other class involved in a clash, from one slot's point of view. */
  describeFor(clash: Clash, slotId: string): string {
    const others = clash.slotIds.filter((id) => id !== slotId).map((id) => this.slots.get(id)).filter(Boolean) as Slot[];
    const me = this.slots.get(slotId);
    if (!me || others.length === 0) return clash.message;
    const other = others[0];
    const where = this.placeOf(other);
    if (clash.type === 'faculty-double') {
      const f = me.facultyId ? this.refs.faculty[me.facultyId]?.name : 'This faculty member';
      return `${f} is already in ${where}.`;
    }
    if (clash.type === 'room-double') {
      const r = me.roomId ? this.refs.rooms[me.roomId]?.name : 'This room';
      return `${r} is already taken by ${where}.`;
    }
    if (clash.type === 'section-double') {
      return `This section already has ${this.subjectName(other)} at ${DAY_SHORT[other.day]} P${other.period}.`;
    }
    return clash.message;
  }

  /* ---------------------------- internals ---------------------------- */

  private keysOf(s: Slot): string[] {
    const keys: string[] = [];
    const dp = `${s.day}|${s.period}`;
    if (s.facultyId) {
      keys.push(`f|${s.facultyId}|${dp}`);
      keys.push(`fd|${s.facultyId}|${s.day}`);
    }
    if (s.roomId) keys.push(`r|${s.roomId}|${dp}`);
    for (const sec of s.sectionIds) keys.push(`s|${sec}|${dp}`);
    if ((s.kind === 'OE' || s.kind === 'ME') && s.sectionIds.length) {
      const first = this.refs.sections[s.sectionIds[0]];
      if (first) keys.push(`e|${first.program}|${first.semester}|${dp}`);
    }
    if (s.group) keys.push(`g|${s.group}`);
    return keys;
  }

  private mapFor(key: string): Map<string, Set<string>> {
    switch (key.slice(0, key.indexOf('|'))) {
      case 'f':
        return this.fac;
      case 'fd':
        return this.facDay;
      case 'r':
        return this.room;
      case 's':
        return this.sec;
      case 'e':
        return this.elect;
      default:
        return this.groups;
    }
  }

  private addKey(key: string, id: string): void {
    const map = this.mapFor(key);
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(id);
  }

  private removeKey(key: string, id: string): void {
    const map = this.mapFor(key);
    const set = map.get(key);
    if (!set) return;
    set.delete(id);
    if (set.size === 0) map.delete(key);
  }

  private *allKeys(): Iterable<string> {
    yield* this.fac.keys();
    yield* this.room.keys();
    yield* this.sec.keys();
    yield* this.elect.keys();
    yield* this.facDay.keys();
  }

  private settle(touched: Set<string>, cells: Set<string>, changedIds: string[], prevSlots: Slot[]): ChangeSet {
    const affected = new Set<string>(changedIds);
    for (const p of prevSlots) affected.add(p.id);

    for (const k of touched) {
      // Slots that sat under this key before or after the edit may gain or lose a clash.
      const set = this.mapFor(k).get(k);
      if (set) for (const id of set) affected.add(id);
      const prevClash = this.keyed.get(this.clashKeyFor(k));
      if (prevClash) for (const id of prevClash.slotIds) affected.add(id);
      this.evalKey(k);
      if (k.startsWith('s|')) {
        const ck = k.slice(2);
        const now = this.sec.get(k);
        this.cellArrays.set(ck, now ? Array.from(now) : EMPTY);
        cells.add(ck);
      }
      if (k.startsWith('g|')) {
        // Group size feeds the capacity estimate for every offering in the group.
        const g = this.groups.get(k);
        if (g) for (const id of g) affected.add(id);
      }
    }

    for (const id of changedIds) {
      const s = this.slots.get(id);
      if (s) this.single.set(id, this.evalSingle(s));
    }
    for (const id of affected) {
      const s = this.slots.get(id);
      if (s && !changedIds.includes(id)) this.single.set(id, this.evalSingle(s));
    }

    const changed = new Set<string>();
    for (const id of affected) if (this.slots.has(id) && this.rebuildSlot(id)) changed.add(id);
    this.listCache = null;
    return { slots: changed, cells };
  }

  private clashKeyFor(indexKey: string): string {
    if (indexKey.startsWith('fd|')) return `c|${indexKey.slice(3)}`;
    return indexKey;
  }

  private setKeyed(key: string, clash: Clash | null): void {
    const prev = this.keyed.get(key);
    if (prev) {
      for (const id of prev.slotIds) this.keyedBySlot.get(id)?.delete(key);
      this.keyed.delete(key);
    }
    if (clash) {
      this.keyed.set(key, clash);
      for (const id of clash.slotIds) {
        let set = this.keyedBySlot.get(id);
        if (!set) {
          set = new Set();
          this.keyedBySlot.set(id, set);
        }
        set.add(key);
      }
    }
  }

  private evalKey(key: string): void {
    const kind = key.slice(0, key.indexOf('|'));
    if (kind === 'g') return;
    if (kind === 'fd') {
      this.setKeyed(this.clashKeyFor(key), this.evalConsecutive(key));
      return;
    }
    const set = this.mapFor(key).get(key);
    const ids = set ? [...set] : [];
    let clash: Clash | null = null;
    if (kind === 'f' && ids.length > 1) clash = this.facultyClash(key, ids);
    else if (kind === 'r' && ids.length > 1) clash = this.roomClash(key, ids);
    else if (kind === 's' && ids.length > 1) clash = this.sectionClash(key, ids);
    else if (kind === 'e' && ids.length > 1) clash = this.electiveClash(key, ids);
    this.setKeyed(key, clash);
  }

  private facultyClash(key: string, ids: string[]): Clash {
    const slots = ids.map((id) => this.slots.get(id)!);
    const s0 = slots[0];
    const f = this.refs.faculty[s0.facultyId!];
    const places = slots.map((s) => this.placeOf(s)).join(' and ');
    return {
      id: key,
      type: 'faculty-double',
      severity: 'critical',
      slotIds: ids,
      day: s0.day,
      period: s0.period,
      title: 'Faculty double-booked',
      message: `${f?.name ?? 'Faculty'} is booked in ${places}.`,
    };
  }

  private roomClash(key: string, ids: string[]): Clash {
    const slots = ids.map((id) => this.slots.get(id)!);
    const s0 = slots[0];
    const r = this.refs.rooms[s0.roomId!];
    return {
      id: key,
      type: 'room-double',
      severity: 'critical',
      slotIds: ids,
      day: s0.day,
      period: s0.period,
      title: 'Room double-booked',
      message: `${r?.name ?? 'Room'} is booked by ${slots.map((s) => this.whoOf(s)).join(' and ')} at ${DAY_SHORT[s0.day]} P${s0.period}.`,
    };
  }

  private sectionClash(key: string, ids: string[]): Clash | null {
    const units = new Set(ids.map((id) => this.slots.get(id)!.group ?? id));
    if (units.size < 2) return null; // parallel electives in one group are fine
    const slots = ids.map((id) => this.slots.get(id)!);
    const s0 = slots[0];
    const secId = key.split('|')[1];
    const sec = this.refs.sections[secId];
    return {
      id: key,
      type: 'section-double',
      severity: 'critical',
      slotIds: ids,
      day: s0.day,
      period: s0.period,
      title: 'Section double-booked',
      message: `${sec ? sectionLabel(sec) : 'Section'} has ${slots.map((s) => this.subjectName(s)).join(' and ')} at ${DAY_SHORT[s0.day]} P${s0.period}.`,
    };
  }

  private electiveClash(key: string, ids: string[]): Clash | null {
    const groups = new Set(ids.map((id) => this.slots.get(id)!.group ?? id));
    if (groups.size < 2) return null;
    const s0 = this.slots.get(ids[0])!;
    const [, program, sem] = key.split('|');
    const kinds = [...new Set(ids.map((id) => this.slots.get(id)!.kind))].join(' and ');
    return {
      id: key,
      type: 'elective-overlap',
      severity: 'warning',
      slotIds: ids,
      day: s0.day,
      period: s0.period,
      title: 'Elective overlap',
      message: `${program} Sem ${sem}: ${kinds} blocks run together at ${DAY_SHORT[s0.day]} P${s0.period}; students taking both cannot attend.`,
    };
  }

  private evalConsecutive(key: string): Clash | null {
    const set = this.facDay.get(key);
    if (!set || set.size < 4) return null;
    const slots = [...set].map((id) => this.slots.get(id)!);
    const periods = [...new Set(slots.map((s) => s.period))].sort((a, b) => a - b);
    let runStart = 0;
    let best: [number, number] | null = null;
    for (let i = 1; i <= periods.length; i++) {
      if (i === periods.length || periods[i] !== periods[i - 1] + 1) {
        if (i - runStart >= 4) best = [periods[runStart], periods[i - 1]];
        runStart = i;
      }
    }
    if (!best) return null;
    const [from, to] = best;
    const inRun = slots.filter((s) => s.period >= from && s.period <= to);
    const f = this.refs.faculty[slots[0].facultyId!];
    return {
      id: `c|${key.slice(3)}`,
      type: 'consecutive',
      severity: 'advisory',
      slotIds: inRun.map((s) => s.id),
      day: slots[0].day,
      period: from as Period,
      title: 'Long teaching run',
      message: `${f?.name ?? 'Faculty'} teaches ${to - from + 1} periods in a row on ${DAY_SHORT[slots[0].day]} (P${from}–P${to}).`,
    };
  }

  private evalSingle(s: Slot): Clash[] {
    const out: Clash[] = [];
    const base = { day: s.day, period: s.period, slotIds: [s.id] };
    if (s.facultyId) {
      const f = this.refs.faculty[s.facultyId];
      const hit = this.leave(s.facultyId, s.day, s.period, s.id);
      if (hit) {
        out.push({
          ...base,
          id: `leave|${s.id}`,
          type: 'faculty-leave',
          severity: 'critical',
          title: 'Faculty on approved leave',
          message: `${f?.name ?? 'Faculty'} is on approved ${hit.type.toLowerCase()} leave on ${DAY_SHORT[s.day]} (${hit.date}). Arrange a substitute.`,
        });
      }
      if (f && (s.period < f.window[0] || s.period > f.window[1])) {
        out.push({
          ...base,
          id: `hours|${s.id}`,
          type: 'working-hours',
          severity: 'warning',
          title: 'Outside working hours',
          message: `${f.name} is available P${f.window[0]}–P${f.window[1]} only.`,
        });
      }
    }
    if (s.kind !== 'Fixed' && s.kind !== 'OE' && s.kind !== 'ME') {
      for (const id of s.sectionIds) {
        const sec = this.refs.sections[id];
        if (sec && !SHIFTS[sec.shift].periods.includes(s.period)) {
          out.push({
            ...base,
            id: `shift|${s.id}|${id}`,
            type: 'working-hours',
            severity: 'warning',
            title: 'Outside section shift',
            message: `${sectionLabel(sec)} runs ${SHIFTS[sec.shift].name} (P${SHIFTS[sec.shift].periods[0]}–P${SHIFTS[sec.shift].periods[3]}).`,
          });
          break;
        }
      }
    }
    if (s.roomId) {
      const room = this.refs.rooms[s.roomId];
      const strength = this.strengthOf(s);
      if (room && strength > room.capacity) {
        out.push({
          ...base,
          id: `cap|${s.id}`,
          type: 'capacity',
          severity: 'warning',
          title: 'Capacity exceeded',
          message: `${strength} students, ${room.name} seats ${room.capacity}.`,
        });
      }
    }
    return out;
  }

  strengthOf(s: Slot): number {
    let total = 0;
    for (const id of s.sectionIds) total += this.refs.sections[id]?.strength ?? 0;
    if (s.group) {
      const n = this.groups.get(`g|${s.group}`)?.size ?? 1;
      // Students split across parallel offerings; count offerings in this sitting only.
      const sitting = [...(this.groups.get(`g|${s.group}`) ?? [])].filter((id) => {
        const o = this.slots.get(id);
        return o && o.day === s.day && o.period === s.period;
      }).length;
      return Math.ceil(total / Math.max(1, sitting || n));
    }
    return total;
  }

  /** Returns true when the slot's clash array actually changed. */
  private rebuildSlot(id: string): boolean {
    const keyed = this.keyedBySlot.get(id);
    const next: Clash[] = [];
    if (keyed) for (const k of keyed) next.push(this.keyed.get(k)!);
    const singles = this.single.get(id);
    if (singles) next.push(...singles);
    next.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.id.localeCompare(b.id));
    const prev = this.bySlot.get(id) ?? NO_CLASHES;
    if (sameClashes(prev, next)) return false;
    this.bySlot.set(id, next.length ? next : NO_CLASHES);
    return true;
  }

  private subjectName(s: Slot): string {
    if (s.label) return s.label;
    const sub = s.subjectId ? this.refs.subjects[s.subjectId] : undefined;
    return sub ? sub.name : 'a class';
  }

  private whoOf(s: Slot): string {
    if (s.kind === 'OE' || s.kind === 'ME') return `${s.kind} ${this.subjectName(s)}`;
    const secs = s.sectionIds.map((id) => this.refs.sections[id]).filter(Boolean) as Section[];
    if (secs.length === 0) return this.subjectName(s);
    if (secs.length === 1) return sectionLabel(secs[0]);
    return `${secs[0].program} Sem ${secs[0].semester} · ${secs.map((x) => x.name).join('+')}`;
  }

  private placeOf(s: Slot): string {
    const secs = s.sectionIds.map((id) => this.refs.sections[id]).filter(Boolean) as Section[];
    const room = s.roomId ? this.refs.rooms[s.roomId]?.name : undefined;
    let who: string;
    if (s.kind === 'OE' || s.kind === 'ME') who = `${secs[0]?.program ?? ''} Semester ${secs[0]?.semester ?? ''}, ${s.kind} ${this.subjectName(s)}`;
    else if (secs.length > 1) who = `Semester ${secs[0].semester}, Sections ${secs.map((x) => x.name).join('+')} (${secs[0].program})`;
    else if (secs.length === 1) who = `Semester ${secs[0].semester}, Section ${secs[0].name} (${secs[0].program})`;
    else who = this.subjectName(s);
    return `${who}, ${DAY_SHORT[s.day]} Period ${s.period}${room ? `, ${room}` : ''}`;
  }
}

function isFree(set: Set<string> | undefined, except?: string): boolean {
  if (!set || set.size === 0) return true;
  if (except && set.size === 1 && set.has(except)) return true;
  return false;
}

function sameClashes(a: readonly Clash[], b: readonly Clash[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].message !== b[i].message || a[i].slotIds.length !== b[i].slotIds.length) return false;
  }
  return true;
}
