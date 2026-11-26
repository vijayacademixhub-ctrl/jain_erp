import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { generateAuditHistory } from '../data/auditHistory';
import { generateSeed, SEED_VERSION, type Scenario, type TermInfo } from '../data/seed';
import type { ChatCard, ChatMessage } from '../domain/chat';
import { ClashEngine, type ChangeSet, type EngineRefs } from '../domain/clash';
import { APPROVERS, COMMITTEE_USER, DAY_SHORT } from '../domain/constants';
import { entriesToSlots, resolveDay, CHANGE_LABEL, type DayEntry } from '../domain/daily';
import { leaveCovers, makeLeaveLookup } from '../domain/leave';
import type {
  AuditEntry,
  Clash,
  DailyChange,
  DailyPublication,
  DayIndex,
  Faculty,
  FixedLabel,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  Memory,
  MockMail,
  Period,
  Room,
  RoomBooking,
  Section,
  Severity,
  Slot,
  Snapshot,
  Subject,
} from '../domain/types';
import { addDaysISO, dayIndexOf, fmtDate, todayIST, weekStartOf } from '../lib/dates';
import { idle, uid } from '../lib/util';

const STORAGE_KEY = 'ttp:data:v1';
const MAX_AUDIT = 800;
const MAX_SNAPSHOTS = 6;

export interface TermDeletion {
  term: string;
  requestedAt: string;
  purgeOn: string;
}

interface Persisted {
  v: number;
  seedDate: string;
  slots: Slot[];
  snapshots: Snapshot[];
  leaves: LeaveRequest[];
  changes: DailyChange[];
  publications: DailyPublication[];
  bookings: RoomBooking[];
  audit: AuditEntry[];
  memories: Memory[];
  mails: MockMail[];
  chat: ChatMessage[];
  termDeletion: TermDeletion | null;
  builderWeek: string;
}

export interface DataState {
  today: string;
  term: TermInfo;
  scenarios: Scenario[];
  faculty: Record<string, Faculty>;
  facultyList: Faculty[];
  subjects: Record<string, Subject>;
  subjectList: Subject[];
  rooms: Record<string, Room>;
  roomList: Room[];
  sections: Record<string, Section>;
  sectionList: Section[];
  assignments: Record<string, Record<string, string>>;
  refreshedFromSeed: boolean;

  slots: Record<string, Slot>;
  slotClashes: Record<string, readonly Clash[]>;
  cells: Record<string, readonly string[]>;
  clashList: Clash[];
  clashCounts: Record<Severity, number>;
  lastCheckMs: number;
  builderWeek: string;
  dirty: boolean;

  snapshots: Snapshot[];
  leaves: LeaveRequest[];
  changes: DailyChange[];
  publications: DailyPublication[];
  bookings: RoomBooking[];
  audit: AuditEntry[];
  memories: Memory[];
  mails: MockMail[];
  chat: ChatMessage[];
  termDeletion: TermDeletion | null;

  /* master builder */
  placeSubject: (sectionId: string, subjectId: string, day: DayIndex, period: Period) => Slot | null;
  placeFixed: (sectionId: string, label: FixedLabel, day: DayIndex, period: Period) => Slot | null;
  moveSlot: (slotId: string, day: DayIndex, period: Period) => void;
  updateSlot: (slotId: string, patch: Partial<Omit<Slot, 'id'>>, note?: string) => void;
  removeSlot: (slotId: string) => void;
  publishMaster: (override?: string) => Snapshot | null;
  setBuilderWeek: (week: string) => void;

  /* leave */
  submitLeave: (input: { facultyId: string; type: LeaveType; from: string; to: string; periods: Period[]; reason: string }) => LeaveRequest;
  decideLeave: (id: string, status: Exclude<LeaveStatus, 'Pending'>, by: string, remark: string, via: 'console' | 'email') => void;

