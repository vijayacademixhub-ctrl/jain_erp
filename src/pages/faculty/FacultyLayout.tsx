import { CalendarDays, ClipboardList, Send } from 'lucide-react';
import { Suspense, useMemo } from 'react';
import { NavLink, Outlet } from 'react-router';
import { PageSkeleton } from '../../components/layout/PageSkeleton';
import { MotionProvider } from '../../components/MotionProvider';
import { Combobox } from '../../components/ui/Combobox';
import { cn } from '../../lib/util';
import { prefetch } from '../../routes';
import { useData } from '../../store/data';
import { useUi } from '../../store/ui';

const NAV = [
  { to: '/faculty', label: 'My timetable', Icon: CalendarDays },
  { to: '/faculty/leave', label: 'Apply for leave', Icon: Send },
  { to: '/faculty/history', label: 'My leave history', Icon: ClipboardList },
];

export default function FacultyLayout() {
  const facultyList = useData((s) => s.facultyList);
  const facultyId = useUi((s) => s.facultyId);
  const setFacultyId = useUi((s) => s.setFacultyId);
  const options = useMemo(
    () => facultyList.map((f) => ({ value: f.id, label: f.name, hint: f.type === 'External' ? `${f.area} · visiting` : f.area, keywords: `${f.short} ${f.email}` })),
    [facultyList],
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-5 pb-12 sm:px-6">
      <div className="no-print mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-1">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-accent-ink uppercase">Faculty Portal</p>
          <p className="text-[12px] text-muted">Demo mode: pick any faculty member, no login needed.</p>
        </div>
        <div className="w-full sm:ml-auto sm:w-80">
          <Combobox label="Viewing as faculty member" options={options} value={facultyId} onChange={setFacultyId} placeholder="Search faculty by name or area" />
        </div>
        <nav aria-label="Faculty portal" className="no-scrollbar flex w-full gap-1 overflow-x-auto">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/faculty'}
              onPointerEnter={() => prefetch(to)}
              className={({ isActive }) =>
                cn(
                  'inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] px-3 text-[13.5px] font-medium transition-colors',
                  isActive ? 'bg-primary-soft text-primary-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <MotionProvider>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </MotionProvider>
    </div>
  );
}
