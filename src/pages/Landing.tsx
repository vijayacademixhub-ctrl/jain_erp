import { ArrowRight, CalendarCheck2, GraduationCap, LayoutGrid, ShieldCheck, UserRound, Zap } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { prefetch, prefetchOnIdle } from '../routes';
import { useUi } from '../store/ui';
import type { Role } from '../domain/types';

const ENTRIES: {
  role: Role;
  to: string;
  title: string;
  kicker: string;
  body: string;
  points: string[];
  Icon: typeof LayoutGrid;
  cta: string;
}[] = [
  {
    role: 'committee',
    to: '/committee',
    title: 'Committee Console',
    kicker: 'Timetable Committee',
    body: 'Build the master timetable with live clash detection, run the day, approve leave and keep every change on the record.',
    points: ['Drag-and-drop master builder', 'Clashes caught as you type', 'Daily changes, undo publish'],
    Icon: LayoutGrid,
    cta: 'Open console',
  },
  {
    role: 'faculty',
    to: '/faculty',
    title: 'Faculty Portal',
    kicker: 'For faculty members',
    body: 'See every class across semesters in one view, add it to your calendar and apply for leave in under a minute.',
    points: ['Merged weekly timetable', 'Calendar (.ics) export', 'Leave with mail tracking'],
    Icon: UserRound,
    cta: 'Open portal',
  },
  {
    role: 'student',
    to: '/student',
    title: 'Student View',
    kicker: 'No login needed',
    body: 'Pick your programme, semester and section once. Today comes first, and every change is flagged before you walk in.',
    points: ['Today first, then the week', 'Changed-class banners', 'Installable on your phone'],
    Icon: GraduationCap,
    cta: 'View timetable',
  },
];

const MINI = [
  ['FA', 'PM', 'BE', 'BC'],
  ['BM', '', 'FA', 'DF'],
  ['PM', 'BC', '!', 'BE'],
];

export function Landing() {
  const setRole = useUi((s) => s.setRole);
  useEffect(() => {
    document.title = 'CMS Business School | Timetable Platform';
    prefetchOnIdle(['/committee', '/student']);
  }, []);

  return (
    <div className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_70%_0%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_70%)]" />
      <section className="relative mx-auto grid w-full max-w-[1200px] gap-10 px-4 pt-12 pb-10 sm:px-6 md:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2 shadow-1">
            <span className="size-1.5 rounded-full bg-success" aria-hidden />
            Odd semester timetable is live · Lalbagh Campus
          </p>
          <h1 className="font-display-tight mt-5 text-[44px] leading-[1.02] text-ink sm:text-[58px] lg:text-[64px]">
            One timetable.
            <br />
            <span className="text-primary-ink">Zero clashes.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
            The Integrated Timetable Management Platform for CMS Business School, Jain (Deemed-to-be) University. One source of truth for the Timetable
            Committee, faculty and more than 2,000 students across three shifts.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/committee"
              onClick={() => setRole('committee')}
              onPointerEnter={() => prefetch('/committee')}
              className="inline-flex h-11 items-center gap-2 rounded-[11px] bg-primary px-5 text-[15px] font-medium text-on-primary shadow-2 transition-colors hover:bg-primary-hover"
            >
              Open Committee Console <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              to="/student"
              onClick={() => setRole('student')}
              onPointerEnter={() => prefetch('/student')}
              className="inline-flex h-11 items-center gap-2 rounded-[11px] border border-line bg-surface px-5 text-[15px] font-medium text-ink shadow-1 transition-colors hover:border-line-strong"
            >
              I'm a student
            </Link>
          </div>
          <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-line pt-6">
            {[
              ['2,000+', 'daily users'],
              ['< 5 ms', 'per clash check'],
              ['3', 'shifts, Mon to Sat'],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="font-display-tight text-[28px] leading-none text-ink">{v}</dd>
                <dd className="mt-1.5 text-xs text-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div aria-hidden className="relative hidden lg:block">
          <div className="rotate-[-1.5deg] rounded-2xl border border-line bg-surface p-4 shadow-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">BBA Sem 1 · A</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-critical-line bg-critical-soft px-2 py-0.5 text-[11px] font-medium text-critical">1 critical</span>
            </div>
            <div className="grid grid-cols-[34px_repeat(4,1fr)] gap-1.5 text-[11px]">
              <span />
              {['P1', 'P2', 'P3', 'P4'].map((p) => (
                <span key={p} className="text-center font-medium text-muted">
                  {p}
                </span>
              ))}
              {MINI.map((row, r) => (
                <div key={r} className="contents">
                  <span className="self-center font-medium text-muted">{['Mon', 'Tue', 'Wed'][r]}</span>
                  {row.map((c, i) =>
                    c === '!' ? (
                      <span key={i} className="clash-pulse grid h-12 place-items-center rounded-lg border border-critical-line bg-critical-soft font-semibold text-critical">
                        Clash
                      </span>
                    ) : c ? (
                      <span key={i} className="grid h-12 place-items-center rounded-lg border border-line bg-primary-soft font-semibold text-primary-ink">
                        {c}
                      </span>
                    ) : (
                      <span key={i} className="h-12 rounded-lg border border-dashed border-line-strong" />
                    ),
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-critical-line bg-critical-soft px-3 py-2 text-[11.5px] leading-snug text-critical">
              Faculty is already in Semester 5, Section B, Period 1, Room 305.
            </div>
          </div>
          <div className="absolute -bottom-6 -left-8 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[12px] shadow-2">
            <ShieldCheck className="size-4 text-success" />
            Publish blocked until 0 critical
          </div>
          <div className="absolute -top-5 right-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[12px] shadow-2">
            <Zap className="size-4 text-accent" />
            Checked in 0.1 ms
          </div>
        </div>
      </section>

      <section aria-labelledby="entry-heading" className="relative mx-auto w-full max-w-[1200px] px-4 pb-20 sm:px-6">
        <h2 id="entry-heading" className="sr-only">
          Choose where to start
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {ENTRIES.map(({ role, to, title, kicker, body, points, Icon, cta }) => (
            <Link
              key={role}
              to={to}
              onClick={() => setRole(role)}
              onPointerEnter={() => prefetch(to)}
              onFocus={() => prefetch(to)}
              className="group relative flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-1 transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-2"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary-ink">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">{kicker}</span>
              </div>
              <h3 className="font-display-tight mt-5 text-[28px] leading-tight text-ink">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{body}</p>
              <ul className="mt-4 space-y-1.5 text-[13px] text-ink-2">
                {points.map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <CalendarCheck2 className="size-3.5 text-accent" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
              <span className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary-ink">
                {cta}
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
