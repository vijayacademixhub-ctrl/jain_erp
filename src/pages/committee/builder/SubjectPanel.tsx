import { CheckCircle2, GripVertical, Hand } from 'lucide-react';
import { memo, useMemo } from 'react';
import { FIXED_LABEL_NAMES } from '../../../domain/constants';
import type { FixedLabel } from '../../../domain/types';
import { cn } from '../../../lib/util';
import { useData } from '../../../store/data';
import { beginDrag, useBuilderUi, type DragPayload } from './builderUi';

const FIXED_PALETTE: FixedLabel[] = ['CT/Orientation', 'LIB', 'C2C', 'Training', 'Workshop', 'AI Toolkit', 'Rock Your Profile', 'Unit Test'];

function samePayload(a: DragPayload | null, b: DragPayload): boolean {
  if (!a || a.type !== b.type) return false;
  if (a.type === 'subject' && b.type === 'subject') return a.subjectId === b.subjectId;
  if (a.type === 'fixed' && b.type === 'fixed') return a.label === b.label;
  return false;
}

export const SubjectPanel = memo(function SubjectPanel({ sectionId }: { sectionId: string }) {
  const section = useData((s) => s.sections[sectionId]);
  const subjectList = useData((s) => s.subjectList);
  const assignments = useData((s) => s.assignments);
  const faculty = useData((s) => s.faculty);
  const slots = useData((s) => s.slots);
  const armed = useBuilderUi((s) => s.armed);

  const rows = useMemo(() => {
    const placed = new Map<string, number>();
    for (const sl of Object.values(slots)) {
      if (sl.subjectId && sl.sectionIds.includes(sectionId) && (sl.kind === 'Regular' || sl.kind === 'Combined')) {
        placed.set(sl.subjectId, (placed.get(sl.subjectId) ?? 0) + 1);
      }
    }
    return subjectList
      .filter((s) => s.program === section.program && s.semester === section.semester && s.kind === 'Core')
      .map((s) => ({ s, placed: placed.get(s.id) ?? 0, fac: faculty[assignments[sectionId]?.[s.id] ?? ''] }));
  }, [slots, subjectList, section, sectionId, assignments, faculty]);

  const remaining = rows.reduce((n, r) => n + Math.max(0, r.s.weeklyHours - r.placed), 0);

  const arm = (p: DragPayload) => {
    const ui = useBuilderUi.getState();
    if (samePayload(ui.armed, p)) ui.set({ armed: null, announce: 'Selection cleared.' });
    else ui.set({ armed: p, announce: `${p.type === 'fixed' ? p.label : p.label} selected. Choose a cell and press Enter to place it.` });
  };

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-1">
      <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
        <h2 className="text-[13.5px] font-semibold text-ink">Subjects</h2>
        <span className={cn('text-xs', remaining ? 'font-medium text-accent-ink' : 'text-success')}>{remaining ? `${remaining} h to place` : 'All placed'}</span>
      </div>
      <p className="flex items-center gap-1.5 px-4 pb-2 text-[11.5px] text-muted">
        <Hand className="size-3.5" aria-hidden /> Drag onto the grid, or tap then tap a cell.
      </p>
      <ul className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
        {rows.map(({ s, placed, fac }) => {
          const need = s.weeklyHours;
          const done = placed >= need;
          const payload: DragPayload = { type: 'subject', subjectId: s.id, label: s.name };
          const isArmed = samePayload(armed, payload);
          return (
            <li key={s.id} className="w-[220px] shrink-0 lg:w-auto">
              <button
                type="button"
                aria-pressed={isArmed}
                onPointerDown={(e) => beginDrag(e, payload, `${s.code} · ${s.name}`)}
                onClick={() => arm(payload)}
                className={cn(
                  'group flex w-full cursor-grab items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition-[border-color,box-shadow,background-color] duration-150 hover:border-line-strong hover:shadow-1 active:cursor-grabbing',
                  isArmed ? 'border-primary-ink bg-primary-soft ring-2 ring-[color-mix(in_srgb,var(--primary-ink)_25%,transparent)]' : 'border-line bg-surface',
                )}
              >
                <GripVertical className="mt-0.5 size-4 shrink-0 text-muted opacity-60 group-hover:opacity-100" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[12.5px] font-semibold text-ink">{s.code}</span>
                    {s.needsLab && <span className="rounded bg-surface-3 px-1 text-[10px] font-medium text-muted">Lab</span>}
                    <span className={cn('tabular ml-auto text-[11.5px] font-semibold', done ? 'text-success' : 'text-accent-ink')}>
                      {placed}/{need} h
                    </span>
                  </span>
                  <span className="block truncate text-[12px] text-ink-2">{s.name}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="block h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <span
                        className={cn('block h-full origin-left rounded-full transition-transform duration-300', done ? 'bg-success' : 'bg-accent')}
                        style={{ transform: `scaleX(${Math.min(1, placed / need)})` }}
                      />
                    </span>
                    {done && <CheckCircle2 className="size-3.5 text-success" aria-label="All hours placed" />}
                  </span>
                  <span className={cn('mt-1 block truncate text-[11px]', fac?.type === 'External' ? 'text-accent-ink' : 'text-muted')}>
                    {fac ? `${fac.name}${fac.type === 'External' ? ' · visiting' : ''}` : 'Faculty to be assigned'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line px-4 pt-3 pb-3.5">
        <h3 className="mb-2 text-[12px] font-semibold tracking-[0.04em] text-muted uppercase">Fixed blocks</h3>
        <div className="flex flex-wrap gap-1.5">
          {FIXED_PALETTE.map((label) => {
            const payload: DragPayload = { type: 'fixed', label };
            const isArmed = samePayload(armed, payload);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={isArmed}
                title={FIXED_LABEL_NAMES[label]}
                onPointerDown={(e) => beginDrag(e, payload, label)}
                onClick={() => arm(payload)}
                className={cn(
                  'hatch h-7 cursor-grab rounded-lg border px-2 text-[11.5px] font-medium transition-colors',
                  isArmed ? 'border-primary-ink bg-primary-soft text-primary-ink' : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
