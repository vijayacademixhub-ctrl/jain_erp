import { Plus } from 'lucide-react';
import { memo, useCallback, type KeyboardEvent } from 'react';
import { SEVERITY_META } from '../../../components/ui/severity';
import { KIND_STYLE, slotText } from '../../../components/timetable/slotDisplay';
import { KindIcon, LabIcon } from '../../../components/timetable/SlotIcons';
import { BREAK_AFTER, DAY_INDEXES, DAY_SHORT, DAYS, periodInfo } from '../../../domain/constants';
import type { DayIndex, Period } from '../../../domain/types';
import { addDaysISO, fmtShort } from '../../../lib/dates';
import { cn } from '../../../lib/util';
import { useData } from '../../../store/data';
import { beginDrag, dropOn, useBuilderUi } from './builderUi';

const EMPTY: readonly string[] = [];

export const BuilderGrid = memo(function BuilderGrid({
  sectionId,
  sectionLabel,
  periods,
  shiftPeriods,
  weekStart,
  today,
}: {
  sectionId: string;
  sectionLabel: string;
  periods: Period[];
  shiftPeriods: Period[];
  weekStart: string;
  today: string;
}) {
  const cols = `76px repeat(${periods.length}, minmax(132px, 1fr))`;

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
      if (!el) return;
      const [, d, p] = el.dataset.cell!.split('|').map(Number);
      let nd = d;
      let pi = periods.indexOf(p as Period);
      if (e.key === 'ArrowRight') pi = Math.min(periods.length - 1, pi + 1);
      else if (e.key === 'ArrowLeft') pi = Math.max(0, pi - 1);
      else if (e.key === 'ArrowDown') nd = Math.min(5, d + 1);
      else if (e.key === 'ArrowUp') nd = Math.max(0, d - 1);
      else return;
      e.preventDefault();
      const key = `${sectionId}|${nd}|${periods[pi]}`;
      document.querySelector<HTMLElement>(`[data-cell="${key}"]`)?.focus();
    },
    [periods, sectionId],
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-1">
      <div role="grid" aria-label={`Weekly timetable, ${sectionLabel}`} aria-rowcount={7} aria-colcount={periods.length + 1} onKeyDown={onKeyDown} className="min-w-[700px]">
        <div role="row" className="grid border-b border-line bg-grid-head" style={{ gridTemplateColumns: cols }}>
          <div role="columnheader" className="sticky left-0 z-10 bg-grid-head px-3 py-2.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
            Day
          </div>
          {periods.map((p) => {
            const info = periodInfo(p);
            const off = !shiftPeriods.includes(p);
            return (
              <div role="columnheader" key={p} className={cn('relative border-l border-line px-3 py-2', off && 'opacity-60')}>
                <span className="block text-[12.5px] font-semibold text-ink">
                  Period {p}
                  {off && <span className="ml-1.5 text-[10.5px] font-medium text-muted">off shift</span>}
                </span>
                <span className="tabular block text-[11px] text-muted">
                  {info.start}–{info.end}
                </span>
                {BREAK_AFTER[p] && (
                  <span className="absolute top-1 right-1.5 rounded bg-surface-3 px-1 text-[9.5px] font-medium tracking-wide text-muted uppercase" title={`${BREAK_AFTER[p]} after this period`}>
                    {BREAK_AFTER[p]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {DAY_INDEXES.map((d) => {
          const date = addDaysISO(weekStart, d);
          const isToday = date === today;
          return (
            <div role="row" key={d} className="grid border-b border-line last:border-b-0" style={{ gridTemplateColumns: cols }}>
              <div role="rowheader" aria-label={`${DAYS[d]} ${fmtShort(date)}`} className={cn('sticky left-0 z-10 flex flex-col justify-center bg-surface px-3', isToday && 'bg-primary-soft')}>
                <span className={cn('text-[13px] font-semibold', isToday ? 'text-primary-ink' : 'text-ink')}>{DAY_SHORT[d]}</span>
                <span className="tabular text-[11px] text-muted">{isToday ? 'Today' : fmtShort(date)}</span>
              </div>
              {periods.map((p) => (
                <Cell key={p} sectionId={sectionId} day={d} period={p} inShift={shiftPeriods.includes(p)} first={d === 0 && p === periods[0]} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const Cell = memo(function Cell({ sectionId, day, period, inShift, first }: { sectionId: string; day: DayIndex; period: Period; inShift: boolean; first: boolean }) {
  const key = `${sectionId}|${day}|${period}`;
  const ids = useData((s) => s.cells[key]) ?? EMPTY;
  const armed = useBuilderUi((s) => s.armed !== null);
  const flash = useBuilderUi((s) => s.flashKey === key);
  const isFocusTarget = useBuilderUi((s) => s.focusKey === key || (s.focusKey === null && first));

  const activate = () => {
    const ui = useBuilderUi.getState();
    if (ui.armed) {
      dropOn(ui.armed, key);
      return;
    }
    if (ids.length) ui.set({ editSlotId: ids[0] });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    } else if (e.key === 'Escape') {
      useBuilderUi.getState().set({ armed: null });
    }
  };

  const grouped = ids.length > 1 && ids.every((id) => useData.getState().slots[id]?.group && useData.getState().slots[id]?.group === useData.getState().slots[ids[0]]?.group);

  return (
    <div
      role="gridcell"
      data-cell={key}
      data-drop={key}
      tabIndex={isFocusTarget ? 0 : -1}
      onFocus={() => useBuilderUi.getState().focusKey !== key && useBuilderUi.getState().set({ focusKey: key })}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-chip]')) return;
        activate();
      }}
      onKeyDown={onKeyDown}
      className={cn(
        'group/cell relative min-h-[84px] border-l border-line p-1.5 transition-colors duration-150 outline-none focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-inset',
        !inShift && 'bg-surface-2/70',
        armed && 'cursor-copy hover:bg-primary-soft',
        flash && 'animate-flash',
      )}
    >
      {ids.length === 0 ? (
        <div
          className={cn(
            'grid h-full min-h-[72px] place-items-center rounded-lg border border-dashed text-[11px] text-muted transition-opacity',
            armed ? 'border-primary-ink/40 opacity-100' : 'border-transparent opacity-0 group-hover/cell:border-line-strong group-hover/cell:opacity-100',
          )}
        >
          <span className="inline-flex items-center gap-1">
            <Plus className="size-3" aria-hidden />
            {inShift ? 'Free' : 'Off shift'}
          </span>
          <span className="sr-only">Empty. {armed ? 'Press Enter to place the selected item here.' : ''}</span>
        </div>
      ) : grouped ? (
        <GroupCard ids={ids} />
      ) : (
        <div className="flex h-full flex-col gap-1">
          {ids.map((id) => (
            <SlotChip key={id} id={id} compact={ids.length > 1} />
          ))}
        </div>
      )}
    </div>
  );
});

const SlotChip = memo(function SlotChip({ id, compact }: { id: string; compact: boolean }) {
  const slot = useData((s) => s.slots[id]);
  const clashes = useData((s) => s.slotClashes[id]);
  const subjects = useData((s) => s.subjects);
  const faculty = useData((s) => s.faculty);
  const rooms = useData((s) => s.rooms);
  const sections = useData((s) => s.sections);
  if (!slot) return null;
  const t = slotText(slot, { subjects, faculty, rooms, sections });
  const worst = clashes?.[0]?.severity;
  const meta = worst ? SEVERITY_META[worst] : null;
  const lab = slot.roomId === 'rlab1' || slot.roomId === 'rlab2';

  return (
    <button
      type="button"
      data-chip
      tabIndex={-1}
      onPointerDown={(e) => beginDrag(e, { type: 'slot', slotId: id, label: `${t.code} · ${t.title}` }, `${t.code} · ${t.title}`)}
      onClick={() => useBuilderUi.getState().set({ editSlotId: id })}
      className={cn(
        'relative flex w-full flex-1 cursor-grab flex-col items-start overflow-hidden rounded-[9px] border py-1.5 pr-1.5 pl-3 text-left transition-[box-shadow,transform,border-color] duration-150 before:absolute before:inset-y-1.5 before:left-1 before:w-[3px] before:rounded-full hover:-translate-y-px hover:shadow-2 active:cursor-grabbing',
        KIND_STYLE[slot.kind],
        worst === 'critical' && 'clash-pulse border-critical bg-critical-soft before:bg-critical',
        worst === 'warning' && 'border-warning-line bg-warning-soft',
        worst === 'advisory' && 'border-advisory-line',
      )}
    >
      <span className="flex w-full items-center gap-1">
        <span className={cn('truncate text-[12.5px] font-semibold', worst === 'critical' ? 'text-critical' : 'text-ink')}>{t.code}</span>
        <KindIcon kind={slot.kind} label={slot.label} className="text-muted" />
        {lab && <LabIcon className="text-muted" />}
        {meta && (
          <span className={cn('ml-auto inline-flex items-center gap-0.5 text-[10.5px] font-semibold', worst === 'critical' ? 'text-critical' : worst === 'warning' ? 'text-warning' : 'text-advisory')}>
            <meta.Icon className="size-3.5" aria-hidden />
            <span className={compact ? 'sr-only' : 'hidden xl:inline'}>{meta.label}</span>
            {compact && <span className="sr-only">{meta.label} clash</span>}
          </span>
        )}
      </span>
      {!compact && <span className="w-full truncate text-[11.5px] text-ink-2">{t.title}</span>}
      <span className="mt-auto flex w-full items-center gap-1 pt-0.5 text-[11px] text-muted">
        <span className={cn('truncate', t.external && 'text-accent-ink')}>{t.facultyShort || t.faculty}</span>
        <span aria-hidden>·</span>
        <span className="shrink-0">{t.room}</span>
        {t.shortTag && !compact && (
          <span title={t.tag} className="ml-auto shrink-0 rounded bg-accent-soft px-1 text-[10px] font-semibold text-accent-ink">
            {t.shortTag}
          </span>
        )}
      </span>
      <span className="sr-only">
        {t.title}, {t.faculty}, {t.room}.{clashes?.length ? ` ${clashes.length} clash${clashes.length > 1 ? 'es' : ''}: ${clashes.map((c) => c.title).join(', ')}.` : ''}
      </span>
    </button>
  );
});

const GroupCard = memo(function GroupCard({ ids }: { ids: readonly string[] }) {
  const slots = useData((s) => s.slots);
  const subjects = useData((s) => s.subjects);
  const clashes = useData((s) => s.slotClashes);
  const first = slots[ids[0]];
  if (!first) return null;
  const worst = ids.flatMap((id) => clashes[id] ?? []).sort((a, b) => (a.severity === 'critical' ? -1 : b.severity === 'critical' ? 1 : 0))[0]?.severity;
  return (
    <button
      type="button"
      data-chip
      tabIndex={-1}
      onClick={() => useBuilderUi.getState().set({ editSlotId: ids[0] })}
      className={cn(
        'relative flex h-full min-h-[72px] w-full flex-col items-start rounded-[9px] border py-1.5 pr-1.5 pl-3 text-left transition-shadow before:absolute before:inset-y-1.5 before:left-1 before:w-[3px] before:rounded-full hover:shadow-2',
        KIND_STYLE[first.kind],
        worst === 'critical' && 'clash-pulse border-critical',
        worst === 'warning' && 'border-warning-line',
      )}
    >
      <span className="flex items-center gap-1 text-[12.5px] font-semibold text-accent-ink">
        <KindIcon kind={first.kind} />
        {first.kind} · {ids.length} parallel
      </span>
      <span className="mt-0.5 flex flex-wrap gap-1">
        {ids.map((id) => (
          <span key={id} className="rounded bg-surface/70 px-1 text-[10.5px] font-medium text-ink-2">
            {subjects[slots[id]?.subjectId ?? '']?.code}
          </span>
        ))}
      </span>
      <span className="sr-only">Parallel elective block. Students choose one of {ids.length} offerings.</span>
    </button>
  );
});
