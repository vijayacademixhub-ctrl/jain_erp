import { ArrowLeftRight, Ban, Building2, CalendarPlus, Presentation, ShieldCheck, UserRoundCog } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { SEVERITY_META } from '../../../components/ui/severity';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../../../components/ui/Field';
import { slotText } from '../../../components/timetable/slotDisplay';
import { periodInfo } from '../../../domain/constants';
import type { DayEntry } from '../../../domain/daily';
import { rankSubstitutes } from '../../../domain/substitutes';
import type { ChangeType, Clash, DayIndex, Period, Slot } from '../../../domain/types';
import { dayIndexOf, fmtDate } from '../../../lib/dates';
import { cn } from '../../../lib/util';
import { dayEngine, describeChange, sectionShort, useData, useLookup, weeklyLoads } from '../../../store/data';
import { toast } from '../../../store/toast';

export type ChangeTarget = { kind: 'entry'; entry: DayEntry } | { kind: 'empty'; sectionId: string; period: Period };

const TYPES: { id: ChangeType; label: string; Icon: typeof Ban; forEntry: boolean }[] = [
  { id: 'substitution', label: 'Substitution', Icon: UserRoundCog, forEntry: true },
  { id: 'room-change', label: 'Room change', Icon: Building2, forEntry: true },
  { id: 'swap', label: 'Swap periods', Icon: ArrowLeftRight, forEntry: true },
  { id: 'cancellation', label: 'Cancellation', Icon: Ban, forEntry: true },
  { id: 'extra-class', label: 'Extra class', Icon: CalendarPlus, forEntry: false },
  { id: 'workshop', label: 'Workshop', Icon: Presentation, forEntry: false },
];

function toSlot(e: DayEntry): Slot {
  return { id: e.key, day: e.day, period: e.period, sectionIds: e.sectionIds, kind: e.kind, subjectId: e.subjectId, facultyId: e.facultyId, roomId: e.roomId, label: e.label as Slot['label'], group: e.group };
}

export function ChangeDialog({ date, target, onClose }: { date: string; target: ChangeTarget | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      size="lg"
      title={target?.kind === 'entry' ? 'Change this class' : 'Add a session'}
      description={`${fmtDate(date)} · drafts stay private until you publish the day.`}
      icon={target?.kind === 'entry' ? <UserRoundCog /> : <CalendarPlus />}
    >
      {target && <ChangeForm key={target.kind === 'entry' ? target.entry.key : `${target.sectionId}-${target.period}`} date={date} target={target} onDone={onClose} />}
    </Dialog>
  );
}

