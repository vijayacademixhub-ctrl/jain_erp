import {
  ArrowRight,
  BotMessageSquare,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  Calculator,
  ClipboardCheck,
  History,
  ShieldAlert,
  TrendingDown,
  UserRoundX,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Skeleton } from '../../components/ui/Skeleton';
import type { AuditEntry } from '../../domain/types';
import { idle } from '../../lib/util';
import { Link } from 'react-router';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusChip } from '../../components/ui/Badge';
import { LinkButton } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { EmptyState, Sparkline } from '../../components/ui/Controls';
import { ALL_PERIODS, periodInfo } from '../../domain/constants';
import { computeWorkload } from '../../domain/workload';
import { fmtDate, fmtStamp, fmtTimeIST, minutesIST } from '../../lib/dates';
import { useCountUp } from '../../lib/hooks';
import { cn } from '../../lib/util';
import { prefetch } from '../../routes';
import { auditHistory, dayEngine, latestSnapshot, sectionShort, useData, useLookup } from '../../store/data';

function Stat({
  label,
  value,
  sub,
  icon,
  tone,
  spark,
  to,
  live,
}: {
  label: string;
  value: number;
  sub: ReactNode;
  icon: ReactNode;
  tone: 'primary' | 'critical' | 'success' | 'accent';
  spark: number[];
  to: string;
  live?: boolean;
}) {
  const shown = useCountUp(value);
  const ring = { primary: 'bg-primary-soft text-primary-ink', critical: 'bg-critical-soft text-critical', success: 'bg-success-soft text-success', accent: 'bg-accent-soft text-accent-ink' }[tone];
  return (
    <Link
      to={to}
      onPointerEnter={() => prefetch(to)}
      className="group rounded-2xl border border-line bg-surface p-4 shadow-1 transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-2"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('grid size-9 place-items-center rounded-xl [&_svg]:size-[18px]', ring)}>{icon}</span>
        <Sparkline data={spark} tone={tone} label={`${label}, last 14 days`} />
      </div>
      <p className="mt-3 text-[12.5px] font-medium text-muted">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-2">
        <span className="font-display-tight tabular text-[38px] leading-none text-ink">{shown}</span>
        {live && <span className="size-2 animate-pulse rounded-full bg-critical" aria-hidden />}
      </p>
      <p className="mt-1.5 flex items-center gap-1 text-[12.5px] text-ink-2">
        {sub}
        <ArrowRight className="ml-auto size-3.5 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
      </p>
    </Link>
  );
}

