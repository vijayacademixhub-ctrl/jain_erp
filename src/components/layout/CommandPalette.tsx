import { m } from 'framer-motion';
import { Building2, CornerDownLeft, LayoutGrid, Moon, Search, UserRound, Users, Volume2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useFocusTrap } from '../../lib/hooks';
import { MotionProvider } from '../MotionProvider';
import { cn } from '../../lib/util';
import { useData } from '../../store/data';
import { toast } from '../../store/toast';
import { useUi } from '../../store/ui';
import { Kbd } from '../ui/Badge';

interface Item {
  id: string;
  group: 'Pages' | 'Sections' | 'Faculty' | 'Rooms' | 'Actions';
  label: string;
  hint?: string;
  keywords: string;
  icon: ReactNode;
  run: () => void;
}

const PAGES: [string, string, string][] = [
  ['/committee', 'Dashboard', 'committee home overview'],
  ['/committee/builder', 'Master Timetable Builder', 'clashes publish grid drag'],
  ['/committee/daily', 'Daily Timetable', 'today swap substitution cancel'],
  ['/committee/leave', 'Leave Approvals', 'approve reject cover substitutes'],
  ['/committee/rooms', 'Rooms & Booking', 'free room book heatmap'],
  ['/committee/workload', 'Workload Tracker', 'hours target shortfall'],
  ['/calculator', 'Calculator', 'teaching hours cohort'],
  ['/committee/assistant', 'Committee Assistant', 'chat bot ai'],
  ['/committee/upload', 'Data Upload', 'excel csv import'],
  ['/committee/audit', 'Audit Trail', 'log history'],
  ['/committee/backup', 'Backup & Year-End', 'json export delete term'],
  ['/faculty', 'Faculty Portal · My Timetable', 'faculty ics'],
  ['/faculty/leave', 'Faculty Portal · Apply for Leave', 'leave mail'],
  ['/student', 'Student View', 'student today'],
];

function score(item: Item, q: string): number {
  if (!q) return 1;
  const label = item.label.toLowerCase();
  if (label.startsWith(q)) return 4;
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 3;
  if (label.includes(q)) return 2;
  if (item.keywords.includes(q)) return 1;
  return 0;
}

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const facultyList = useData((s) => s.facultyList);
  const sectionList = useData((s) => s.sectionList);
  const roomList = useData((s) => s.roomList);
  const ui = useUi();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  useFocusTrap(true, panel, onClose, input);

  const items = useMemo<Item[]>(() => {
    const go = (to: string) => () => (to === '/calculator' ? window.open(to, '_blank', 'noopener') : navigate(to));
    return [
      ...PAGES.map(([to, label, kw]) => ({ id: to, group: 'Pages' as const, label, keywords: kw, icon: <LayoutGrid />, run: go(to) })),
      ...sectionList.map((s) => ({
        id: s.id,
        group: 'Sections' as const,
        label: `${s.program} Sem ${s.semester} · Section ${s.name}`,
        hint: 'Open in builder',
        keywords: `${s.program.toLowerCase()} ${s.semester}${s.name.toLowerCase()} section`,
        icon: <Users />,
        run: () => {
          ui.setBuilder({ program: s.program, semester: s.semester, sectionId: s.id });
          navigate('/committee/builder');
        },
      })),
      ...facultyList.map((f) => ({
        id: f.id,
        group: 'Faculty' as const,
        label: f.name,
        hint: `${f.area}${f.type === 'External' ? ' · visiting' : ''}`,
        keywords: `${f.short.toLowerCase()} ${f.area.toLowerCase()} faculty`,
        icon: <UserRound />,
        run: () => {
          ui.setFacultyId(f.id);
          navigate('/faculty');
        },
      })),
      ...roomList.map((r) => ({
        id: r.id,
        group: 'Rooms' as const,
        label: r.name,
        hint: `${r.type} · ${r.capacity} seats`,
        keywords: `${r.type.toLowerCase()} room`,
        icon: <Building2 />,
        run: () => navigate('/committee/rooms'),
      })),
      { id: 'theme', group: 'Actions', label: ui.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', keywords: 'theme dark light mode', icon: <Moon />, run: () => ui.toggleTheme() },
      {
        id: 'sound',
        group: 'Actions',
        label: ui.muted ? 'Turn clash alert sound on' : 'Turn clash alert sound off',
        keywords: 'sound mute audio alert',
        icon: <Volume2 />,
        run: () => {
          ui.setMuted(!ui.muted);
          toast.info(ui.muted ? 'Clash alert sound on' : 'Clash alert sound off');
        },
      },
    ];
  }, [facultyList, sectionList, roomList, navigate, ui]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const scored = items.map((it) => ({ it, s: score(it, needle) })).filter((x) => x.s > 0);
    if (!needle) return scored.filter((x) => x.it.group === 'Pages' || x.it.group === 'Actions').map((x) => x.it);
    return scored.sort((a, b) => b.s - a.s).slice(0, 30).map((x) => x.it);
  }, [items, q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  const choose = (it: Item) => {
    onClose();
    it.run();
  };

  let lastGroup = '';
  return createPortal(
    <MotionProvider>
    <div className="fixed inset-0 z-[65] flex items-start justify-center px-4 pt-[12vh]">
      <m.div className="absolute inset-0 bg-[rgb(8_12_22/0.4)] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} aria-hidden />
      <m.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        initial={{ opacity: 0, y: -8, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-3"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-[18px] text-muted" aria-hidden />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-label="Search pages, sections, faculty and rooms"
            placeholder="Jump to a page, section, faculty member or room…"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter' && results[active]) {
                e.preventDefault();
                choose(results[active]);
              }
            }}
            className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-[13px] text-muted">Nothing matches "{q}".</li>}
          {results.map((it, i) => {
            const header = it.group !== lastGroup;
            lastGroup = it.group;
            return (
              <li key={`${it.group}-${it.id}`} role="presentation">
                {header && <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">{it.group}</p>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(it)}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-[13.5px]', i === active ? 'bg-primary-soft text-primary-ink' : 'text-ink')}
                >
                  <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-muted [&_svg]:size-3.5">{it.icon}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{it.label}</span>
                  {it.hint && <span className="shrink-0 text-[12px] text-muted">{it.hint}</span>}
                  {i === active && <CornerDownLeft className="size-3.5 shrink-0" aria-hidden />}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11.5px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>Enter</Kbd> open
          </span>
          <span className="ml-auto">Ctrl K anywhere</span>
        </div>
      </m.div>
    </div>
    </MotionProvider>,
    document.body,
  );
}
