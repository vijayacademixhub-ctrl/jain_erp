import { FIXED_LABEL_NAMES } from '../../domain/constants';
import type { Faculty, FixedLabel, Room, Section, SlotKind, Subject } from '../../domain/types';

export interface SlotLike {
  kind: SlotKind;
  sectionIds: readonly string[];
  subjectId?: string;
  facultyId?: string;
  roomId?: string;
  label?: string;
  group?: string;
}

export interface Lookup {
  subjects: Record<string, Subject>;
  faculty: Record<string, Faculty>;
  rooms: Record<string, Room>;
  sections: Record<string, Section>;
}

export interface SlotText {
  code: string;
  title: string;
  faculty: string;
  facultyShort: string;
  room: string;
  tag?: string;
  shortTag?: string;
  external: boolean;
}

export function slotText(s: SlotLike, l: Lookup): SlotText {
  const sub = s.subjectId ? l.subjects[s.subjectId] : undefined;
  const f = s.facultyId ? l.faculty[s.facultyId] : undefined;
  const r = s.roomId ? l.rooms[s.roomId] : undefined;
  let tag: string | undefined;
  let shortTag: string | undefined;
  if (s.kind === 'Combined') {
    shortTag = s.sectionIds.map((id) => l.sections[id]?.name).join('+');
    tag = `Combined ${shortTag}`;
  }
  if (s.kind === 'OE') [tag, shortTag] = ['Open elective', 'OE'];
  if (s.kind === 'ME') [tag, shortTag] = ['Minor elective', 'ME'];
  if (s.kind === 'Fixed' && s.sectionIds.length > 1) [tag, shortTag] = [`${s.sectionIds.length} sections`, `${s.sectionIds.length} sec`];
  const label = s.label as FixedLabel | undefined;
  return {
    code: label ? label : (sub?.code ?? '—'),
    title: label ? FIXED_LABEL_NAMES[label] ?? label : (sub?.name ?? 'Class'),
    faculty: f?.name ?? (label === 'LIB' ? 'Library' : label === 'Master Talk' ? 'Guest speaker' : label === 'Unit Test' ? 'Invigilation roster' : '—'),
    facultyShort: f?.short ?? '',
    room: r ? r.name.replace('Room ', '') : label === 'LIB' ? 'Library' : '—',
    tag,
    shortTag,
    external: f?.type === 'External',
  };
}

export const KIND_STYLE: Record<SlotKind, string> = {
  Regular: 'bg-surface border-line before:bg-primary-ink',
  Combined: 'bg-surface border-line before:bg-accent',
  OE: 'bg-accent-soft border-[color-mix(in_srgb,var(--accent)_28%,transparent)] before:bg-accent',
  ME: 'bg-accent-soft border-[color-mix(in_srgb,var(--accent)_28%,transparent)] before:bg-accent',
  Fixed: 'bg-surface-2 hatch border-line before:bg-muted',
  Test: 'bg-surface-2 hatch border-line before:bg-ink-2',
};

export const KIND_LEGEND: { kind: SlotKind; label: string }[] = [
  { kind: 'Regular', label: 'Class' },
  { kind: 'Combined', label: 'Combined' },
  { kind: 'OE', label: 'Elective (parallel)' },
  { kind: 'Fixed', label: 'Fixed block' },
  { kind: 'Test', label: 'Unit test' },
];
