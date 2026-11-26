import { Lightbulb, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { SEVERITY_META } from '../../../components/ui/severity';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Field, Select } from '../../../components/ui/Field';
import { slotText } from '../../../components/timetable/slotDisplay';
import { DAYS, periodInfo } from '../../../domain/constants';
import { cn } from '../../../lib/util';
import { engine, sectionShort, useData, useLookup } from '../../../store/data';
import { toast } from '../../../store/toast';
import { reportSlot, useBuilderUi } from './builderUi';
import { Suggestions } from './Suggestions';

export function SlotEditor() {
  const id = useBuilderUi((s) => s.editSlotId);
  const set = useBuilderUi((s) => s.set);
  const slot = useData((s) => (id ? s.slots[id] : undefined));
  const open = !!id && !!slot;
  return (
    <Dialog
      open={open}
      onClose={() => set({ editSlotId: null })}
      size="lg"
      title={slot ? <EditorTitle id={slot.id} /> : ''}
      description={slot ? `${DAYS[slot.day]}, Period ${slot.period} (${periodInfo(slot.period).start}–${periodInfo(slot.period).end}). Changes save to the draft instantly and are re-checked live.` : undefined}
      footer={slot ? <EditorFooter id={slot.id} /> : undefined}
    >
      {slot && <EditorBody id={slot.id} />}
    </Dialog>
  );
}

function EditorTitle({ id }: { id: string }) {
  const slot = useData((s) => s.slots[id]);
  const lookup = useLookup();
  if (!slot) return null;
  const t = slotText(slot, lookup);
  return (
    <span>
      {t.code} · {t.title} <span className="font-normal text-muted">· {sectionShort(lookup, slot.sectionIds)}</span>
    </span>
  );
}

function EditorFooter({ id }: { id: string }) {
  const removeSlot = useData((s) => s.removeSlot);
  const set = useBuilderUi((s) => s.set);
  return (
    <>
      <Button
        variant="ghost"
        className="mr-auto text-critical hover:bg-critical-soft hover:text-critical"
        icon={<Trash2 />}
        onClick={() => {
          removeSlot(id);
          set({ editSlotId: null });
          toast.info('Class removed from the draft', 'The cell is free again. Hours return to the subject panel.');
        }}
      >
        Remove
      </Button>
      <Button variant="primary" onClick={() => set({ editSlotId: null })}>
        Done
      </Button>
    </>
  );
}

