import {
  Activity,
  BotMessageSquare,
  Building2,
  CalendarDays,
  CalendarRange,
  Calculator,
  ClipboardCheck,
  DatabaseBackup,
  ExternalLink,
  Gauge,
  History,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { PageSkeleton } from '../../components/layout/PageSkeleton';
import { MotionProvider } from '../../components/MotionProvider';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { cn } from '../../lib/util';
import { prefetch, prefetchOnIdle } from '../../routes';
import { useData } from '../../store/data';
import { toast } from '../../store/toast';

type NavItem = { to: string; label: string; Icon: typeof Activity; badge?: 'clashes' | 'leave' | 'drafts'; external?: boolean };

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Plan',
    items: [
      { to: '/committee', label: 'Dashboard', Icon: Gauge },
      { to: '/committee/builder', label: 'Master Builder', Icon: CalendarRange, badge: 'clashes' },
      { to: '/committee/daily', label: 'Daily Timetable', Icon: CalendarDays, badge: 'drafts' },
    ],
  },
  {
    label: 'People & rooms',
    items: [
      { to: '/committee/leave', label: 'Leave Approvals', Icon: ClipboardCheck, badge: 'leave' },
      { to: '/committee/workload', label: 'Workload', Icon: Activity },
      { to: '/committee/rooms', label: 'Rooms & Booking', Icon: Building2 },
      { to: '/calculator', label: 'Calculator', Icon: Calculator, external: true },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/committee/assistant', label: 'Assistant', Icon: BotMessageSquare },
      { to: '/committee/upload', label: 'Data Upload', Icon: Upload },
      { to: '/committee/audit', label: 'Audit Trail', Icon: History },
      { to: '/committee/backup', label: 'Backup & Year-End', Icon: DatabaseBackup },
    ],
  },
];

function useBadge(kind: NavItem['badge']): { n: number; tone: string } | null {
  const critical = useData((s) => s.clashCounts.critical);
  const pending = useData((s) => s.leaves.filter((l) => l.status === 'Pending').length);
  const drafts = useData((s) => s.changes.filter((c) => c.status === 'draft' && c.date >= s.today).length);
  if (kind === 'clashes' && critical) return { n: critical, tone: 'bg-critical text-white dark:text-[#1a0503]' };
  if (kind === 'leave' && pending) return { n: pending, tone: 'bg-accent-soft text-accent-ink' };
  if (kind === 'drafts' && drafts) return { n: drafts, tone: 'bg-primary-soft text-primary-ink' };
  return null;
}

function NavEntry({ item, compact }: { item: NavItem; compact?: boolean }) {
  const badge = useBadge(item.badge);
  const { to, label, Icon, external } = item;
  const cls = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group flex items-center gap-2.5 rounded-[10px] text-[13.5px] font-medium transition-colors duration-150',
      compact ? 'h-9 shrink-0 px-3 whitespace-nowrap' : 'h-9 px-2.5',
      isActive && !external ? 'bg-surface text-ink shadow-1 ring-1 ring-line' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
    );
  const inner = (
    <>
      <Icon className="size-4 shrink-0 text-muted group-hover:text-ink-2" aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      {badge && <span className={cn('tabular grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold', badge.tone)}>{badge.n}</span>}
      {external && <ExternalLink className="size-3.5 text-muted" aria-label="opens in a new tab" />}
    </>
  );
  if (external) {
    return (
      <a href={to} target="_blank" rel="noopener" className={cls({ isActive: false })} onPointerEnter={() => prefetch(to)}>
        {inner}
      </a>
    );
  }
  return (
    <NavLink to={to} end={to === '/committee'} className={cls} onPointerEnter={() => prefetch(to)} onFocus={() => prefetch(to)}>
      {inner}
    </NavLink>
  );
}

export default function CommitteeLayout() {
  const refreshed = useData((s) => s.refreshedFromSeed);
  const resetDemo = useData((s) => s.resetDemo);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (refreshed) toast.info('Demo data refreshed for today', 'Dates and scenarios were regenerated so "today" matches the calendar.');
    prefetchOnIdle(['/committee/builder', '/committee/daily', '/committee/leave']);
  }, [refreshed]);

  return (
    <MotionProvider>
    <div className="mx-auto flex w-full max-w-[1600px] gap-6 px-4 pt-4 pb-10 sm:px-6 lg:pt-6">
      <aside aria-label="Committee navigation" className="no-print sticky top-[88px] hidden h-[calc(100dvh-110px)] w-[228px] shrink-0 flex-col lg:flex">
        <nav className="flex-1 space-y-5 overflow-y-auto pr-1">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{g.label}</p>
              <div className="space-y-0.5">
                {g.items.map((it) => (
                  <NavEntry key={it.to} item={it} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-4 rounded-xl border border-dashed border-line-strong p-3">
          <p className="text-[12px] leading-snug text-muted">Demo data is generated locally and saved in this browser.</p>
          <Button size="sm" variant="ghost" className="mt-2 -ml-1.5" icon={<RotateCcw />} onClick={() => setConfirmReset(true)}>
            Reset demo data
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <nav aria-label="Committee navigation" className="no-print no-scrollbar -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 pb-3 lg:hidden">
          {GROUPS.flatMap((g) => g.items).map((it) => (
            <NavEntry key={it.to} item={it} compact />
          ))}
          <button type="button" onClick={() => setConfirmReset(true)} className="flex h-9 shrink-0 items-center gap-2 rounded-[10px] px-3 text-[13.5px] font-medium text-ink-2 hover:bg-surface-2">
            <RotateCcw className="size-4 text-muted" aria-hidden /> Reset
          </button>
        </nav>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </div>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demo data?"
        description="Restores the seeded timetable, leave requests, bookings and scenarios. Your changes in this browser will be cleared."
        icon={<RotateCcw />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Keep my changes
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                resetDemo();
                setConfirmReset(false);
                toast.success('Demo data restored', 'All five demo scenarios are back in the master draft.');
              }}
            >
              Reset demo
            </Button>
          </>
        }
      />
    </div>
    </MotionProvider>
  );
}