  /* daily */
  addChange: (c: Omit<DailyChange, 'id' | 'createdAt' | 'createdBy' | 'status'>, opts?: { by?: string }) => DailyChange;
  removeChange: (id: string) => void;
  publishDay: (date: string, by?: string) => DailyPublication | null;
  undoLastPublish: (date: string) => DailyPublication | null;
  assignAndPublish: (date: string, items: { slotId: string; facultyId: string }[], reason: string) => number;

  /* rooms */
  bookRoom: (b: Omit<RoomBooking, 'id' | 'createdAt'>) => { ok: true; booking: RoomBooking } | { ok: false; error: string };
  cancelBooking: (id: string) => void;

  /* assistant */
  addMemory: (m: Omit<Memory, 'id' | 'createdAt'>) => Memory;
  removeMemory: (id: string) => void;
  pushChat: (m: Omit<ChatMessage, 'id' | 'at'>) => ChatMessage;
  updateChatCard: (id: string, card: ChatCard) => void;
  clearChat: () => void;

  /* misc */
  logAction: (action: string, entity: string, before?: string, after?: string, user?: string) => void;
  requestTermDeletion: () => void;
  cancelTermDeletion: () => void;
  exportBackup: () => string;
  resetDemo: () => void;
}

/* ------------------------------------------------------------------ */
/* Bootstrapping                                                       */
/* ------------------------------------------------------------------ */

const today = todayIST();
let seed = generateSeed(today);

const refsOf = (s: typeof seed): EngineRefs => ({
  sections: Object.fromEntries(s.sections.map((x) => [x.id, x])),
  rooms: Object.fromEntries(s.rooms.map((x) => [x.id, x])),
  faculty: Object.fromEntries(s.faculty.map((x) => [x.id, x])),
  subjects: Object.fromEntries(s.subjects.map((x) => [x.id, x])),
});
let refs = refsOf(seed);

/** The master-draft clash engine. Kept outside React state; the store mirrors its results. */
export const engine = new ClashEngine(refs);

function readPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Persisted;
    if (p.v !== SEED_VERSION || p.seedDate !== today || !Array.isArray(p.slots)) return null;
    return p;
  } catch {
    return null;
  }
}

