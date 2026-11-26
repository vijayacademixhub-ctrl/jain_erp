import { CheckCircle2, ClipboardCheck, Mail, Send, ShieldCheck, UserRoundX, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader, SimulatedNote } from '../../components/layout/PageHeader';
import { MailDrawer } from '../../components/mail/MailDrawer';
import { Badge, StatusChip } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { EmptyState, Tabs } from '../../components/ui/Controls';
import { Select, Textarea } from '../../components/ui/Field';
import { COMMITTEE_USER } from '../../domain/constants';
import type { DayEntry } from '../../domain/daily';
import { leaveCovers, leaveDays } from '../../domain/leave';
import { rankSubstitutes, type SubCandidate } from '../../domain/substitutes';
import type { LeaveRequest, LeaveStatus, Slot } from '../../domain/types';
import { addDaysISO, diffDays, fmtDate, fmtStamp, relativeLabel, todayIST } from '../../lib/dates';
import { cn } from '../../lib/util';
import { dayEngine, dayEntries, sectionShort, useData, useLookup, weeklyLoads } from '../../store/data';
import { toast } from '../../store/toast';

type Filter = 'Pending' | 'Approved' | 'Rejected' | 'All';

export default function LeaveApprovals() {
  const leaves = useData((s) => s.leaves);
  const [filter, setFilter] = useState<Filter>('Pending');
  const [mailFor, setMailFor] = useState<string | null>(null);
  const counts = useMemo(() => {
    const c: Record<LeaveStatus, number> = { Pending: 0, Approved: 0, Rejected: 0 };
    for (const l of leaves) c[l.status]++;
    return c;
  }, [leaves]);
  const shown = useMemo(
    () =>
      leaves
        .filter((l) => filter === 'All' || l.status === filter)
        .sort((a, b) => (a.status === 'Pending' ? a.submittedAt.localeCompare(b.submittedAt) : b.submittedAt.localeCompare(a.submittedAt))),
    [leaves, filter],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Committee Console"
        title="Leave Approvals"
        docTitle="Leave Approvals"
        description="Only approved leave reaches the Planned Leave column and the clash engine. Cover the classes with ranked substitutes and publish in one step."
        actions={<SimulatedNote>Emails and WhatsApp alerts are simulated</SimulatedNote>}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader title="Requests" icon={<ClipboardCheck />} />
          <div className="px-5 pb-3">
            <Tabs
              label="Filter leave requests"
              value={filter}
              onChange={setFilter}
              items={[
                { id: 'Pending', label: 'Pending', count: counts.Pending },
                { id: 'Approved', label: 'Approved', count: counts.Approved },
                { id: 'Rejected', label: 'Rejected', count: counts.Rejected },
                { id: 'All', label: 'All', count: leaves.length },
              ]}
            />
          </div>
          <CardBody>
            {shown.length === 0 ? (
              <EmptyState icon={<ShieldCheck />} title={filter === 'Pending' ? 'No pending requests' : `No ${filter.toLowerCase()} requests`}>
                {filter === 'Pending' ? 'New requests appear here the moment a faculty member submits one.' : 'Requests move here once decided.'}
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {shown.map((l) => (
                  <RequestCard key={l.id} leave={l} onMail={() => setMailFor(l.id)} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <CoverPanel />
      </div>
      <MailDrawer leaveId={mailFor} onClose={() => setMailFor(null)} />
    </div>
  );
}

function RequestCard({ leave, onMail }: { leave: LeaveRequest; onMail: () => void }) {
  const lookup = useLookup();
  const decideLeave = useData((s) => s.decideLeave);
  const snapshots = useData((s) => s.snapshots);
  const changes = useData((s) => s.changes);
  const [mode, setMode] = useState<'idle' | 'reject'>('idle');
  const [remark, setRemark] = useState('');
  const f = lookup.faculty[leave.facultyId];
  const notice = diffDays(leave.from, todayIST(new Date(leave.submittedAt)));

  const affected = useMemo(() => {
    let n = 0;
    for (const d of leaveDays(leave)) n += dayEntries({ snapshots, changes }, d, false).filter((e) => e.facultyId === leave.facultyId && e.status !== 'cancelled' && leaveCovers(leave, d, e.period)).length;
    return n;
  }, [leave, snapshots, changes]);

  return (
    <li className="animate-fade-up rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">{f?.name}</p>
          <p className="text-[12px] text-muted">
            {f?.designation} · {f?.area}
            {f?.type === 'External' ? ' · visiting' : ''}
          </p>
        </div>
        <StatusChip tone={leave.status === 'Approved' ? 'success' : leave.status === 'Rejected' ? 'critical' : 'accent'} live={leave.status === 'Pending'}>
          {leave.status}
        </StatusChip>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Badge tone={leave.type === 'Planned' ? 'primary' : 'accent'}>{leave.type}</Badge>
        <Badge tone="neutral">{leave.from === leave.to ? fmtDate(leave.from, 'EEE d MMM') : `${fmtDate(leave.from, 'EEE d')} – ${fmtDate(leave.to, 'EEE d MMM')}`}</Badge>
        {leave.periods.length > 0 && <Badge tone="neutral">P{leave.periods.join(', P')}</Badge>}
        <Badge tone={affected ? 'warning' : 'neutral'}>
          {affected} class{affected === 1 ? '' : 'es'} affected
        </Badge>
        <Badge tone="neutral">{notice <= 0 ? 'Same-day notice' : `${notice} day${notice > 1 ? 's' : ''} notice`}</Badge>
      </div>
      <p className="mt-2.5 text-[13px] text-ink-2">"{leave.reason}"</p>
      <p className="mt-1 text-[11.5px] text-muted">Submitted {fmtStamp(leave.submittedAt)}</p>
      {leave.status !== 'Pending' && (
        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
          {leave.status} by {leave.decidedBy} · {fmtStamp(leave.decidedAt!)}
          {leave.remark && <span className="block text-muted">"{leave.remark}"</span>}
        </p>
      )}
      {leave.status === 'Pending' && mode === 'reject' && (
        <div className="mt-3">
          <label htmlFor={`remark-${leave.id}`} className="mb-1 block text-[12.5px] font-medium text-ink-2">
            Remark for the faculty member (required to reject)
          </label>
          <Textarea id={`remark-${leave.id}`} rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} data-autofocus placeholder="e.g. Unit test week. Please choose another date." />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {leave.status === 'Pending' &&
          (mode === 'reject' ? (
            <>
              <Button
                size="sm"
                variant="danger"
                disabled={remark.trim().length < 4}
                onClick={() => {
                  decideLeave(leave.id, 'Rejected', COMMITTEE_USER, remark.trim(), 'console');
                  toast.info('Leave rejected', `${f?.name} has been emailed the remark (simulated).`);
                }}
              >
                Confirm reject
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode('idle')}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="primary"
                icon={<CheckCircle2 />}
                onClick={() => {
                  decideLeave(leave.id, 'Approved', COMMITTEE_USER, 'Approved.', 'console');
                  toast.success('Leave approved', `${f?.name} is now in the Planned Leave column. ${affected ? `${affected} class(es) need cover.` : ''}`);
                }}
              >
                Approve
              </Button>
              <Button size="sm" variant="secondary" icon={<XCircle />} onClick={() => setMode('reject')}>
                Reject
              </Button>
            </>
          ))}
        <Button size="sm" variant="ghost" icon={<Mail />} onClick={onMail} className="ml-auto">
          View emails
        </Button>
      </div>
    </li>
  );
}

interface CoverItem {
  date: string;
  entry: DayEntry;
  options: SubCandidate[];
}

/** Approved leave in the next week whose classes still have no substitute. */
function CoverPanel() {
  const leaves = useData((s) => s.leaves);
  const changes = useData((s) => s.changes);
  const snapshots = useData((s) => s.snapshots);
  const today = useData((s) => s.today);

  const groups = useMemo(() => {
    const st = useData.getState();
    const loads = weeklyLoads(st);
    const horizon = addDaysISO(today, 6);
    const out: { leave: LeaveRequest; items: CoverItem[] }[] = [];
    const relevant = leaves
      .filter((l) => l.status === 'Approved' && l.to >= today && l.from <= horizon)
      .sort((a, b) => (a.type === b.type ? a.from.localeCompare(b.from) : a.type === 'Unplanned' ? -1 : 1));
    for (const l of relevant) {
      const items: CoverItem[] = [];
      for (const date of leaveDays(l)) {
        if (date < today || date > horizon) continue;
        const { engine, entries } = dayEngine(st, date, true);
        for (const e of entries) {
          if (e.facultyId !== l.facultyId || e.status === 'cancelled' || !e.slotId || !leaveCovers(l, date, e.period)) continue;
          const slot: Slot = { id: e.key, day: e.day, period: e.period, sectionIds: e.sectionIds, kind: e.kind, subjectId: e.subjectId, facultyId: e.facultyId, roomId: e.roomId };
          items.push({ date, entry: e, options: rankSubstitutes({ dayEngine: engine, slot, date, faculty: st.facultyList, subjects: st.subjects, leaves: st.leaves, loads, limit: 4 }) });
        }
      }
      if (items.length) out.push({ leave: l, items });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaves, changes, snapshots, today]);

  return (
    <Card className="self-start">
      <CardHeader
        title="Classes needing cover"
        description="Ranked by: free in that period, not on leave, same subject area, lowest workload."
        icon={<UserRoundX />}
      />
      <CardBody className="space-y-4">
        {groups.length === 0 ? (
          <EmptyState icon={<ShieldCheck />} title="Every class is covered">
            Approved leave for the next seven days already has substitutes or cancellations in place.
          </EmptyState>
        ) : (
          groups.map((g) => <CoverGroup key={g.leave.id} leave={g.leave} items={g.items} />)
        )}
      </CardBody>
    </Card>
  );
}

function CoverGroup({ leave, items }: { leave: LeaveRequest; items: CoverItem[] }) {
  const lookup = useLookup();
  const today = useData((s) => s.today);
  const assignAndPublish = useData((s) => s.assignAndPublish);
  const f = lookup.faculty[leave.facultyId];

  // Greedy defaults: never give one substitute two classes in the same period.
  const defaults = useMemo(() => {
    const taken = new Set<string>();
    const m: Record<string, string> = {};
    for (const it of items) {
      const pick = it.options.find((o) => !taken.has(`${it.date}|${it.entry.period}|${o.faculty.id}`));
      if (pick) {
        m[it.entry.key + it.date] = pick.faculty.id;
        taken.add(`${it.date}|${it.entry.period}|${pick.faculty.id}`);
      }
    }
    return m;
  }, [items]);
  const [chosen, setChosen] = useState<Record<string, string>>(defaults);
  const value = (it: CoverItem) => chosen[it.entry.key + it.date] ?? defaults[it.entry.key + it.date] ?? '';

  const assign = () => {
    const byDate = new Map<string, { slotId: string; facultyId: string }[]>();
    for (const it of items) {
      const fid = value(it);
      if (!fid || !it.entry.slotId) continue;
      const list = byDate.get(it.date) ?? [];
      list.push({ slotId: it.entry.slotId, facultyId: fid });
      byDate.set(it.date, list);
    }
    let n = 0;
    for (const [date, list] of byDate) n += assignAndPublish(date, list, `${f?.name} on ${leave.type.toLowerCase()} leave.`);
    toast.success(`Assigned and published ${n} substitution${n === 1 ? '' : 's'}`, 'Students and faculty see the change now. The leave clash in the master builder is cleared.');
  };

  return (
    <div className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <p className="text-[13.5px] font-semibold text-ink">{f?.name}</p>
        <Badge tone={leave.type === 'Planned' ? 'primary' : 'accent'}>{leave.type}</Badge>
        <span className="text-[12px] text-muted">{relativeLabel(leave.from, today)}</span>
        <Button size="sm" variant="primary" icon={<Send />} className="ml-auto" onClick={assign} disabled={items.every((it) => !value(it))}>
          Assign and publish
        </Button>
      </div>
      <ul className="divide-y divide-line">
        {items.map((it) => {
          const sub = lookup.subjects[it.entry.subjectId ?? ''];
          return (
            <li key={it.entry.key + it.date} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">
                  {fmtDate(it.date, 'EEE')} P{it.entry.period} · {sub?.code ?? it.entry.label}
                </p>
                <p className="truncate text-[12px] text-muted">
                  {sectionShort(lookup, it.entry.sectionIds)} · {sub?.name ?? ''} · {lookup.rooms[it.entry.roomId ?? '']?.name ?? ''}
                </p>
              </div>
              {it.options.length === 0 ? (
                <p className="text-[12.5px] text-critical">No free faculty. Consider cancelling.</p>
              ) : (
                <div>
                  <label className="sr-only" htmlFor={`sub-${it.entry.key}-${it.date}`}>
                    Substitute for {sub?.code} on {fmtDate(it.date, 'EEE')} period {it.entry.period}
                  </label>
                  <Select id={`sub-${it.entry.key}-${it.date}`} value={value(it)} onChange={(e) => setChosen((c) => ({ ...c, [it.entry.key + it.date]: e.target.value }))}>
                    {it.options.map((o, i) => (
                      <option key={o.faculty.id} value={o.faculty.id}>
                        {i + 1}. {o.faculty.name} · {o.sameArea ? 'same area' : o.faculty.area} · {o.load} h/wk
                      </option>
                    ))}
                  </Select>
                  <p className={cn('mt-1 text-[11.5px]', it.options[0]?.sameArea ? 'text-success' : 'text-muted')}>{it.options.find((o) => o.faculty.id === value(it))?.reasons.join(' · ')}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
