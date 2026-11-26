import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowRight, Download, History, Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Controls';
import { Input, Select } from '../../components/ui/Field';
import { APPROVERS, COMMITTEE_USER } from '../../domain/constants';
import { fmtStamp } from '../../lib/dates';
import { cn, downloadFile, toCSV } from '../../lib/util';
import { auditHistory, useData } from '../../store/data';
import { toast } from '../../store/toast';

const COLS = '168px 150px minmax(170px,1fr) minmax(220px,1.4fr) minmax(220px,1.4fr)';

export default function Audit() {
  const live = useData((s) => s.audit);
  const today = useData((s) => s.today);
  const [q, setQ] = useState('');
  const [user, setUser] = useState('all');
  const [action, setAction] = useState('all');
  const parentRef = useRef<HTMLDivElement>(null);
  const all = useMemo(() => [...live, ...auditHistory()], [live]);
  const actions = useMemo(() => [...new Set(all.map((a) => a.action))].sort(), [all]);
  const liveIds = useMemo(() => new Set(live.map((a) => a.id)), [live]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((a) => {
      if (action !== 'all' && a.action !== action) return false;
      if (user === 'committee' && ![COMMITTEE_USER, ...APPROVERS.map((x) => x.name)].includes(a.user)) return false;
      if (user === 'faculty' && [COMMITTEE_USER, 'System', ...APPROVERS.map((x) => x.name)].includes(a.user)) return false;
      if (user !== 'all' && user !== 'committee' && user !== 'faculty' && a.user !== user) return false;
      return !needle || `${a.action} ${a.entity} ${a.user} ${a.before ?? ''} ${a.after ?? ''}`.toLowerCase().includes(needle);
    });
  }, [all, q, user, action]);

  const virt = useVirtualizer({ count: shown.length, getScrollElement: () => parentRef.current, estimateSize: () => 58, overscan: 10 });

  return (
    <div>
      <PageHeader
        eyebrow="Committee Console"
        title="Audit Trail"
        docTitle="Audit Trail"
        description="Every action is logged with who, when (IST) and what changed. Overrides record their written reason."
        actions={
          <Button
            variant="secondary"
            icon={<Download />}
            onClick={() => {
              downloadFile(`audit-${today}.csv`, toCSV([['Time (IST)', 'User', 'Action', 'Entity', 'Before', 'After'], ...shown.map((a) => [fmtStamp(a.at), a.user, a.action, a.entity, a.before ?? '', a.after ?? ''])]), 'text/csv');
              toast.success('Audit log exported', `${shown.length.toLocaleString('en-IN')} entries saved as CSV.`);
            }}
          >
            Export CSV
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Search the audit log" placeholder="Search action, entity, user" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select aria-label="Filter by user" value={user} onChange={(e) => setUser(e.target.value)} className="w-48">
          <option value="all">Everyone</option>
          <option value="committee">Committee members</option>
          <option value="faculty">Faculty</option>
          <option value={COMMITTEE_USER}>{COMMITTEE_USER}</option>
          {APPROVERS.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name}
            </option>
          ))}
          <option value="System">System</option>
        </Select>
        <Select aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)} className="w-60">
          <option value="all">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <span className="tabular text-[12.5px] text-muted sm:ml-auto">
          {shown.length.toLocaleString('en-IN')} of {all.length.toLocaleString('en-IN')} entries · {live.length} this session
        </span>
      </div>

      <div role="table" aria-label="Audit log" aria-rowcount={shown.length + 1} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-1">
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div role="row" className="grid border-b border-line bg-grid-head text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase" style={{ gridTemplateColumns: COLS }}>
              {['Time (IST)', 'User', 'Action', 'Entity', 'Before → after'].map((h) => (
                <div key={h} role="columnheader" className="px-4 py-2.5">
                  {h}
                </div>
              ))}
            </div>
            {shown.length === 0 ? (
              <EmptyState icon={<History />} title="No entries match">
                Try a broader search or clear the filters.
              </EmptyState>
            ) : (
              <div ref={parentRef} className="h-[620px] overflow-y-auto" tabIndex={0} aria-label="Audit entries, scrollable">
                <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
                  {virt.getVirtualItems().map((vi) => {
                    const a = shown[vi.index];
                    const isLive = liveIds.has(a.id);
                    return (
                      <div
                        key={a.id}
                        role="row"
                        aria-rowindex={vi.index + 2}
                        className={cn('absolute inset-x-0 grid items-center border-b border-line text-[12.5px]', isLive && 'bg-primary-soft/40')}
                        style={{ height: vi.size, transform: `translateY(${vi.start}px)`, gridTemplateColumns: COLS }}
                      >
                        <div role="cell" className="tabular px-4 text-muted">
                          {fmtStamp(a.at).replace(' IST', '')}
                        </div>
                        <div role="cell" className="truncate px-4 font-medium text-ink">
                          {a.user}
                        </div>
                        <div role="cell" className="flex items-center gap-1.5 truncate px-4 text-ink">
                          {a.action}
                          {isLive && <Badge tone="primary">New</Badge>}
                        </div>
                        <div role="cell" className="truncate px-4 text-ink-2" title={a.entity}>
                          {a.entity}
                        </div>
                        <div role="cell" className="flex min-w-0 items-center gap-1.5 px-4 text-ink-2">
                          {a.before && (
                            <>
                              <span className="truncate text-muted line-through decoration-muted/50" title={a.before}>
                                {a.before}
                              </span>
                              <ArrowRight className="size-3 shrink-0 text-muted" aria-label="changed to" />
                            </>
                          )}
                          <span className="truncate" title={a.after}>
                            {a.after ?? '—'}
                          </span>
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
    </div>
  );
}