function hadStaleData(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function freshPersisted(): Persisted {
  return {
    v: SEED_VERSION,
    seedDate: today,
    slots: seed.draftSlots,
    snapshots: [seed.snapshot],
    leaves: seed.leaves,
    changes: seed.changes,
    publications: seed.publications,
    bookings: seed.bookings,
    audit: [],
    memories: seed.memories,
    mails: seed.mails,
    chat: [],
    termDeletion: null,
    builderWeek: weekStartOf(today),
  };
}

function engineState(p: Persisted) {
  engine.load(p.slots);
  engine.setLeaveLookup(makeLeaveLookup(p.leaves, p.builderWeek, p.changes));
  const slotClashes: Record<string, readonly Clash[]> = {};
  for (const s of p.slots) slotClashes[s.id] = engine.clashesOf(s.id);
  const cells: Record<string, readonly string[]> = {};
  for (const s of p.slots) for (const sec of s.sectionIds) {
    const k = `${sec}|${s.day}|${s.period}`;
    cells[k] = engine.cellByKey(k);
  }
  return {
    slots: Object.fromEntries(p.slots.map((s) => [s.id, s])),
    slotClashes,
    cells,
    clashList: engine.list(),
    clashCounts: engine.counts(),
  };
}

function baseState(p: Persisted) {
  return {
    today,
    term: seed.term,
    scenarios: seed.scenarios,
    faculty: refs.faculty,
    facultyList: seed.faculty,
    subjects: refs.subjects,
    subjectList: seed.subjects,
    rooms: refs.rooms,
    roomList: seed.rooms,
    sections: refs.sections,
    sectionList: seed.sections,
    assignments: seed.assignments,
    lastCheckMs: 0,
    dirty: false,
    builderWeek: p.builderWeek,
    snapshots: p.snapshots,
    leaves: p.leaves,
    changes: p.changes,
    publications: p.publications,
    bookings: p.bookings,
    audit: p.audit,
    memories: p.memories,
    mails: p.mails,
    chat: p.chat,
    termDeletion: p.termDeletion,
    ...engineState(p),
  };
}

const persisted = readPersisted();
const initial = persisted ?? freshPersisted();
const refreshedFromSeed = !persisted && hadStaleData();

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

function auditEntry(action: string, entity: string, before?: string, after?: string, user = COMMITTEE_USER): AuditEntry {
  return { id: uid('au'), at: new Date().toISOString(), user, action, entity, before, after };
}

export const useData = create<DataState>()((set, get) => {
  const pushAudit = (e: AuditEntry) => ({ audit: [e, ...get().audit].slice(0, MAX_AUDIT) });

  const mirror = (cs: ChangeSet): Partial<DataState> => {
    const s = get();
    let slotClashes = s.slotClashes;
    let cells = s.cells;
    if (cs.slots.size) {
      slotClashes = { ...slotClashes };
      for (const id of cs.slots) {
        if (engine.slots.has(id)) slotClashes[id] = engine.clashesOf(id);
        else delete slotClashes[id];
      }
    }
    if (cs.cells.size) {
      cells = { ...cells };
      for (const k of cs.cells) cells[k] = engine.cellByKey(k);
    }
    return { slotClashes, cells, clashList: engine.list(), clashCounts: engine.counts() };
  };

  const refreshLeave = (leaves = get().leaves, week = get().builderWeek, changes = get().changes): Partial<DataState> =>
    mirror(engine.setLeaveLookup(makeLeaveLookup(leaves, week, changes)));

  const describe = (s: Slot) => {
    const st = get();
    const what = s.label ?? (s.subjectId ? st.subjects[s.subjectId]?.code : 'Class');
    const who = s.sectionIds.map((id) => st.sections[id]).filter(Boolean).map((x) => `${x.program}${x.semester}${x.name}`).join('+');
    return `${what} · ${who} · ${DAY_SHORT[s.day]} P${s.period}`;
  };

  const upsert = (slot: Slot) => {
    const t0 = performance.now();
    const cs = engine.upsert(slot);
    const ms = performance.now() - t0;
    return { cs, ms };
  };

  const slotsOnDate = (date: string): DayEntry[] => {
    const day = dayIndexOf(date);
    if (day === null) return [];
    const snap = get().snapshots[get().snapshots.length - 1];
    return resolveDay(snap.slots, day, get().changes.filter((c) => c.date === date));
  };

  const applyToMaster = (c: DailyChange) => {
    const st = get();
    const day = dayIndexOf(c.date);
    if (day === null) return;
    if (c.type === 'substitution' && c.slotId && st.slots[c.slotId]) st.updateSlot(c.slotId, { facultyId: c.facultyId }, 'from daily change');
    else if (c.type === 'room-change' && c.slotId && st.slots[c.slotId]) st.updateSlot(c.slotId, { roomId: c.roomId }, 'from daily change');
    else if (c.type === 'cancellation' && c.slotId && st.slots[c.slotId]) st.removeSlot(c.slotId);
    else if (c.type === 'swap' && c.slotId && c.swapWithSlotId) {
      const a = st.slots[c.slotId];
      const b = st.slots[c.swapWithSlotId];
      if (a && b) {
        st.moveSlot(a.id, a.day, b.period);
        st.moveSlot(b.id, b.day, a.period);
      }
    } else if ((c.type === 'extra-class' || c.type === 'workshop') && c.sectionIds && c.period) {
      const slot: Slot = {
        id: uid('m'),
        day,
        period: c.period,
        sectionIds: c.sectionIds,
        kind: c.type === 'workshop' ? 'Fixed' : 'Regular',
        subjectId: c.subjectId,
        facultyId: c.facultyId,
        roomId: c.roomId,
        label: c.type === 'workshop' ? 'Workshop' : undefined,
      };
      const { cs, ms } = upsert(slot);
      set({ slots: { ...get().slots, [slot.id]: slot }, ...mirror(cs), lastCheckMs: ms, dirty: true, ...pushAudit(auditEntry('Added class to master', describe(slot), undefined, 'from daily change')) });
    }
  };

  return {
    ...baseState(initial),
    refreshedFromSeed,

    placeSubject(sectionId, subjectId, day, period) {
      const st = get();
      const sec = st.sections[sectionId];
      const sub = st.subjects[subjectId];
      if (!sec || !sub) return null;
      const facultyId = st.assignments[sectionId]?.[subjectId];
      let roomId = sec.homeRoomId;
      if (sub.needsLab && engine.isRoomFree('rlab2', day, period) && st.rooms.rlab2.capacity >= sec.strength) roomId = 'rlab2';
      const slot: Slot = { id: uid('m'), day, period, sectionIds: [sectionId], kind: 'Regular', subjectId, facultyId, roomId };
      const { cs, ms } = upsert(slot);
      set({
        slots: { ...st.slots, [slot.id]: slot },
        ...mirror(cs),
        lastCheckMs: ms,
        dirty: true,
        ...pushAudit(auditEntry('Placed class', describe(slot), undefined, facultyId ? st.faculty[facultyId]?.name : undefined)),
      });
      return slot;
    },

    placeFixed(sectionId, label, day, period) {
      const st = get();
      const sec = st.sections[sectionId];
      if (!sec) return null;
      const slot: Slot = {
        id: uid('m'),
        day,
        period,
        sectionIds: [sectionId],
        kind: label === 'Unit Test' ? 'Test' : 'Fixed',
        label,
        roomId: label === 'LIB' ? undefined : sec.homeRoomId,
      };
      const { cs, ms } = upsert(slot);
      set({ slots: { ...st.slots, [slot.id]: slot }, ...mirror(cs), lastCheckMs: ms, dirty: true, ...pushAudit(auditEntry('Placed fixed block', describe(slot))) });
      return slot;
    },

    moveSlot(slotId, day, period) {
      const st = get();
      const prev = st.slots[slotId];
      if (!prev || (prev.day === day && prev.period === period)) return;
      const next: Slot = { ...prev, day, period };
      const { cs, ms } = upsert(next);
      set({
        slots: { ...st.slots, [slotId]: next },
        ...mirror(cs),
        lastCheckMs: ms,
        dirty: true,
        ...pushAudit(auditEntry('Moved class', describe(next), `${DAY_SHORT[prev.day]} P${prev.period}`, `${DAY_SHORT[day]} P${period}`)),
      });
    },

    updateSlot(slotId, patch, note) {
      const st = get();
      const prev = st.slots[slotId];
      if (!prev) return;
      const next: Slot = { ...prev, ...patch };
      const { cs, ms } = upsert(next);
      const fmt = (s: Slot) =>
        [s.facultyId ? st.faculty[s.facultyId]?.name : 'No faculty', s.roomId ? st.rooms[s.roomId]?.name : 'No room'].join(' · ');
      set({
        slots: { ...st.slots, [slotId]: next },
        ...mirror(cs),
        lastCheckMs: ms,
        dirty: true,
        ...pushAudit(auditEntry(note ? `Edited class (${note})` : 'Edited class', describe(next), fmt(prev), fmt(next))),
      });
    },

    removeSlot(slotId) {
      const st = get();
      const prev = st.slots[slotId];
      if (!prev) return;
      const t0 = performance.now();
      const cs = engine.remove(slotId);
      const ms = performance.now() - t0;
      const slots = { ...st.slots };
      delete slots[slotId];
      set({ slots, ...mirror(cs), lastCheckMs: ms, dirty: true, ...pushAudit(auditEntry('Removed class', describe(prev))) });
    },

    publishMaster(override) {
      const st = get();
      const counts = engine.counts();
      if (counts.critical > 0 && !override) return null;
      const last = st.snapshots[st.snapshots.length - 1];
      const snap: Snapshot = {
        id: uid('snap'),
        version: (last?.version ?? 0) + 1,
        publishedAt: new Date().toISOString(),
        publishedBy: COMMITTEE_USER,
        slots: [...engine.slots.values()].map((s) => ({ ...s, sectionIds: [...s.sectionIds] })),
        summary: counts,
        override: override || undefined,
      };
      const summary = `${counts.critical} critical, ${counts.warning} warnings, ${counts.advisory} advisory`;
      set({
        snapshots: [...st.snapshots, snap].slice(-MAX_SNAPSHOTS),
        dirty: false,
        ...pushAudit(
          auditEntry(override ? 'Published master (admin override)' : 'Published master timetable', `Snapshot v${snap.version}`, `v${last?.version ?? 0}`, override ? `${summary}. Reason: ${override}` : summary),
        ),
      });
      return snap;
    },

    setBuilderWeek(week) {
      set({ builderWeek: week, ...refreshLeave(get().leaves, week) });
    },

    submitLeave(input) {
      const st = get();
      const f = st.faculty[input.facultyId];
      const now = new Date().toISOString();
      const leave: LeaveRequest = { id: uid('lv'), ...input, status: 'Pending', submittedAt: now };
      const mails: MockMail[] = APPROVERS.map((a) => ({
        id: uid('ml'),
        at: now,
        kind: 'leave-request' as const,
        leaveId: leave.id,
        from: 'timetable@cms.example',
        to: a.email,
        toName: a.name,
        subject: `Leave request: ${f.name} (${input.type})`,
      }));
      mails.push({ id: uid('ml'), at: now, kind: 'leave-receipt', leaveId: leave.id, from: 'timetable@cms.example', to: f.email, toName: f.name, subject: 'We received your leave request' });
      set({
        leaves: [leave, ...st.leaves],
        mails: [...mails, ...st.mails],
        ...pushAudit(auditEntry('Leave submitted', `${f.name} · ${input.type}`, undefined, `${fmtDate(input.from, 'd MMM')}–${fmtDate(input.to, 'd MMM')}`, f.name)),
      });
      return leave;
    },

    decideLeave(id, status, by, remark, via) {
      const st = get();
      const prev = st.leaves.find((l) => l.id === id);
      if (!prev || prev.status !== 'Pending') return;
      const next: LeaveRequest = { ...prev, status, decidedAt: new Date().toISOString(), decidedBy: by, remark: remark || undefined };
      const leaves = st.leaves.map((l) => (l.id === id ? next : l));
      const f = st.faculty[prev.facultyId];
      const mail: MockMail = {
        id: uid('ml'),
        at: next.decidedAt!,
        kind: status === 'Approved' ? 'leave-approved' : 'leave-rejected',
        leaveId: id,
        from: 'timetable@cms.example',
        to: f.email,
        toName: f.name,
        subject: `Your leave request was ${status.toLowerCase()}`,
      };
      set({
        leaves,
        mails: [mail, ...st.mails],
        ...refreshLeave(leaves),
        ...pushAudit(auditEntry(`Leave ${status.toLowerCase()}${via === 'email' ? ' (via email)' : ''}`, `${f.name} · ${prev.type}`, 'Pending', remark ? `${status}: ${remark}` : status, by)),
      });
    },

    addChange(input, opts) {
      const st = get();
      const c: DailyChange = { ...input, id: uid('dc'), createdAt: new Date().toISOString(), createdBy: opts?.by ?? COMMITTEE_USER, status: 'draft' };
      const changes = [...st.changes, c];
      const entity = describeChange(c, get());
      set({ changes, ...refreshLeave(st.leaves, st.builderWeek, changes), ...pushAudit(auditEntry(`Drafted ${CHANGE_LABEL[c.type].toLowerCase()}`, entity, undefined, c.scope === 'master' ? 'Also updates master' : 'This date only', opts?.by)) });
      if (c.scope === 'master') applyToMaster(c);
      return c;
    },

    removeChange(id) {
      const st = get();
      const c = st.changes.find((x) => x.id === id);
      if (!c || c.status !== 'draft') return;
      const changes = st.changes.filter((x) => x.id !== id);
      set({ changes, ...refreshLeave(st.leaves, st.builderWeek, changes), ...pushAudit(auditEntry('Discarded draft change', describeChange(c, st))) });
    },

    publishDay(date, by = COMMITTEE_USER) {
      const st = get();
      const drafts = st.changes.filter((c) => c.date === date && c.status === 'draft');
      if (!drafts.length) return null;
      const pub: DailyPublication = { id: uid('pub'), date, publishedAt: new Date().toISOString(), publishedBy: by, changeIds: drafts.map((c) => c.id) };
      const ids = new Set(pub.changeIds);
      set({
        changes: st.changes.map((c) => (ids.has(c.id) ? { ...c, status: 'published', publicationId: pub.id } : c)),
        publications: [...st.publications, pub],
        ...pushAudit(auditEntry('Published daily timetable', fmtDate(date), undefined, `${drafts.length} change(s)`, by)),
      });
      return pub;
    },

    undoLastPublish(date) {
      const st = get();
      const pubs = st.publications.filter((p) => p.date === date);
      const last = pubs[pubs.length - 1];
      if (!last) return null;
      const ids = new Set(last.changeIds);
      set({
        changes: st.changes.map((c) => (ids.has(c.id) ? { ...c, status: 'draft', publicationId: undefined } : c)),
        publications: st.publications.filter((p) => p.id !== last.id),
        ...pushAudit(auditEntry('Undid daily publish', fmtDate(date), `${last.changeIds.length} change(s) live`, 'Moved back to draft')),
      });
      return last;
    },

    assignAndPublish(date, items, reason) {
      const st = get();
      if (!items.length) return 0;
      const now = new Date().toISOString();
      const pub: DailyPublication = { id: uid('pub'), date, publishedAt: now, publishedBy: COMMITTEE_USER, changeIds: [] };
      const created: DailyChange[] = items.map((it) => ({
        id: uid('dc'),
        date,
        type: 'substitution',
        status: 'published',
        scope: 'date',
        slotId: it.slotId,
        facultyId: it.facultyId,
        reason,
        createdAt: now,
        createdBy: COMMITTEE_USER,
        publicationId: pub.id,
      }));
      pub.changeIds = created.map((c) => c.id);
      const changes = [...st.changes, ...created];
      set({
        changes,
        publications: [...st.publications, pub],
        ...refreshLeave(st.leaves, st.builderWeek, changes),
        ...pushAudit(auditEntry('Assigned substitutes and published', fmtDate(date), undefined, `${created.length} substitution(s). ${reason}`)),
      });
      return created.length;
    },

    bookRoom(b) {
      const st = get();
      const room = st.rooms[b.roomId];
      if (!room) return { ok: false, error: 'Unknown room.' };
      if (!room.bookable) return { ok: false, error: `${room.name} cannot be booked here.` };
      const day = dayIndexOf(b.date);
      if (day === null) return { ok: false, error: 'The campus is closed on Sundays.' };
      if (b.date < st.today) return { ok: false, error: 'Choose today or a future date.' };
      const busyClass = slotsOnDate(b.date).some((e) => e.status !== 'cancelled' && e.roomId === b.roomId && e.period === b.period);
      if (busyClass) return { ok: false, error: `${room.name} has a class in P${b.period} on that day.` };
      const clash = st.bookings.find((x) => x.roomId === b.roomId && x.date === b.date && x.period === b.period);
      if (clash) return { ok: false, error: `${room.name} is already booked for "${clash.purpose}".` };
      const booking: RoomBooking = { ...b, id: uid('bk'), createdAt: new Date().toISOString() };
      set({ bookings: [...st.bookings, booking], ...pushAudit(auditEntry('Booked room', `${room.name} · ${fmtDate(b.date, 'd MMM')} P${b.period}`, undefined, b.purpose, b.bookedBy)) });
      return { ok: true, booking };
    },

    cancelBooking(id) {
      const st = get();
      const b = st.bookings.find((x) => x.id === id);
      if (!b) return;
      set({ bookings: st.bookings.filter((x) => x.id !== id), ...pushAudit(auditEntry('Cancelled booking', `${st.rooms[b.roomId]?.name} · ${fmtDate(b.date, 'd MMM')} P${b.period}`, b.purpose)) });
    },

    addMemory(m) {
      const mem: Memory = { ...m, id: uid('mem'), createdAt: new Date().toISOString() };
      set({ memories: [mem, ...get().memories], ...pushAudit(auditEntry('Saved assistant memory', mem.text, undefined, mem.kind === 'standing' ? 'Standing' : `Until ${mem.expires}`)) });
      return mem;
    },

    removeMemory(id) {
      const m = get().memories.find((x) => x.id === id);
      set({ memories: get().memories.filter((x) => x.id !== id), ...(m ? pushAudit(auditEntry('Removed assistant memory', m.text)) : {}) });
    },

    pushChat(m) {
      const msg: ChatMessage = { ...m, id: uid('msg'), at: new Date().toISOString() };
      set({ chat: [...get().chat, msg].slice(-80) });
      return msg;
    },

    updateChatCard(id, card) {
      set({ chat: get().chat.map((m) => (m.id === id ? { ...m, card } : m)) });
    },

    clearChat() {
      set({ chat: [] });
    },

    logAction(action, entity, before, after, user) {
      set(pushAudit(auditEntry(action, entity, before, after, user)));
    },

    requestTermDeletion() {
      const st = get();
      const td: TermDeletion = { term: st.term.name, requestedAt: new Date().toISOString(), purgeOn: addDaysISO(st.today, 30) };
      set({ termDeletion: td, ...pushAudit(auditEntry('Scheduled term deletion', st.term.name, undefined, `Purge on ${fmtDate(td.purgeOn)} (30-day grace)`)) });
    },

    cancelTermDeletion() {
      const st = get();
      if (!st.termDeletion) return;
      set({ termDeletion: null, ...pushAudit(auditEntry('Cancelled term deletion', st.term.name)) });
    },

    exportBackup() {
      const st = get();
      return JSON.stringify(
        {
          app: 'CMS Timetable Platform (demo)',
          exportedAt: new Date().toISOString(),
          term: st.term,
          ...toPersisted(st),
          reference: { faculty: st.facultyList, subjects: st.subjectList, rooms: st.roomList, sections: st.sectionList },
        },
        null,
        2,
      );
    },

    resetDemo() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      seed = generateSeed(today);
      refs = refsOf(seed);
      const fresh = freshPersisted();
      set({ ...baseState(fresh), refreshedFromSeed: false, audit: [auditEntry('Reset demo data', 'All modules', undefined, 'Seed restored')] });
    },
  };
});

