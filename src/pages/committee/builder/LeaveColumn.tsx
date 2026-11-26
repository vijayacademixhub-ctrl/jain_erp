import { CalendarOff, Info } from 'lucide-react';
import { memo, useMemo } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../../components/ui/Badge';
import { addDaysISO, fmtDate } from '../../../lib/dates';
import { cn } from '../../../lib/util';
import { useData } from '../../../store/data';

/** Planned Leave column: only APPROVED leave reaches the builder and the clash engine. */
export const LeaveColumn = memo(function LeaveColumn({ sectionId }: { sectionId: string }) {
  const week = useData((s) => s.builderWeek);
  const leaves = useData((s) => s.leaves);
  const faculty = useData((s) => s.faculty);
  const slots = useData((s) => s.slots);
  const weekEnd = addDaysISO(week, 5);

  const { approved, pending, teachesHere } = useMemo(() => {
    const inWeek = leaves.filter((l) => l.from <= weekEnd && l.to >= week);
    const here = new Set<string>();
    for (const s of Object.values(slots)) if (s.facultyId && s.sectionIds.includes(sectionId)) here.add(s.facultyId);
    return {
      approved: inWeek.filter((l) => l.status === 'Approved').sort((a, b) => a.from.localeCompare(b.from)),
      pending: inWeek.filter((l) => l.status === 'Pending').length,
      teachesHere: here,
    };
  }, [leaves, week, weekEnd, slots, sectionId]);

  return (
    <section aria-labelledby="leave-col" className="rounded-2xl border border-line bg-surface shadow-1">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <CalendarOff className="size-4 text-muted" aria-hidden />
        <h2 id="leave-col" className="text-[13.5px] font-semibold text-ink">
          Planned leave
        </h2>
        <span className="tabular ml-auto text-xs text-muted">{approved.length}</span>
      </div>
      <p className="px-4 pb-2 text-[11.5px] text-muted">
        Week of {fmtDate(week, 'd MMM')}. Approved leave only.
      </p>
      {approved.length === 0 ? (
        <p className="mx-3 mb-3 rounded-xl border border-dashed border-line-strong px-3 py-4 text-center text-[12px] text-muted">No approved leave this week.</p>
      ) : (
        <ul className="grid gap-1.5 px-3 pb-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-1">
          {approved.map((l) => {
            const f = faculty[l.facultyId];
            const here = teachesHere.has(l.facultyId);
            return (
              <li key={l.id} className={cn('rounded-xl border px-3 py-2', here ? 'border-critical-line bg-critical-soft' : 'border-line bg-surface-2/60')}>
                <p className="truncate text-[12.5px] font-semibold text-ink">{f?.name}</p>
                <p className="tabular mt-0.5 text-[11.5px] text-ink-2">
                  {l.from === l.to ? fmtDate(l.from, 'EEE d MMM') : `${fmtDate(l.from, 'EEE d')}–${fmtDate(l.to, 'EEE d MMM')}`}
                  {l.periods.length > 0 && ` · P${l.periods.join(', P')}`}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Badge tone={l.type === 'Planned' ? 'primary' : 'accent'}>{l.type}</Badge>
                  {here && <Badge tone="critical">Teaches this section</Badge>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pending > 0 && (
        <Link to="/committee/leave" className="mx-3 mb-3 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[11.5px] text-ink-2 hover:text-ink">
          <Info className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
          <span>
            {pending} pending request{pending > 1 ? 's' : ''} this week. They appear here once approved.
          </span>
        </Link>
      )}
    </section>
  );
});
