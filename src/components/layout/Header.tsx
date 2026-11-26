import { GraduationCap, LayoutGrid, Moon, Search, Sun, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import type { Role } from '../../domain/types';
import { prefetch } from '../../routes';
import { useUi } from '../../store/ui';
import { cn } from '../../lib/util';
import { Kbd } from '../ui/Badge';

const ROLES: { id: Role; label: string; to: string; Icon: typeof Sun }[] = [
  { id: 'committee', label: 'Committee', to: '/committee', Icon: LayoutGrid },
  { id: 'faculty', label: 'Faculty', to: '/faculty', Icon: UserRound },
  { id: 'student', label: 'Student', to: '/student', Icon: GraduationCap },
];

function roleFromPath(path: string): Role | null {
  if (path.startsWith('/committee')) return 'committee';
  if (path.startsWith('/faculty')) return 'faculty';
  if (path.startsWith('/student')) return 'student';
  return null;
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 leading-none">
      <span aria-hidden className="grid size-8 place-items-center rounded-[9px] bg-primary font-display text-[17px] text-on-primary shadow-1">
        C
      </span>
      <span className="flex flex-col gap-1">
        <span className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="font-display text-[19px] tracking-[-0.01em] text-ink">{compact ? 'CMS' : 'CMS Business School'}</span>
          <span aria-hidden className="h-3.5 w-px self-center bg-line-strong" />
          <span className="text-[13px] font-semibold tracking-[-0.01em] text-ink-2">{compact ? 'Timetable' : 'Timetable Platform'}</span>
        </span>
        <span className="hidden text-[11px] tracking-[0.02em] text-muted sm:block">Lalbagh Campus</span>
      </span>
    </span>
  );
}

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const setRole = useUi((s) => s.setRole);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const active = roleFromPath(location.pathname);

  const switchRole = (r: Role) => {
    const target = ROLES.find((x) => x.id === r)!;
    setRole(r);
    navigate(target.to);
  };

  return (
    <header className="glass no-print sticky top-0 z-40 border-b border-line">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link to="/" aria-label="CMS Business School Timetable Platform, home" className="min-w-0 shrink rounded-lg">
          <span className="hidden sm:inline">
            <Wordmark />
          </span>
          <span className="sm:hidden">
            <Wordmark compact />
          </span>
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            onPointerEnter={() => void import('./CommandPalette')}
            className="hidden h-9 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[13px] whitespace-nowrap text-muted shadow-1 transition-colors hover:border-line-strong hover:text-ink lg:inline-flex"
          >
            <Search className="size-4" aria-hidden />
            <span className="w-32 text-left xl:w-44">Jump to anything…</span>
            <Kbd>Ctrl K</Kbd>
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
            className="grid size-9 place-items-center rounded-[10px] text-ink-2 hover:bg-surface-2 lg:hidden"
          >
            <Search className="size-[18px]" />
          </button>

          <div className="flex items-center gap-2 rounded-[12px] sm:border sm:border-line sm:bg-surface-2 sm:py-0.5 sm:pr-0.5 sm:pl-2.5">
            <span className="hidden text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-muted uppercase xl:inline">Demo mode</span>
            <div role="radiogroup" aria-label="Demo mode: switch role" className="hidden items-center gap-0.5 sm:flex">
              {ROLES.map(({ id, label, to, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active === id}
                  onClick={() => switchRole(id)}
                  onPointerEnter={() => prefetch(to)}
                  onFocus={() => prefetch(to)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-[9px] px-2.5 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150',
                    active === id ? 'bg-surface text-ink shadow-1' : 'text-muted hover:text-ink',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <label className="sm:hidden">
              <span className="sr-only">Demo mode: switch role</span>
              <select
                value={active ?? ''}
                onChange={(e) => switchRole(e.target.value as Role)}
                className="h-8 max-w-[112px] rounded-[9px] border border-line bg-surface px-1.5 text-[12.5px] font-medium text-ink"
              >
                <option value="" disabled>
                  Demo role
                </option>
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Both icons render; CSS picks one from data-theme, so pre-rendered HTML always matches. */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle light or dark theme"
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            suppressHydrationWarning
            className="grid size-9 place-items-center rounded-[10px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Sun className="hidden size-[18px] dark:block" aria-hidden />
            <Moon className="size-[18px] dark:hidden" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