export function describeChange(c: DailyChange, st: Pick<DataState, 'snapshots' | 'subjects' | 'sections' | 'faculty' | 'rooms'>): string {
  const snap = st.snapshots[st.snapshots.length - 1];
  const slot = c.slotId ? snap.slots.find((s) => s.id === c.slotId) : undefined;
  const secs = (slot?.sectionIds ?? c.sectionIds ?? []).map((id) => st.sections[id]).filter(Boolean);
  const who = secs.length ? `${secs[0].program}${secs[0].semester}${secs.map((s) => s.name).join('+')}` : '';
  const subId = slot?.subjectId ?? c.subjectId;
  const what = slot?.label ?? (subId ? st.subjects[subId]?.code : c.label ?? 'Session');
  const period = slot?.period ?? c.period;
  return `${CHANGE_LABEL[c.type]} · ${what} ${who} · ${fmtDate(c.date, 'd MMM')}${period ? ` P${period}` : ''}`;
}

/* ------------------------------------------------------------------ */
/* Persistence: debounced, idle-time, try/catch                         */
/* ------------------------------------------------------------------ */

function toPersisted(st: DataState): Persisted {
  return {
    v: SEED_VERSION,
    seedDate: st.today,
    slots: Object.values(st.slots),
    snapshots: st.snapshots,
    leaves: st.leaves,
    changes: st.changes,
    publications: st.publications,
    bookings: st.bookings,
    audit: st.audit,
    memories: st.memories,
    mails: st.mails,
    chat: st.chat,
    termDeletion: st.termDeletion,
    builderWeek: st.builderWeek,
  };
}

