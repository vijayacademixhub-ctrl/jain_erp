import type { ChangeType, DailyChange, DayIndex, Period, Slot, SlotKind } from './types';

export type EntryStatus = 'normal' | 'changed' | 'cancelled' | 'added';

export interface DayEntry {
  key: string;
  slotId?: string;
  day: DayIndex;
  sectionIds: string[];
  period: Period;
  kind: SlotKind;
  subjectId?: string;
  facultyId?: string;
  roomId?: string;
  label?: string;
  group?: string;
  status: EntryStatus;
  changeTypes: ChangeType[];
  changeIds: string[];
  draft: boolean;
  previous?: { period?: Period; facultyId?: string; roomId?: string };
  reason?: string;
}

const ORDER: Record<ChangeType, number> = {
  swap: 0,
  substitution: 1,
  'room-change': 2,
  cancellation: 3,
  'extra-class': 4,
  workshop: 5,
};

/**
 * Builds the timetable for one date: the published weekly master for that weekday,
 * with the date's daily changes applied on top.
 */
export function resolveDay(base: readonly Slot[], day: DayIndex, changes: readonly DailyChange[]): DayEntry[] {
  const entries = new Map<string, DayEntry>();
  for (const s of base) {
    if (s.day !== day) continue;
    entries.set(s.id, {
      key: s.id,
      slotId: s.id,
      day,
      sectionIds: s.sectionIds,
      period: s.period,
      kind: s.kind,
      subjectId: s.subjectId,
      facultyId: s.facultyId,
      roomId: s.roomId,
      label: s.label,
      group: s.group,
      status: 'normal',
      changeTypes: [],
      changeIds: [],
      draft: false,
    });
  }

  const sorted = [...changes].sort((a, b) => ORDER[a.type] - ORDER[b.type] || a.createdAt.localeCompare(b.createdAt));
  const mark = (e: DayEntry, c: DailyChange) => {
    if (e.status === 'normal') e.status = 'changed';
    e.changeTypes = [...e.changeTypes, c.type];
    e.changeIds = [...e.changeIds, c.id];
    e.draft = e.draft || c.status === 'draft';
    e.reason = c.reason ?? e.reason;
  };

  for (const c of sorted) {
    if (c.type === 'extra-class' || c.type === 'workshop') {
      if (!c.period || !c.sectionIds?.length) continue;
      entries.set(`x-${c.id}`, {
        key: `x-${c.id}`,
        day,
        sectionIds: c.sectionIds,
        period: c.period,
        kind: c.type === 'workshop' ? 'Fixed' : 'Regular',
        subjectId: c.subjectId,
        facultyId: c.facultyId,
        roomId: c.roomId,
        label: c.type === 'workshop' ? (c.label ?? 'Workshop') : undefined,
        status: 'added',
        changeTypes: [c.type],
        changeIds: [c.id],
        draft: c.status === 'draft',
        reason: c.reason,
      });
      continue;
    }
    const e = c.slotId ? entries.get(c.slotId) : undefined;
    if (!e) continue;
    if (c.type === 'swap') {
      const other = c.swapWithSlotId ? entries.get(c.swapWithSlotId) : undefined;
      if (!other) continue;
      const p = e.period;
      e.previous = { ...e.previous, period: e.period };
      other.previous = { ...other.previous, period: other.period };
      e.period = other.period;
      other.period = p;
      mark(e, c);
      mark(other, c);
    } else if (c.type === 'substitution') {
      e.previous = { ...e.previous, facultyId: e.previous?.facultyId ?? e.facultyId };
      e.facultyId = c.facultyId;
      mark(e, c);
    } else if (c.type === 'room-change') {
      e.previous = { ...e.previous, roomId: e.previous?.roomId ?? e.roomId };
      e.roomId = c.roomId;
      mark(e, c);
    } else if (c.type === 'cancellation') {
      mark(e, c);
      e.status = 'cancelled';
    }
  }

  return [...entries.values()].sort((a, b) => a.period - b.period || a.key.localeCompare(b.key));
}

/** Converts live (non-cancelled) entries back to slots so the clash engine can check a single date. */
export function entriesToSlots(entries: readonly DayEntry[]): Slot[] {
  return entries
    .filter((e) => e.status !== 'cancelled')
    .map((e) => ({
      id: e.key,
      day: e.day,
      period: e.period,
      sectionIds: e.sectionIds,
      kind: e.kind,
      subjectId: e.subjectId,
      facultyId: e.facultyId,
      roomId: e.roomId,
      label: e.label as Slot['label'],
      group: e.group,
    }));
}

export const CHANGE_LABEL: Record<ChangeType, string> = {
  swap: 'Swap',
  substitution: 'Substitution',
  'room-change': 'Room change',
  cancellation: 'Cancellation',
  'extra-class': 'Extra class',
  workshop: 'Workshop',
};