function ChangeForm({ date, target, onDone }: { date: string; target: ChangeTarget; onDone: () => void }) {
  const st = useData();
  const lookup = useLookup();
  const addChange = useData((s) => s.addChange);
  const isEntry = target.kind === 'entry';
  const entry = isEntry ? target.entry : null;
  const sectionId = isEntry ? target.entry.sectionIds[0] : target.sectionId;
  const period = isEntry ? target.entry.period : target.period;
  const section = lookup.sections[sectionId];

  const [type, setType] = useState<ChangeType>(isEntry ? 'substitution' : 'extra-class');
  const [scope, setScope] = useState<'date' | 'master'>('date');
  const [reason, setReason] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [roomId, setRoomId] = useState(isEntry ? (entry?.roomId ?? '') : (section?.homeRoomId ?? ''));
  const [swapWith, setSwapWith] = useState('');
  const subjectsForSection = st.subjectList.filter((s) => s.program === section?.program && s.semester === section?.semester && s.kind === 'Core');
  const [subjectId, setSubjectId] = useState(subjectsForSection[0]?.id ?? '');
  const [label, setLabel] = useState('Industry workshop');

  const ctx = useMemo(() => dayEngine(useData.getState(), date, true), [date]);
  const day = (dayIndexOf(date) ?? 0) as DayIndex;
  const loads = useMemo(() => weeklyLoads(useData.getState()), []);

  const ranked = useMemo(() => {
    if (!entry) return [];
    return rankSubstitutes({ dayEngine: ctx.engine, slot: toSlot(entry), date, faculty: st.facultyList, subjects: st.subjects, leaves: st.leaves, loads, limit: 6 });
  }, [ctx, entry, date, st.facultyList, st.subjects, st.leaves, loads]);

  const swapOptions = useMemo(
    () => (entry ? ctx.entries.filter((e) => e.key !== entry.key && e.status !== 'cancelled' && e.sectionIds.length === 1 && e.sectionIds[0] === sectionId && !e.group) : []),
    [ctx, entry, sectionId],
  );

  // Default the extra-class teacher to the section's assigned faculty.
  const assigned = st.assignments[sectionId]?.[subjectId] ?? '';
  const effectiveFaculty = type === 'substitution' ? facultyId || ranked[0]?.faculty.id || '' : type === 'extra-class' ? facultyId || assigned : facultyId;

  const probe = useMemo((): Clash[] | null => {
    const e = ctx.engine;
    if (type === 'cancellation') return [];
    if (type === 'substitution' && entry) return effectiveFaculty ? e.probe({ ...toSlot(entry), facultyId: effectiveFaculty }) : null;
    if (type === 'room-change' && entry) return roomId ? e.probe({ ...toSlot(entry), roomId }) : null;
    if (type === 'swap' && entry) {
      const other = swapOptions.find((o) => o.key === swapWith);
      if (!other) return null;
      const a = { ...toSlot(entry), period: other.period };
      const b = { ...toSlot(other), period: entry.period };
      e.upsert(a);
      const res = [...e.probe(b), ...e.clashesOf(a.id)];
      e.upsert(toSlot(entry));
      return res.filter((c) => c.type !== 'section-double' || !c.slotIds.every((id) => id === a.id || id === b.id));
    }
    if (type === 'extra-class' || type === 'workshop') {
      const slot: Slot = {
        id: '__new__',
        day,
        period,
        sectionIds: [sectionId],
        kind: type === 'workshop' ? 'Fixed' : 'Regular',
        subjectId: type === 'extra-class' ? subjectId : undefined,
        facultyId: effectiveFaculty || undefined,
        roomId: roomId || undefined,
        label: type === 'workshop' ? 'Workshop' : undefined,
      };
      return e.probe(slot);
    }
    return null;
  }, [ctx, type, entry, effectiveFaculty, roomId, swapWith, swapOptions, day, period, sectionId, subjectId]);

  const critical = probe?.some((c) => c.severity === 'critical') ?? false;
  const incomplete =
    (type === 'substitution' && !effectiveFaculty) || (type === 'room-change' && (!roomId || roomId === entry?.roomId)) || (type === 'swap' && !swapWith) || (type === 'extra-class' && !subjectId);

  const save = () => {
    const base = { date, type, scope, reason: reason.trim() || undefined };
    let c;
    if (type === 'substitution') c = addChange({ ...base, slotId: entry!.slotId, facultyId: effectiveFaculty });
    else if (type === 'room-change') c = addChange({ ...base, slotId: entry!.slotId, roomId });
    else if (type === 'swap') c = addChange({ ...base, slotId: entry!.slotId, swapWithSlotId: ctx.entries.find((x) => x.key === swapWith)?.slotId });
    else if (type === 'cancellation') c = addChange({ ...base, slotId: entry!.slotId });
    else c = addChange({ ...base, sectionIds: [sectionId], period, subjectId: type === 'extra-class' ? subjectId : undefined, facultyId: effectiveFaculty || undefined, roomId: roomId || undefined, label: type === 'workshop' ? label : undefined });
    toast.success('Saved as draft', `${describeChange(c, useData.getState())}${scope === 'master' ? '. Master draft updated as well.' : ''} Publish the day to make it live.`);
    onDone();
  };

  const t = entry ? slotText(entry, lookup) : null;
  const freeRooms = st.roomList.filter((r) => r.type !== 'Auditorium' && (ctx.engine.isRoomFree(r.id, day, period, entry?.key) || r.id === entry?.roomId));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-surface-2/60 px-3.5 py-3 text-[13px]">
        <p className="font-semibold text-ink">
          {sectionShort(lookup, isEntry ? entry!.sectionIds : [sectionId])} · Period {period} ({periodInfo(period).start}–{periodInfo(period).end})
        </p>
        <p className="mt-0.5 text-ink-2">{t ? `${t.code} · ${t.title} · ${t.faculty} · ${t.room}` : 'Free period: add an extra class or a workshop.'}</p>
      </div>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink-2">Change type</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TYPES.filter((x) => x.forEntry === isEntry).map(({ id, label: l, Icon }) => (
            <label
              key={id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors',
                type === id ? 'border-primary-ink bg-primary-soft text-primary-ink' : 'border-line text-ink-2 hover:border-line-strong',
              )}
            >
              <input type="radio" name="ctype" className="sr-only" checked={type === id} onChange={() => setType(id)} />
              <Icon className="size-4" aria-hidden />
              {l}
            </label>
          ))}
        </div>
      </fieldset>

      {type === 'substitution' && (
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-2">Ranked substitutes</p>
          {ranked.length === 0 ? (
            <p className="rounded-xl bg-surface-2 px-3 py-3 text-[13px] text-muted">No free faculty in this period. Try a swap or cancellation.</p>
          ) : (
            <div className="space-y-1.5">
              {ranked.map((r, i) => {
                const on = effectiveFaculty === r.faculty.id;
                return (
                  <label
                    key={r.faculty.id}
                    className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2', on ? 'border-primary-ink bg-primary-soft' : 'border-line hover:border-line-strong')}
                  >
                    <input type="radio" name="sub" className="accent-[var(--primary)]" checked={on} onChange={() => setFacultyId(r.faculty.id)} />
                    <span className="tabular grid size-6 place-items-center rounded-full bg-surface text-[11px] font-semibold text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-ink">{r.faculty.name}</span>
                      <span className="block text-[11.5px] text-muted">{r.reasons.join(' · ')}</span>
                    </span>
                    {i === 0 && r.sameArea && <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">Best fit</span>}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {(type === 'room-change' || type === 'extra-class' || type === 'workshop') && (
        <Field label={type === 'room-change' ? 'New room' : 'Room'} hint={`${freeRooms.length} free this period`}>
          {(p) => (
            <Select {...p} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Choose a room</option>
              {freeRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.capacity} seats{r.id === entry?.roomId ? ' (current)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      {type === 'swap' && (
        <Field label="Swap with" hint="Same section, same day">
          {(p) => (
            <Select {...p} value={swapWith} onChange={(e) => setSwapWith(e.target.value)}>
              <option value="">Choose a period</option>
              {swapOptions.map((o) => {
                const ot = slotText(o, lookup);
                return (
                  <option key={o.key} value={o.key}>
                    P{o.period} · {ot.code} · {ot.faculty}
                  </option>
                );
              })}
            </Select>
          )}
        </Field>
      )}

      {type === 'extra-class' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject">
            {(p) => (
              <Select
                {...p}
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setFacultyId('');
                }}
              >
                {subjectsForSection.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Faculty">
            {(p) => (
              <Select {...p} value={effectiveFaculty} onChange={(e) => setFacultyId(e.target.value)}>
                {st.facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.id === assigned ? ' (assigned)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      )}

      {type === 'workshop' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Workshop title">{(p) => <Input {...p} value={label} onChange={(e) => setLabel(e.target.value)} />}</Field>
          <Field label="Facilitator (optional)">
            {(p) => (
              <Select {...p} value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
                <option value="">External speaker</option>
                {st.facultyList
                  .filter((f) => f.area === 'Careers')
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </div>
      )}

      <Field label={type === 'cancellation' ? 'Reason (shown to students)' : 'Note (optional)'}>
        {(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === 'cancellation' ? 'e.g. Faculty on examination duty; compensated on Saturday.' : 'Shown on the change log.'} />}
      </Field>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink-2">Apply to</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['date', 'This date only', `Only ${fmtDate(date, 'EEE d MMM')} changes. The master stays as it is.`],
              ['master', 'Update master as well', 'Also edits the master draft, so every future week changes after you publish the master.'],
            ] as const
          ).map(([v, l, d]) => (
            <label key={v} className={cn('flex cursor-pointer gap-2.5 rounded-xl border px-3 py-2.5', scope === v ? 'border-primary-ink bg-primary-soft' : 'border-line hover:border-line-strong')}>
              <input type="radio" name="scope" className="mt-0.5 accent-[var(--primary)]" checked={scope === v} onChange={() => setScope(v)} />
              <span>
                <span className="block text-[13px] font-semibold text-ink">{l}</span>
                <span className="block text-[12px] text-muted">{d}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <ClashResult probe={probe} />

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={incomplete}>
          {critical ? 'Save draft anyway' : 'Save as draft'}
        </Button>
      </div>
    </div>
  );
}

function ClashResult({ probe }: { probe: Clash[] | null }): ReactNode {
  if (probe === null) return <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[12.5px] text-muted">Complete the form to run the clash check.</p>;
  const meaningful = probe.filter((c) => c.type !== 'consecutive' || probe.length === 1);
  if (meaningful.length === 0)
    return (
      <p className="flex items-center gap-2 rounded-xl border border-success-line bg-success-soft px-3 py-2.5 text-[13px] font-medium text-success">
        <ShieldCheck className="size-4" aria-hidden /> Clash check passed for this date.
      </p>
    );
  return (
    <ul className="space-y-1.5" aria-live="polite">
      {meaningful.map((c) => {
        const m = SEVERITY_META[c.severity];
        return (
          <li
            key={c.id}
            className={cn(
              'flex gap-2 rounded-xl border px-3 py-2 text-[12.5px]',
              c.severity === 'critical' ? 'border-critical-line bg-critical-soft text-critical' : c.severity === 'warning' ? 'border-warning-line bg-warning-soft text-warning' : 'border-advisory-line bg-advisory-soft text-advisory',
            )}
          >
            <m.Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">
                {m.label}: {c.title}.
              </span>{' '}
              {c.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