function EditorBody({ id }: { id: string }) {
  const slot = useData((s) => s.slots[id]);
  const clashes = useData((s) => s.slotClashes[id]);
  const facultyList = useData((s) => s.facultyList);
  const roomList = useData((s) => s.roomList);
  const subjects = useData((s) => s.subjects);
  const sections = useData((s) => s.sections);
  const sectionList = useData((s) => s.sectionList);
  const slots = useData((s) => s.slots);
  const updateSlot = useData((s) => s.updateSlot);
  const subject = slot?.subjectId ? subjects[slot.subjectId] : undefined;

  const facultyOptions = useMemo(() => {
    const area = subject?.area;
    const same = facultyList.filter((f) => f.area === area);
    const rest = facultyList.filter((f) => f.area !== area);
    return { same, rest };
  }, [facultyList, subject]);

  const groupSlots = useMemo(() => (slot?.group ? Object.values(slots).filter((s) => s.group === slot.group) : []), [slots, slot?.group]);

  if (!slot) return null;
  const strength = engine.strengthOf(slot);
  const cohort = sectionList.filter((s) => {
    const first = sections[slot.sectionIds[0]];
    return first && s.program === first.program && s.semester === first.semester;
  });

  const change = (patch: Parameters<typeof updateSlot>[1], verb: string) => {
    updateSlot(id, patch);
    reportSlot(id, verb);
  };

  return (
    <div className="space-y-5">
      {clashes && clashes.length > 0 ? (
        <ul className="space-y-2">
          {clashes.map((c) => {
            const m = SEVERITY_META[c.severity];
            return (
              <li
                key={c.id}
                className={cn(
                  'flex gap-2.5 rounded-xl border px-3 py-2.5',
                  c.severity === 'critical' ? 'border-critical-line bg-critical-soft' : c.severity === 'warning' ? 'border-warning-line bg-warning-soft' : 'border-advisory-line bg-advisory-soft',
                )}
              >
                <m.Icon className={cn('mt-0.5 size-4 shrink-0', c.severity === 'critical' ? 'text-critical' : c.severity === 'warning' ? 'text-warning-icon' : 'text-advisory')} aria-hidden />
                <div>
                  <p className={cn('text-[13px] font-semibold', c.severity === 'critical' ? 'text-critical' : c.severity === 'warning' ? 'text-warning' : 'text-advisory')}>
                    {m.label}: {c.title}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-ink-2">{engine.describeFor(c, id)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-success-line bg-success-soft px-3 py-2.5 text-[13px] font-medium text-success">No clashes for this class.</p>
      )}

      {slot.group && (
        <div className="rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-[12.5px] text-ink-2">
          <p className="font-semibold text-ink">
            {slot.kind} block · {groupSlots.length} offerings run in parallel
          </p>
          <p className="mt-0.5">Students pick one. Each offering below has its own faculty and room; this dialog edits {subject?.code}.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {groupSlots.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => useBuilderUi.getState().set({ editSlotId: g.id })}
                className={cn('h-7 rounded-lg border px-2 text-[12px] font-medium', g.id === id ? 'border-primary-ink bg-primary-soft text-primary-ink' : 'border-line bg-surface hover:border-line-strong')}
              >
                {subjects[g.subjectId ?? '']?.code}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Faculty" hint={subject ? `${subject.area}` : undefined}>
          {(p) => (
            <Select {...p} value={slot.facultyId ?? ''} onChange={(e) => change({ facultyId: e.target.value || undefined }, 'Faculty updated')}>
              <option value="">No faculty</option>
              {facultyOptions.same.length > 0 && (
                <optgroup label={`${subject?.area} (same area)`}>
                  {facultyOptions.same.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.type === 'External' ? ` (visiting, P${f.window[0]}–P${f.window[1]})` : ''} · {engine.facultyLoad(f.id)} h
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Other faculty">
                {facultyOptions.rest.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.area}
                  </option>
                ))}
              </optgroup>
            </Select>
          )}
        </Field>
        <Field label="Room" hint={`${strength} students`}>
          {(p) => (
            <Select {...p} value={slot.roomId ?? ''} onChange={(e) => change({ roomId: e.target.value || undefined }, 'Room updated')}>
              <option value="">No room</option>
              {roomList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.capacity} seats{r.capacity < strength ? ' (too small)' : ''}
                  {!engine.isRoomFree(r.id, slot.day, slot.period, slot.id) ? ' · busy' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {(slot.kind === 'Regular' || slot.kind === 'Combined') && cohort.length > 1 && (
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Sections attending (combine classes)</legend>
          <div className="flex flex-wrap gap-2">
            {cohort.map((s) => {
              const on = slot.sectionIds.includes(s.id);
              return (
                <label key={s.id} className={cn('inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-[12.5px] font-medium', on ? 'border-primary-ink bg-primary-soft text-primary-ink' : 'border-line text-ink-2')}>
                  <input
                    type="checkbox"
                    className="accent-[var(--primary)]"
                    checked={on}
                    disabled={on && slot.sectionIds.length === 1}
                    onChange={() => {
                      const next = on ? slot.sectionIds.filter((x) => x !== s.id) : [...slot.sectionIds, s.id];
                      change({ sectionIds: next, kind: next.length > 1 ? 'Combined' : 'Regular' }, next.length > 1 ? 'Combined class updated' : 'Class updated');
                    }}
                  />
                  Section {s.name} · {s.strength}
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 text-[12px] text-muted">A combined class is one slot for several sections: it is never flagged as a section double-booking. Capacity uses the combined strength.</p>
        </fieldset>
      )}

      {clashes && clashes.length > 0 && (
        <div className="rounded-xl border border-line p-3.5">
          <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <Lightbulb className="size-4 text-accent" aria-hidden /> Suggestions
          </p>
          <Suggestions slotId={id} />
        </div>
      )}
    </div>
  );
}