const PERSIST_KEYS: (keyof DataState)[] = [
  'slots',
  'snapshots',
  'leaves',
  'changes',
  'publications',
  'bookings',
  'audit',
  'memories',
  'mails',
  'chat',
  'termDeletion',
  'builderWeek',
];

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let unsaved = false;

function writeNow(): void {
  if (!unsaved) return;
  unsaved = false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersisted(useData.getState())));
  } catch {
    /* quota exceeded or storage blocked: keep working in memory */
  }
}

useData.subscribe((state, prev) => {
  if (!PERSIST_KEYS.some((k) => state[k] !== prev[k])) return;
  unsaved = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    idle(writeNow);
  }, 400);
});

// Never lose the last edit: save immediately when the tab is hidden, reloaded or closed.
window.addEventListener('pagehide', writeNow);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') writeNow();
});

/* ------------------------------------------------------------------ */
/* Derived helpers (pure, used by several pages)                        */
/* ------------------------------------------------------------------ */

export function latestSnapshot(st: Pick<DataState, 'snapshots'>): Snapshot {
  return st.snapshots[st.snapshots.length - 1];
}

/** Resolved timetable for a date. Students and faculty read published changes only. */
export function dayEntries(st: Pick<DataState, 'snapshots' | 'changes'>, date: string, includeDrafts: boolean): DayEntry[] {
  const day = dayIndexOf(date);
  if (day === null) return [];
  const changes = st.changes.filter((c) => c.date === date && (includeDrafts || c.status === 'published'));
  return resolveDay(latestSnapshot(st).slots, day, changes);
}

