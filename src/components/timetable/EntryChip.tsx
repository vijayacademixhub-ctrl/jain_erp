import { memo } from 'react';
import { CHANGE_LABEL, type DayEntry } from '../../domain/daily';
import { cn } from '../../lib/util';
import { KIND_STYLE, slotText, type Lookup } from './slotDisplay';
import { KindIcon } from './SlotIcons';

/** A class on a given date, with daily changes made obvious: tag, strike-through of the old value. */
export const EntryChip = memo(function EntryChip({
  entry,
  lookup,
  onClick,
  showTitle = true,
  className,
}: {
  entry: DayEntry;
  lookup: Lookup;
  onClick?: () => void;
  showTitle?: boolean;
  className?: string;
}) {
  const t = slotText(entry, lookup);
  const prevFac = entry.previous?.facultyId ? lookup.faculty[entry.previous.facultyId] : undefined;
  const prevRoom = entry.previous?.roomId ? lookup.rooms[entry.previous.roomId] : undefined;
  const cancelled = entry.status === 'cancelled';
  const changed = entry.status === 'changed';
  const added = entry.status === 'added';
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'relative flex w-full flex-col items-start rounded-[9px] border py-1.5 pr-1.5 pl-3 text-left before:absolute before:inset-y-1.5 before:left-1 before:w-[3px] before:rounded-full',
        onClick && 'transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-2',
        KIND_STYLE[entry.kind],
        changed && 'border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-accent-soft before:bg-accent',
        added && 'border-success-line bg-success-soft before:bg-success',
        cancelled && 'border-critical-line bg-critical-soft/60 before:bg-critical',
        entry.draft && 'border-dashed',
        className,
      )}
    >
      <span className="flex w-full flex-wrap items-center gap-1">
        <span className={cn('text-[12.5px] font-semibold text-ink', cancelled && 'text-muted line-through')}>{t.code}</span>
        <KindIcon kind={entry.kind} label={entry.label} className="text-muted" />
        {(changed || cancelled || added) && (
          <span
            className={cn(
              'ml-auto rounded px-1 text-[10px] font-semibold tracking-wide uppercase',
              cancelled ? 'bg-critical text-white dark:text-[#1a0503]' : added ? 'bg-success text-white dark:text-[#04140b]' : 'bg-accent text-white dark:text-[#1a1303]',
            )}
          >
            {cancelled ? 'Cancelled' : added ? CHANGE_LABEL[entry.changeTypes[0]] : 'Changed'}
          </span>
        )}
        {entry.draft && <span className="rounded border border-dashed border-line-strong px-1 text-[10px] font-semibold text-muted uppercase">Draft</span>}
      </span>
      {showTitle && <span className={cn('w-full truncate text-[11.5px] text-ink-2', cancelled && 'line-through')}>{t.title}</span>}
      <span className="mt-0.5 flex w-full flex-wrap items-center gap-x-1 text-[11px] text-muted">
        {prevFac && (
          <>
            <s className="text-muted/80" aria-label={`was ${prevFac.name}`}>
              {prevFac.short}
            </s>
            <span aria-hidden>→</span>
          </>
        )}
        <span className={cn(prevFac && 'font-semibold text-ink-2', cancelled && 'line-through')}>{t.facultyShort || t.faculty}</span>
        <span aria-hidden>·</span>
        {prevRoom && (
          <>
            <s className="text-muted/80" aria-label={`was ${prevRoom.name}`}>
              {prevRoom.name.replace('Room ', '')}
            </s>
            <span aria-hidden>→</span>
          </>
        )}
        <span className={cn(prevRoom && 'font-semibold text-ink-2', cancelled && 'line-through')}>{t.room}</span>
        {entry.previous?.period && <span className="ml-auto text-[10.5px] font-medium text-accent-ink">from P{entry.previous.period}</span>}
      </span>
      {(changed || cancelled || added) && (
        <span className="sr-only">
          {cancelled ? 'Cancelled.' : added ? 'Added for this date.' : `Changed: ${entry.changeTypes.map((c) => CHANGE_LABEL[c]).join(', ')}.`} {entry.reason ?? ''}
        </span>
      )}
    </Tag>
  );
});
