import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDownUp, Download, Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusChip, type Tone } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Controls';
import { Input, Select } from '../../components/ui/Field';
import type { Area } from '../../domain/types';
import { computeWorkload, type WorkloadRow, type WorkloadStatus } from '../../domain/workload';
import { fmtDate } from '../../lib/dates';
import { useCountUp } from '../../lib/hooks';
import { cn, downloadFile, toCSV } from '../../lib/util';
import { latestSnapshot, useData } from '../../store/data';
import { toast } from '../../store/toast';

type SortKey = 'name' | 'assigned' | 'delivered' | 'pct' | 'status';
const STATUS_TONE: Record<WorkloadStatus, Tone> = { Completed: 'success', 'On track': 'primary', Shortfall: 'warning' };
const COLS = 'minmax(220px,2fr) 96px 92px minmax(180px,1.6fr) 72px 120px';

export default function Workload() {
  const facultyList = useData((s) => s.facultyList);
  const snapshots = useData((s) => s.snapshots);
  const leaves = useData((s) => s.leaves);
  const changes = useData((s) => s.changes);
  const term = useData((s) => s.term);
  const today = useData((s) => s.today);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<WorkloadStatus | 'all'>('all');
  const [area, setArea] = useState<Area | 'all'>('all');
  const [kind, setKind] = useState<'all' | 'Internal' | 'External'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'pct', dir: 1 });
  const parentRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => computeWorkload(facultyList, latestSnapshot({ snapshots }).slots, leaves, changes, term, today), [facultyList, snapshots, leaves, changes, term, today]);
  const counts = useMemo(() => {
    const c: Record<WorkloadStatus, number> = { Completed: 0, 'On track': 0, Shortfall: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);
  const areas = [...new Set(facultyList.map((f) => f.area))].sort();

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (area === 'all' || r.faculty.area === area) &&
        (kind === 'all' || r.faculty.type === kind) &&
        (!needle || `${r.faculty.name} ${r.faculty.area} ${r.faculty.short}`.toLowerCase().includes(needle)),
    );
    const val = (r: WorkloadRow): number | string =>
      sort.key === 'name' ? r.faculty.name : sort.key === 'assigned' ? r.assignedWeekly : sort.key === 'delivered' ? r.delivered : sort.key === 'pct' ? r.pct : r.status;
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [rows, q, status, area, kind, sort]);

  const virt = useVirtualizer({ count: shown.length, getScrollElement: () => parentRef.current, estimateSize: () => 64, overscan: 8 });

  const exportCsv = () => {
    const csv = toCSV([
      ['Faculty', 'Type', 'Area', 'Assigned h/week', 'Target h/week', 'Contract weeks', 'Delivered h', 'Expected to date h', 'Term target h', 'Percent of target', 'Leave hours', 'Status'],
      ...shown.map((r) => [r.faculty.name, r.faculty.type, r.faculty.area, r.assignedWeekly, r.weeklyTarget, r.contractWeeks, r.delivered, r.expected, r.termTarget, r.pct, r.leaveHours, r.status]),
    ]);
    downloadFile(`workload-${today}.csv`, csv, 'text/csv');
    toast.success('Workload exported', `${shown.length} rows saved as CSV. Opens in Excel.`);
  };

  const header = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <div role="columnheader" aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={cn('px-3 py-2.5', align === 'right' && 'text-right')}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : 1 }))}
        className="inline-flex items-center gap-1 text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase hover:text-ink"
      >
        {label}
        <ArrowDownUp className={cn('size-3', sort.key === key ? 'text-primary-ink' : 'opacity-40')} aria-hidden />
      </button>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Committee Console"
        title="Workload Tracker"
        docTitle="Workload"
        description={`Assigned versus delivered hours against target, ${term.name} (${fmtDate(term.start, 'd MMM')} to ${fmtDate(term.end, 'd MMM')}). Delivered hours count approved leave and published substitutions.`}
        actions={
          <Button variant="secondary" icon={<Download />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {(['Completed', 'On track', 'Shortfall'] as WorkloadStatus[]).map((s) => (
          <StatusTile key={s} status={s} n={counts[s]} active={status === s} onClick={() => setStatus(status === s ? 'all' : s)} />
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Search faculty" placeholder="Search name or area" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select aria-label="Filter by area" value={area} onChange={(e) => setArea(e.target.value as Area | 'all')} className="w-44">
          <option value="all">All areas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by faculty type" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-40">
          <option value="all">Internal & visiting</option>
          <option value="Internal">Internal</option>
          <option value="External">Visiting</option>
        </Select>
        <span className="text-[12.5px] text-muted sm:ml-auto">
          {shown.length} of {rows.length} faculty
        </span>
      </div>

      <div role="table" aria-label="Faculty workload" aria-rowcount={shown.length + 1} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-1">
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div role="row" aria-rowindex={1} className="grid border-b border-line bg-grid-head" style={{ gridTemplateColumns: COLS }}>
              {header('name', 'Faculty')}
              {header('assigned', 'Assigned', 'right')}
              <div role="columnheader" className="px-3 py-2.5 text-right text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">
                Target
              </div>
              {header('delivered', 'Delivered vs term target')}
              {header('pct', '%', 'right')}
              {header('status', 'Status')}
            </div>
            {shown.length === 0 ? (
              <EmptyState icon={<Search />} title="No faculty match these filters">
                Clear the search or pick another area.
              </EmptyState>
            ) : (
              <div ref={parentRef} className="max-h-[560px] overflow-y-auto" tabIndex={0} aria-label="Workload rows, scrollable">
                <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
                  {virt.getVirtualItems().map((vi) => {
                    const r = shown[vi.index];
                    const barTone = r.status === 'Shortfall' ? 'bg-warning-icon' : r.status === 'Completed' ? 'bg-success' : 'bg-primary-ink';
                    return (
                      <div
                        key={r.faculty.id}
                        role="row"
                        aria-rowindex={vi.index + 2}
                        className="absolute inset-x-0 grid items-center border-b border-line"
                        style={{ height: vi.size, transform: `translateY(${vi.start}px)`, gridTemplateColumns: COLS }}
                      >
                        <div role="cell" className="min-w-0 px-3">
                          <p className="truncate text-[13.5px] font-semibold text-ink">{r.faculty.name}</p>
                          <p className="truncate text-[12px] text-muted">
                            {r.faculty.area}
                            {r.faculty.type === 'External' ? ` · visiting, ${r.contractWeeks}-week contract` : ` · ${r.faculty.designation}`}
                          </p>
                        </div>
                        <div role="cell" className="tabular px-3 text-right text-[13px] text-ink">
                          {r.assignedWeekly} h/wk
                        </div>
                        <div role="cell" className="tabular px-3 text-right text-[13px] text-muted">
                          {r.weeklyTarget} h/wk
                        </div>
                        <div role="cell" className="px-3">
                          <div className="tabular mb-1 flex justify-between text-[12px]">
                            <span className="font-medium text-ink">{r.delivered} h</span>
                            <span className="text-muted">of {r.termTarget} h</span>
                          </div>
                          <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-3">
                            <span className={cn('absolute inset-y-0 left-0 w-full origin-left rounded-full', barTone)} style={{ transform: `scaleX(${Math.min(1, r.delivered / Math.max(1, r.termTarget))})` }} />
                            <span className="absolute inset-y-0 w-0.5 bg-ink/40" style={{ left: `${Math.min(100, (r.expected / Math.max(1, r.termTarget)) * 100)}%` }} title={`Expected by today: ${r.expected} h`} />
                          </div>
                        </div>
                        <div role="cell" className="tabular px-3 text-right text-[13px] font-semibold text-ink">
                          {r.pct}%
                        </div>
                        <div role="cell" className="px-3">
                          <StatusChip tone={STATUS_TONE[r.status]}>{r.status}</StatusChip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-muted">The thin marker on each bar shows the hours expected by today. Visiting faculty are measured against their contract weeks.</p>
    </div>
  );
}

function StatusTile({ status, n, active, onClick }: { status: WorkloadStatus; n: number; active: boolean; onClick: () => void }) {
  const shown = useCountUp(n);
  const ring = { Completed: 'text-success', 'On track': 'text-primary-ink', Shortfall: 'text-warning' }[status];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn('rounded-2xl border bg-surface px-4 py-3 text-left shadow-1 transition-[border-color,box-shadow]', active ? 'border-primary-ink ring-2 ring-[color-mix(in_srgb,var(--primary-ink)_20%,transparent)]' : 'border-line hover:border-line-strong')}
    >
      <p className={cn('text-[12.5px] font-semibold', ring)}>{status}</p>
      <p className="font-display-tight tabular mt-0.5 text-[32px] leading-none text-ink">{shown}</p>
      <p className="mt-1 text-[11.5px] text-muted">{active ? 'Filtering. Click to clear.' : 'Click to filter'}</p>
    </button>
  );
}