/** A clash engine loaded with one date's live timetable and that date's approved leave. */
export function dayEngine(st: DataState, date: string, includeDrafts = true): { engine: ClashEngine; entries: DayEntry[] } {
  const entries = dayEntries(st, date, includeDrafts);
  const covered = new Set<string>();
  for (const c of st.changes) if (c.date === date && (c.type === 'substitution' || c.type === 'cancellation') && c.slotId) covered.add(c.slotId);
  const e = new ClashEngine(refs, (fid, _day, period, slotId) => {
    if (covered.has(slotId)) return null;
    const l = st.leaves.find((x) => x.status === 'Approved' && x.facultyId === fid && leaveCovers(x, date, period));
    return l ? { leaveId: l.id, type: l.type, date: fmtDate(date, 'd MMM') } : null;
  });
  e.load(entriesToSlots(entries));
  return { engine: e, entries };
}

export function engineRefs(): EngineRefs {
  return refs;
}

/** Weekly assigned hours per faculty from the published snapshot. */
export function weeklyLoads(st: Pick<DataState, 'snapshots'>): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of latestSnapshot(st).slots) if (s.facultyId) m.set(s.facultyId, (m.get(s.facultyId) ?? 0) + 1);
  return m;
}

let history: AuditEntry[] | null = null;

/** Seeded committee history (deterministic, generated once on first use, never stored). */
export function auditHistory(): AuditEntry[] {
  history ??= generateAuditHistory(today, { faculty: seed.faculty, rooms: seed.rooms, sections: seed.sections, subjects: seed.subjects });
  return history;
}

/** Stable reference maps for display helpers (shallow-compared, so no re-render churn). */
export function useLookup() {
  return useData(useShallow((s) => ({ subjects: s.subjects, faculty: s.faculty, rooms: s.rooms, sections: s.sections })));
}

export function sectionName(s: Section | undefined): string {
  return s ? `${s.program} Sem ${s.semester} · ${s.name}` : '—';
}

export function sectionShort(st: Pick<DataState, 'sections'>, ids: readonly string[]): string {
  const secs = ids.map((id) => st.sections[id]).filter(Boolean);
  if (!secs.length) return '—';
  if (secs.length === 1) return `${secs[0].program} ${secs[0].semester}${secs[0].name}`;
  const sameCohort = secs.every((s) => s.program === secs[0].program && s.semester === secs[0].semester);
  if (sameCohort) return `${secs[0].program} ${secs[0].semester}${secs.map((s) => s.name).join('+')}`;
  return `${secs.length} sections`;
}
