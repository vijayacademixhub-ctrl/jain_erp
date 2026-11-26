import { BadgeCheck, Calculator as CalcIcon, Download, Moon, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Wordmark } from '../components/layout/Header';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState, Segmented, Switch, Tabs } from '../components/ui/Controls';
import { Toaster } from '../components/ui/Toaster';
import { computeCalculator } from '../domain/calculator';
import { EXCLUDED_LABELS, FIXED_LABEL_NAMES } from '../domain/constants';
import type { Program, Semester } from '../domain/types';
import { addDaysISO, fmtDate, weekStartOf } from '../lib/dates';
import { useCountUp } from '../lib/hooks';
import { cn, downloadFile, toCSV } from '../lib/util';
import { engineRefs, latestSnapshot, useData } from '../store/data';
import { toast } from '../store/toast';
import { useUi } from '../store/ui';

type View = 'cohorts' | 'teachers' | 'subjects' | 'sections' | 'tests' | 'excluded';

export default function CalculatorPage() {
  const snapshots = useData((s) => s.snapshots);
  const changes = useData((s) => s.changes);
  const today = useData((s) => s.today);
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const [program, setProgram] = useState<Program>('BBA');
  const [sems, setSems] = useState<Semester[]>([3, 5]);
  const [sem1, setSem1] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [applyChanges, setApplyChanges] = useState(true);
  const [view, setView] = useState<View>('cohorts');
  const snap = latestSnapshot({ snapshots });
  const weekStart = addDaysISO(weekStartOf(today), weekOffset * 7);

  useEffect(() => {
    document.title = 'Teaching-hours calculator · CMS Timetable Platform';
  }, []);

  const result = useMemo(
    () => computeCalculator({ program, semesters: sems, includeSem1: sem1, slots: snap.slots, changes, weekStart, applyChanges, refs: engineRefs() }),
    [program, sems, sem1, snap, changes, weekStart, applyChanges],
  );

  const toggleSem = (s: Semester) => setSems((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s].sort()));

  const exportView = () => {
    let rows: (string | number)[][] = [];
    if (view === 'cohorts') rows = [['Section', 'Subject code', 'Subject', 'Teacher', 'Visiting', 'Hours', 'Substituted hours'], ...result.cohorts.map((c) => [c.section, c.subjectCode, c.subjectName, c.teacher, c.external ? 'Yes' : 'No', c.hours, c.substituted])];
    if (view === 'teachers') rows = [['Teacher', 'Visiting', 'Weekly hours', 'Cohorts'], ...result.teachers.map((t) => [t.name, t.external ? 'Yes' : 'No', t.hours, t.cohorts])];
    if (view === 'subjects') rows = [['Code', 'Subject', 'Hours', 'Cohorts'], ...result.subjects.map((s) => [s.code, s.name, s.hours, s.cohorts])];
    if (view === 'sections') rows = [['Section', 'Teaching hours'], ...result.sections.map((s) => [s.label, s.hours])];
    if (view === 'tests') rows = [['Section', 'Session', 'Hours'], ...result.unitTests.map((u) => [u.section, u.label, u.hours])];
    if (view === 'excluded') rows = [['Session', 'Count', 'Sections'], ...result.excluded.map((x) => [x.label, x.sessions, x.sections.join(' ')])];
    downloadFile(`calculator-${program}-${view}-${weekStart}.csv`, toCSV(rows), 'text/csv');
    toast.success('Table exported', `${rows.length - 1} rows saved as CSV.`);
  };

  return (
    <div className="min-h-dvh">
      <header className="glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="rounded-lg" aria-label="Home">
            <Wordmark compact />
          </Link>
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-2 sm:inline-flex">
            <CalcIcon className="size-3.5" aria-hidden /> Calculator window
          </span>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="ml-auto grid size-9 place-items-center rounded-[10px] text-ink-2 hover:bg-surface-2"
          >
            {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        <p className="text-[11.5px] font-semibold tracking-[0.08em] text-accent-ink uppercase">Timetable Committee</p>
        <h1 className="font-display-tight mt-1 text-[36px] leading-tight text-ink sm:text-[42px]">Teaching-hours calculator</h1>
        <p className="mt-2 max-w-3xl text-[14.5px] text-ink-2">
          Weekly hours from published master v{snap.version}
          {applyChanges ? ', with the week’s published daily changes applied' : ''}. Pick semesters, then switch between cohort, teacher, subject and section views.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-1">
          <Tabs<Program>
            label="Programme"
            value={program}
            onChange={setProgram}
            items={[
              { id: 'BBA', label: 'BBA' },
              { id: 'WOW', label: 'WOW' },
            ]}
          />
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Semesters</legend>
            <span className="text-[13px] font-medium text-ink-2">Semesters</span>
            {([3, 5] as Semester[]).map((s) => (
              <label key={s} className={cn('inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-[13px] font-medium', sems.includes(s) ? 'border-primary-ink bg-primary-soft text-primary-ink' : 'border-line text-ink-2')}>
                <input type="checkbox" className="accent-[var(--primary)]" checked={sems.includes(s)} onChange={() => toggleSem(s)} />
                Sem {s}
              </label>
            ))}
          </fieldset>
          <Switch label="Semester 1" description="Starts after induction; counted separately" checked={sem1} onChange={setSem1} />
          <Segmented<number>
            label="Week"
            value={weekOffset}
            onChange={setWeekOffset}
            options={[
              { value: -1, label: 'Last week' },
              { value: 0, label: 'This week' },
            ]}
          />
          <Switch label="Apply daily changes" description={`Week of ${fmtDate(weekStart, 'd MMM')}`} checked={applyChanges} onChange={setApplyChanges} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Tile label="Teaching hours / week" value={result.totals.teachingHours} />
          <Tile label="Cohorts" value={result.totals.cohorts} />
          <Tile label="Teachers" value={result.totals.teachers} />
          <Tile label="Visiting faculty hours" value={result.totals.externalHours} accent />
          <Tile label="Unit test hours" value={result.totals.unitTestHours} />
          <Tile label="Excluded sessions" value={result.totals.excludedSessions} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3">
              <Tabs<View>
                label="Calculator view"
                value={view}
                onChange={setView}
                size="sm"
                items={[
                  { id: 'cohorts', label: 'Cohorts', count: result.cohorts.length },
                  { id: 'teachers', label: 'Teacher-wise', count: result.teachers.length },
                  { id: 'subjects', label: 'Subject-wise', count: result.subjects.length },
                  { id: 'sections', label: 'Section-wise', count: result.sections.length },
                  { id: 'tests', label: 'Unit tests', count: result.unitTests.length },
                  { id: 'excluded', label: 'Excluded', count: result.excluded.length },
                ]}
              />
              <Button size="sm" variant="secondary" icon={<Download />} onClick={exportView} className="ml-auto">
                Export CSV
              </Button>
            </div>
            <div className="max-h-[620px] overflow-auto border-t border-line">
              {result.semesters.length === 0 ? (
                <EmptyState icon={<CalcIcon />} title="No semester selected">
                  Tick Semester 3 or 5, or switch on Semester 1.
                </EmptyState>
              ) : (
                <CalcTable view={view} result={result} />
              )}
            </div>
          </Card>
          <Card className="self-start p-4">
            <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
              <BadgeCheck className="size-4 text-success" aria-hidden /> Rules applied
            </p>
            <ul className="mt-3 space-y-2.5 text-[12.5px] text-ink-2">
              <li>
                <strong className="text-ink">One hour per period.</strong> A combined class is one hour for the teacher.
              </li>
              <li>
                <strong className="text-ink">Cohort = Section + Subject + Teacher.</strong> Electives use the semester pool as the section.
              </li>
              <li>
                <strong className="text-ink">Substitution credit goes to the actual teacher</strong> when daily changes are applied.
              </li>
              <li>
                <strong className="text-ink">"IR" is never dropped.</strong> Industrial Relations counts like any subject; exclusions match whole session names only.
              </li>
              <li>
                <strong className="text-ink">Unit tests</strong> are reported separately.
              </li>
            </ul>
            <p className="mt-4 text-[12px] font-semibold text-muted">Excluded sessions</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {EXCLUDED_LABELS.map((l) => (
                <Badge key={l} tone="neutral">
                  <span title={FIXED_LABEL_NAMES[l]}>{l}</span>
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  const shown = useCountUp(value, 500);
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-1">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={cn('font-display-tight tabular mt-0.5 text-[30px] leading-none', accent ? 'text-accent-ink' : 'text-ink')}>{shown}</p>
    </div>
  );
}

const th = 'sticky top-0 z-10 bg-grid-head px-4 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase';
const td = 'px-4 py-2 text-[13px] text-ink-2 border-t border-line';

function CalcTable({ view, result }: { view: View; result: ReturnType<typeof computeCalculator> }) {
  if (view === 'cohorts')
    return (
      <table className="w-full min-w-[640px] border-collapse">
        <caption className="sr-only">Cohorts: section, subject and teacher with weekly hours</caption>
        <thead>
          <tr>
            {['Section', 'Subject', 'Teacher', 'Hours'].map((h) => (
              <th key={h} scope="col" className={cn(th, h === 'Hours' && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.cohorts.map((c) => (
            <tr key={c.key} className="hover:bg-surface-2/60">
              <td className={cn(td, 'font-medium text-ink')}>{c.section}</td>
              <td className={td}>
                <span className={cn('font-semibold', c.subjectCode === 'IR' ? 'text-accent-ink' : 'text-ink')}>{c.subjectCode}</span> · {c.subjectName}
              </td>
              <td className={td}>
                {c.teacher}
                {c.external && (
                  <Badge tone="accent" className="ml-1.5">
                    Visiting
                  </Badge>
                )}
                {c.substituted > 0 && (
                  <Badge tone="primary" className="ml-1.5">
                    {c.substituted} as substitute
                  </Badge>
                )}
              </td>
              <td className={cn(td, 'tabular text-right font-semibold text-ink')}>{c.hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  if (view === 'teachers')
    return (
      <table className="w-full min-w-[520px] border-collapse">
        <caption className="sr-only">Teacher-wise weekly hours</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              Teacher
            </th>
            <th scope="col" className={cn(th, 'text-right')}>
              Cohorts
            </th>
            <th scope="col" className={cn(th, 'text-right')}>
              Hours / week
            </th>
          </tr>
        </thead>
        <tbody>
          {result.teachers.map((t) => (
            <tr key={t.id} className="hover:bg-surface-2/60">
              <td className={cn(td, 'font-medium text-ink')}>
                {t.name}
                {t.external && (
                  <Badge tone="accent" className="ml-1.5">
                    Visiting
                  </Badge>
                )}
              </td>
              <td className={cn(td, 'tabular text-right')}>{t.cohorts}</td>
              <td className={cn(td, 'tabular text-right font-semibold text-ink')}>{t.hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  if (view === 'subjects')
    return (
      <table className="w-full min-w-[520px] border-collapse">
        <caption className="sr-only">Subject-wise weekly hours</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              Subject
            </th>
            <th scope="col" className={cn(th, 'text-right')}>
              Cohorts
            </th>
            <th scope="col" className={cn(th, 'text-right')}>
              Hours / week
            </th>
          </tr>
        </thead>
        <tbody>
          {result.subjects.map((s) => (
            <tr key={s.code} className="hover:bg-surface-2/60">
              <td className={td}>
                <span className={cn('font-semibold', s.code === 'IR' ? 'text-accent-ink' : 'text-ink')}>{s.code}</span> · {s.name}
                {s.code === 'IR' && (
                  <Badge tone="success" className="ml-1.5">
                    Kept
                  </Badge>
                )}
              </td>
              <td className={cn(td, 'tabular text-right')}>{s.cohorts}</td>
              <td className={cn(td, 'tabular text-right font-semibold text-ink')}>{s.hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  if (view === 'sections')
    return (
      <table className="w-full min-w-[420px] border-collapse">
        <caption className="sr-only">Section-wise weekly teaching hours</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              Section
            </th>
            <th scope="col" className={cn(th, 'text-right')}>
              Teaching hours / week
            </th>
          </tr>
        </thead>
        <tbody>
          {result.sections.map((s) => (
            <tr key={s.id} className="hover:bg-surface-2/60">
              <td className={cn(td, 'font-medium text-ink')}>{s.label}</td>
              <td className={cn(td, 'tabular text-right font-semibold text-ink')}>{s.hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  if (view === 'tests')
    return result.unitTests.length === 0 ? (
      <EmptyState icon={<CalcIcon />} title="No unit tests this week" />
    ) : (
      <table className="w-full min-w-[420px] border-collapse">
        <caption className="sr-only">Unit tests</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              Section
            </th>
            <th scope="col" className={th}>
              Session
            </th>
            <th scope="col" className={cn(th, 'text-right')}>
              Hours
            </th>
          </tr>
        </thead>
        <tbody>
          {result.unitTests.map((u) => (
            <tr key={u.section}>
              <td className={cn(td, 'font-medium text-ink')}>{u.section}</td>
              <td className={td}>{u.label}</td>
              <td className={cn(td, 'tabular text-right font-semibold text-ink')}>{u.hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  return result.excluded.length === 0 ? (
    <EmptyState icon={<CalcIcon />} title="No excluded sessions in scope" />
  ) : (
    <table className="w-full min-w-[520px] border-collapse">
      <caption className="sr-only">Excluded sessions, not counted as teaching hours</caption>
      <thead>
        <tr>
          <th scope="col" className={th}>
            Session
          </th>
          <th scope="col" className={cn(th, 'text-right')}>
            Count
          </th>
          <th scope="col" className={th}>
            Sections
          </th>
        </tr>
      </thead>
      <tbody>
        {result.excluded.map((x) => (
          <tr key={x.label}>
            <td className={cn(td, 'font-medium text-ink')}>
              {x.label} <span className="font-normal text-muted">· {FIXED_LABEL_NAMES[x.label as keyof typeof FIXED_LABEL_NAMES]}</span>
            </td>
            <td className={cn(td, 'tabular text-right font-semibold text-ink')}>{x.sessions}</td>
            <td className={cn(td, 'text-[12px]')}>{x.sections.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