export default function Dashboard() {
  const st = useData();
  const lookup = useLookup();
  const { today, clashCounts, leaves, publications, changes, audit, facultyList, term } = st;
  const snap = latestSnapshot(st);

  const todayPubs = publications.filter((p) => p.date === today);
  const lastPub = todayPubs[todayPubs.length - 1];
  const draftsToday = changes.filter((c) => c.date === today && c.status === 'draft').length;
  const pending = leaves.filter((l) => l.status === 'Pending');

  const { entries, needCover } = useMemo(() => {
    const { engine, entries } = dayEngine(useData.getState(), today, true);
    const needCover = engine.list().filter((c) => c.type === 'faculty-leave');
    return { entries, needCover: needCover.map((c) => ({ clash: c, slot: engine.slots.get(c.slotIds[0])! })) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, changes, leaves, snap]);

  const workload = useMemo(() => computeWorkload(facultyList, snap.slots, leaves, changes, term, today), [facultyList, snap, leaves, changes, term, today]);
  const shortfall = workload.filter((w) => w.status === 'Shortfall').length;

  // The seeded history (1,500 entries) is built in idle time so it never delays the first paint.
  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  useEffect(() => idle(() => setHistory(auditHistory().slice(0, 7))), []);
  const recent = useMemo(() => (history ? [...audit, ...history].slice(0, 7) : null), [audit, history]);
  const nowMin = minutesIST();
  const perPeriod = ALL_PERIODS.map((p) => {
    const live = entries.filter((e) => e.period === p && e.status !== 'cancelled');
    const [h, m] = periodInfo(p).start.split(':').map(Number);
    const [eh, em] = periodInfo(p).end.split(':').map(Number);
    return { p, classes: live.length, rooms: new Set(live.map((e) => e.roomId).filter(Boolean)).size, now: nowMin >= h * 60 + m && nowMin < eh * 60 + em };
  });
  const maxClasses = Math.max(...perPeriod.map((x) => x.classes), 1);
  const hour = Number(fmtTimeIST(new Date().toISOString()).slice(0, 2));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <PageHeader
        eyebrow={fmtDate(today, 'EEEE, d MMMM yyyy')}
        title={`${greeting}, Timetable Committee`}
        docTitle="Dashboard"
        description={`${term.name}. The live master is v${snap.version}, published ${fmtStamp(snap.publishedAt)} by ${snap.publishedBy}. Students and faculty read that snapshot.`}
        actions={
          <>
            {lastPub ? (
              <StatusChip tone="success" live>
                Today published {fmtTimeIST(lastPub.publishedAt)} IST
              </StatusChip>
            ) : entries.length ? (
              <StatusChip tone="accent">Today not yet published</StatusChip>
            ) : (
              <StatusChip tone="neutral">No classes today</StatusChip>
            )}
            {draftsToday > 0 && <StatusChip tone="primary">{draftsToday} draft change{draftsToday > 1 ? 's' : ''} for today</StatusChip>}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Classes today"
          value={entries.filter((e) => e.status !== 'cancelled').length}
          sub={lastPub ? `${lastPub.changeIds.length} change(s) live since ${fmtTimeIST(lastPub.publishedAt)}` : 'Generated from master v' + snap.version}
          icon={<CalendarDays />}
          tone="primary"
          spark={[168, 172, 170, 166, 171, 158, 169, 173, 170, 167, 172, 160, 171, entries.length]}
          to="/committee/daily"
        />
        <Stat
          label="Open clashes in draft"
          value={clashCounts.critical + clashCounts.warning + clashCounts.advisory}
          sub={<span className={clashCounts.critical ? 'font-medium text-critical' : ''}>{clashCounts.critical} critical · publish {clashCounts.critical ? 'blocked' : 'ready'}</span>}
          icon={<ShieldAlert />}
          tone="critical"
          live={clashCounts.critical > 0}
          spark={[11, 9, 12, 8, 7, 9, 6, 7, 5, 6, 4, 5, 6, clashCounts.critical + clashCounts.warning + clashCounts.advisory]}
          to="/committee/builder"
        />
        <Stat
          label="Pending leave requests"
          value={pending.length}
          sub={pending.length ? `Oldest from ${lookup.faculty[pending[pending.length - 1].facultyId]?.name.split(' ').slice(-1)[0]}` : 'Queue is clear'}
          icon={<ClipboardCheck />}
          tone="accent"
          spark={[2, 1, 3, 2, 4, 2, 1, 3, 2, 2, 4, 3, 2, pending.length]}
          to="/committee/leave"
        />
        <Stat
          label="Workload alerts"
          value={shortfall}
          sub={`${shortfall} faculty below the expected hours`}
          icon={<TrendingDown />}
          tone="success"
          spark={[9, 9, 8, 8, 7, 8, 7, 6, 7, 6, 6, 5, 6, shortfall]}
          to="/committee/workload"
        />
      </div>

      <div className="render-lazy mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Today at a glance"
            description="Classes running in each period, from the published master with today's changes."
            icon={<CalendarCheck2 />}
            actions={
              <LinkButton to="/committee/daily" size="sm" variant="ghost">
                Open daily
              </LinkButton>
            }
          />
          <CardBody>
            {entries.length === 0 ? (
              <EmptyState icon={<CalendarDays />} title="No classes today">
                Sunday is a holiday. The next working day's timetable is ready in Daily Timetable.
              </EmptyState>
            ) : (
              <div className="flex h-40 items-end gap-2" role="img" aria-label={`Classes per period today: ${perPeriod.map((x) => `P${x.p} ${x.classes}`).join(', ')}`}>
                {perPeriod.map((x) => (
                  <div key={x.p} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="tabular text-[11.5px] font-semibold text-ink-2">{x.classes}</span>
                    <div
                      className={cn('w-full origin-bottom rounded-t-lg transition-transform duration-500', x.now ? 'bg-primary' : 'bg-primary-soft')}
                      style={{ height: `${Math.max(6, (x.classes / maxClasses) * 100)}%` }}
                    />
                    <span className={cn('text-[11px]', x.now ? 'font-semibold text-primary-ink' : 'text-muted')}>{x.now ? 'Now' : `P${x.p}`}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <UserRoundX className="size-4 text-critical" aria-hidden /> Needs cover today
              </p>
              {needCover.length === 0 ? (
                <p className="rounded-xl border border-success-line bg-success-soft px-3 py-2.5 text-[13px] text-success">Every class today has a teacher. Nothing to cover.</p>
              ) : (
                <ul className="space-y-1.5">
                  {needCover.map(({ clash, slot }) => (
                    <li key={clash.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-critical-line bg-critical-soft px-3 py-2 text-[13px]">
                      <span className="tabular font-semibold text-critical">P{slot.period}</span>
                      <span className="text-ink">
                        {lookup.subjects[slot.subjectId ?? '']?.code ?? slot.label} · {sectionShort(lookup, slot.sectionIds)}
                      </span>
                      <span className="text-ink-2">{lookup.faculty[slot.facultyId ?? '']?.name} is on leave</span>
                      <Link to="/committee/leave" className="ml-auto font-semibold text-primary-ink hover:underline">
                        Arrange cover
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader title="Quick actions" icon={<ArrowRight />} />
            <CardBody className="grid grid-cols-2 gap-2">
              {[
                { to: '/committee/builder', label: 'Resolve clashes', Icon: CalendarRange },
                { to: '/committee/daily', label: "Edit today's timetable", Icon: CalendarDays },
                { to: '/committee/leave', label: `Review leave (${pending.length})`, Icon: ClipboardCheck },
                { to: '/committee/rooms', label: 'Find a free room', Icon: Building2 },
                { to: '/committee/assistant', label: 'Ask the assistant', Icon: BotMessageSquare },
                { to: '/calculator', label: 'Open calculator', Icon: Calculator, external: true },
              ].map(({ to, label, Icon, external }) =>
                external ? (
                  <a key={to} href={to} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-2">
                    <Icon className="size-4 text-muted" aria-hidden />
                    {label}
                  </a>
                ) : (
                  <Link
                    key={to}
                    to={to}
                    onPointerEnter={() => prefetch(to)}
                    className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-2"
                  >
                    <Icon className="size-4 text-muted" aria-hidden />
                    {label}
                  </Link>
                ),
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Recent changes"
              icon={<History />}
              actions={
                <LinkButton to="/committee/audit" size="sm" variant="ghost">
                  Audit trail
                </LinkButton>
              }
            />
            <CardBody>
              {!recent && (
                <div className="space-y-3" aria-busy="true" aria-label="Loading recent changes">
                  {Array.from({ length: 7 }, (_, i) => (
                    <Skeleton key={i} className="h-[37px]" />
                  ))}
                </div>
              )}
              <ol className="relative space-y-3 border-l border-line pl-4">
                {recent?.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute top-1.5 -left-[21px] size-2 rounded-full border-2 border-surface bg-primary-ink" aria-hidden />
                    <p className="text-[13px] text-ink">
                      <span className="font-semibold">{a.action}</span> · <span className="text-ink-2">{a.entity}</span>
                    </p>
                    <p className="text-[11.5px] text-muted">
                      {a.user} · {fmtStamp(a.at)}
                    </p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
