import { ChevronRight, LocateFixed, ShieldCheck, Siren } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SeverityBadge } from '../../../components/ui/Badge';
import { SEVERITY_META } from '../../../components/ui/severity';
import { Tabs } from '../../../components/ui/Controls';
import { Drawer } from '../../../components/ui/Dialog';
import { EmptyState } from '../../../components/ui/Controls';
import { DAY_SHORT } from '../../../domain/constants';
import type { Clash, Severity } from '../../../domain/types';
import { cn } from '../../../lib/util';
import { engine, sectionShort, useData } from '../../../store/data';
import { focusSlot, useBuilderUi } from './builderUi';
import { Suggestions } from './Suggestions';

type Filter = 'all' | Severity;

export function ClashPanel() {
  const open = useBuilderUi((s) => s.panelOpen);
  const selected = useBuilderUi((s) => s.selectedClashId);
  const set = useBuilderUi((s) => s.set);
  const list = useData((s) => s.clashList);
  const counts = useData((s) => s.clashCounts);
  const sections = useData((s) => s.sections);
  const slots = useData((s) => s.slots);
  const [filter, setFilter] = useState<Filter>('all');

  const shown = useMemo(() => (filter === 'all' ? list : list.filter((c) => c.severity === filter)), [list, filter]);
  const total = counts.critical + counts.warning + counts.advisory;

  return (
    <Drawer
      open={open}
      onClose={() => set({ panelOpen: false })}
      title="Clash panel"
      description={total ? `${counts.critical} critical, ${counts.warning} warning, ${counts.advisory} advisory in the master draft` : 'The master draft is clean'}
      icon={<Siren />}
      width="sm:max-w-[500px]"
    >
      <div className="sticky top-0 z-10 border-b border-line bg-surface px-5 py-3">
        <Tabs
          label="Filter clashes by severity"
          size="sm"
          value={filter}
          onChange={setFilter}
          items={[
            { id: 'all', label: 'All', count: total },
            { id: 'critical', label: 'Critical', count: counts.critical },
            { id: 'warning', label: 'Warning', count: counts.warning },
            { id: 'advisory', label: 'Advisory', count: counts.advisory },
          ]}
        />
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<ShieldCheck />} title={filter === 'all' ? 'No open clashes' : `No ${filter} clashes`}>
          {filter === 'all' ? 'Every class, room and faculty member is booked once. You can publish.' : 'Nothing at this level right now.'}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((c) => (
            <ClashItem
              key={c.id}
              clash={c}
              open={selected === c.id}
              onToggle={() => set({ selectedClashId: selected === c.id ? null : c.id })}
              where={c.slotIds.map((id) => (slots[id] ? sectionShort({ sections }, slots[id].sectionIds) : '')).filter(Boolean)}
            />
          ))}
        </ul>
      )}
    </Drawer>
  );
}

function ClashItem({ clash, open, onToggle, where }: { clash: Clash; open: boolean; onToggle: () => void; where: string[] }) {
  const meta = SEVERITY_META[clash.severity];
  const [target, setTarget] = useState(clash.slotIds[0]);
  const set = useBuilderUi((s) => s.set);
  const slots = useData((s) => s.slots);
  const sections = useData((s) => s.sections);
  return (
    <li className={cn('px-5 py-3.5', open && 'bg-surface-2/60')}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
        <span
          className={cn(
            'mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg',
            clash.severity === 'critical' ? 'bg-critical-soft text-critical' : clash.severity === 'warning' ? 'bg-warning-soft text-warning-icon' : 'bg-advisory-soft text-advisory',
          )}
        >
          <meta.Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-ink">{clash.title}</span>
            <SeverityBadge severity={clash.severity} />
          </span>
          <span className="mt-1 block text-[12.5px] leading-snug text-ink-2">{clash.message}</span>
          <span className="mt-1.5 flex flex-wrap gap-1 text-[11.5px] text-muted">
            <span className="tabular rounded-md bg-surface-3 px-1.5 py-0.5 font-medium">
              {DAY_SHORT[clash.day]} P{clash.period}
            </span>
            {[...new Set(where)].map((w) => (
              <span key={w} className="rounded-md bg-surface-3 px-1.5 py-0.5">
                {w}
              </span>
            ))}
          </span>
        </span>
        <ChevronRight className={cn('mt-1 size-4 shrink-0 text-muted transition-transform', open && 'rotate-90')} aria-hidden />
      </button>
      {open && (
        <div className="animate-fade-up mt-3 ml-10 space-y-3">
          {clash.slotIds.length > 1 && (
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-muted">Fix which class?</p>
              <div className="flex flex-wrap gap-1.5">
                {clash.slotIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTarget(id)}
                    aria-pressed={target === id}
                    className={cn('h-7 rounded-lg border px-2 text-[12px] font-medium', target === id ? 'border-primary-ink bg-primary-soft text-primary-ink' : 'border-line text-ink-2 hover:border-line-strong')}
                  >
                    {slots[id] ? sectionShort({ sections }, slots[id].sectionIds) : id}
                  </button>
                ))}
              </div>
            </div>
          )}
          {slots[target] && <p className="rounded-lg border border-line bg-surface px-3 py-2 text-[12px] text-ink-2">{engine.describeFor(clash, target)}</p>}
          <Suggestions slotId={target} />
          <button
            type="button"
            onClick={() => {
              set({ panelOpen: false });
              focusSlot(target);
            }}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-ink hover:underline"
          >
            <LocateFixed className="size-3.5" aria-hidden /> Show in grid
          </button>
        </div>
      )}
    </li>
  );
}
