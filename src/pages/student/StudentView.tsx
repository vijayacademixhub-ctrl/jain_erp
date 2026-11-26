import { AlertTriangle, CalendarDays, Clock, Download, FileText, MapPin, Settings2, Smartphone, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { EmptyState, Segmented } from '../../components/ui/Controls';
import { Select } from '../../components/ui/Field';
import { EntryChip } from '../../components/timetable/EntryChip';
import { slotText } from '../../components/timetable/slotDisplay';
import { DAY_INDEXES, DAY_SHORT, DAYS, PROGRAMS, SEMESTERS, SHIFTS, periodInfo } from '../../domain/constants';
import { CHANGE_LABEL, type DayEntry } from '../../domain/daily';
import type { Program, Semester } from '../../domain/types';
import { addDaysISO, fmtDate, fmtShort, fmtTimeIST, minutesIST, weekStartOf } from '../../lib/dates';
import { cn, downloadFile, toCSV } from '../../lib/util';
import { dayEntries, latestSnapshot, useData, useLookup } from '../../store/data';
import { toast } from '../../store/toast';
import { useUi, type StudentPrefs } from '../../store/ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export default function StudentView() {
  const prefs = useUi((s) => s.student);
  const [editing, setEditing] = useState(!prefs);
  return editing || !prefs ? <Setup initial={prefs} onDone={() => setEditing(false)} /> : <MyWeek prefs={prefs} onEdit={() => setEditing(true)} />;
}

function Setup({ initial, onDone }: { initial: StudentPrefs | null; onDone: () => void }) {
  const sectionList = useData((s) => s.sectionList);
  const subjectList = useData((s) => s.subjectList);
  const setStudent = useUi((s) => s.setStudent);
  const [program, setProgram] = useState<Program>(initial?.program ?? 'BBA');
  const [semester, setSemester] = useState<Semester>(initial?.semester ?? 3);
  const cohort = sectionList.filter((s) => s.program === program && s.semester === semester);
  const [sectionId, setSectionId] = useState(initial?.sectionId ?? cohort[0]?.id ?? '');
  const oes = subjectList.filter((s) => s.program === program && s.semester === semester && s.kind === 'OE');
  const mes = subjectList.filter((s) => s.program === program && s.semester === semester && s.kind === 'ME');
  const [oe, setOe] = useState<string>(initial?.oe ?? '');
  const [me, setMe] = useState<string>(initial?.me ?? '');
  const section = cohort.find((s) => s.id === sectionId) ?? cohort[0];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 pb-14 sm:px-6">
      <PageHeader eyebrow="Student View · no login" title="Find your timetable" docTitle="Student View" description="Choose once. Your choice is remembered on this device, so next time you go straight to today." />
      <Card>
        <CardBody className="space-y-5 pt-5">
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-2">Programme</p>
            <Segmented<Program> label="Programme" value={program} onChange={(p) => (setProgram(p), setSectionId(''), setOe(''), setMe(''))} options={PROGRAMS.map((p) => ({ value: p, label: p }))} />
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-2">Semester</p>
            <Segmented<Semester> label="Semester" value={semester} onChange={(s) => (setSemester(s), setSectionId(''), setOe(''), setMe(''))} options={SEMESTERS.map((s) => ({ value: s, label: `Semester ${s}` }))} />
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-2">Section</p>
            <Segmented<string> label="Section" value={section?.id ?? ''} onChange={setSectionId} options={cohort.map((s) => ({ value: s.id, label: `Section ${s.name}` }))} />
          </div>
          {(oes.length > 0 || mes.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {oes.length > 0 && (
                <div>
                  <label htmlFor="oe" className="mb-1.5 block text-[13px] font-medium text-ink-2">
                    Open elective
                  </label>
                  <Select id="oe" value={oe} onChange={(e) => setOe(e.target.value)}>
                    <option value="">I'll choose later</option>
                    {oes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              {mes.length > 0 && (
                <div>
                  <label htmlFor="me" className="mb-1.5 block text-[13px] font-medium text-ink-2">
                    Minor elective
                  </label>
                  <Select id="me" value={me} onChange={(e) => setMe(e.target.value)}>
                    <option value="">I'll choose later</option>
                    {mes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          )}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!section}
            onClick={() => {
              setStudent({ program, semester, sectionId: section!.id, oe: oe || null, me: me || null });
              onDone();
            }}
          >
            Show my timetable
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

function MyWeek({ prefs, onEdit }: { prefs: StudentPrefs; onEdit: () => void }) {
  const today = useData((s) => s.today);
  const snapshots = useData((s) => s.snapshots);
  const changes = useData((s) => s.changes);
  const publications = useData((s) => s.publications);
  const lookup = useLookup();
  const section = lookup.sections[prefs.sectionId];
  const snap = latestSnapshot({ snapshots });
  const [weekOffset, setWeekOffset] = useState(0);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [now, setNow] = useState(() => minutesIST());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const t = setInterval(() => setNow(minutesIST()), 60_000);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      clearInterval(t);
    };
  }, []);

  const week = addDaysISO(weekStartOf(today), weekOffset * 7);

  // Students read the published snapshot and published changes only.
  const filterMine = (list: DayEntry[]): DayEntry[] => {
    const mine = list.filter((e) => e.sectionIds.includes(prefs.sectionId));
    const out: DayEntry[] = [];
    const groups = new Map<string, DayEntry[]>();
    for (const e of mine) {
      if (e.group) groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
      else out.push(e);
    }
    for (const g of groups.values()) {
      const chosenId = g[0].kind === 'OE' ? prefs.oe : prefs.me;
      const pick = g.find((e) => e.subjectId === chosenId);
      out.push(pick ?? { ...g[0], key: `${g[0].group}-any`, subjectId: undefined, label: g[0].kind === 'OE' ? 'Open elective' : 'Minor elective', facultyId: undefined, roomId: undefined });
    }
    return out.sort((a, b) => a.period - b.period);
  };

  const days = useMemo(
    () => DAY_INDEXES.map((d) => ({ d, date: addDaysISO(week, d), entries: filterMine(dayEntries({ snapshots, changes }, addDaysISO(week, d), false)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [week, snapshots, changes, prefs],
  );
  const todayEntries = useMemo(() => filterMine(dayEntries({ snapshots, changes }, today, false)), [today, snapshots, changes, prefs]); // eslint-disable-line react-hooks/exhaustive-deps
  const todayChanges = todayEntries.filter((e) => e.status !== 'normal');
  const weekChanges = days.flatMap((x) => x.entries.filter((e) => e.status !== 'normal').map((e) => ({ ...x, e })));
  const lastPub = publications.filter((p) => p.date === today).slice(-1)[0];
  const shiftPeriods = SHIFTS[section.shift].periods;
  const next = todayEntries.find((e) => e.status !== 'cancelled' && toMin(periodInfo(e.period).start) > now);

  const exportCsv = () => {
    const rows: (string | number)[][] = [['Day', 'Date', 'Period', 'Time', 'Subject', 'Faculty', 'Room', 'Status']];
    for (const { d, date, entries } of days) {
      for (const e of entries) {
        const t = slotText(e, lookup);
        rows.push([DAYS[d], date, `P${e.period}`, `${periodInfo(e.period).start}-${periodInfo(e.period).end}`, t.title, t.faculty, t.room, e.status === 'normal' ? '' : e.status]);
      }
    }
    downloadFile(`timetable-${section.program}${section.semester}${section.name}-${week}.csv`, toCSV(rows), 'text/csv');
    toast.success('Timetable downloaded', 'Opens in Excel or Google Sheets.');
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-6 pb-14 sm:px-6">
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div className="min-w-[min(100%,20rem)] flex-1">
          <p className="text-[11.5px] font-semibold tracking-[0.08em] text-accent-ink uppercase">Student View</p>
          <h1 className="font-display-tight text-[34px] leading-tight text-ink sm:text-[40px]">
            {section.program} Semester {section.semester} · Section {section.name}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {SHIFTS[section.shift].name} ({SHIFTS[section.shift].start}–{SHIFTS[section.shift].end})
            {prefs.oe && ` · OE: ${lookup.subjects[prefs.oe]?.name}`}
            {prefs.me && ` · ME: ${lookup.subjects[prefs.me]?.name}`}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" icon={<Settings2 />} onClick={onEdit}>
            Change
          </Button>
          <Button variant="secondary" size="sm" icon={<Download />} onClick={exportCsv}>
            Excel
          </Button>
          <Button variant="secondary" size="sm" icon={<FileText />} onClick={() => window.print()}>
            PDF
          </Button>
          {installEvt && (
            <Button
              variant="subtle"
              size="sm"
              icon={<Smartphone />}
              onClick={async () => {
                await installEvt.prompt();
                setInstallEvt(null);
              }}
            >
              Install app
            </Button>
          )}
        </div>
      </div>

      {(todayChanges.length > 0 || weekChanges.length > 0) && (
        <div role="status" className="mb-5 rounded-2xl border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-accent-soft px-4 py-3">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-accent-ink">
            <AlertTriangle className="size-4" aria-hidden />
            Changed: {todayChanges.length ? `${todayChanges.length} change${todayChanges.length > 1 ? 's' : ''} today` : `${weekChanges.length} change${weekChanges.length > 1 ? 's' : ''} this week`}
          </p>
          <ul className="mt-1.5 space-y-1 text-[13px] text-ink">
            {(todayChanges.length ? todayChanges.map((e) => ({ date: today, e })) : weekChanges).slice(0, 4).map(({ date, e }) => {
              const t = slotText(e, lookup);
              const what =
                e.status === 'cancelled'
                  ? 'cancelled'
                  : e.status === 'added'
                    ? `added (${CHANGE_LABEL[e.changeTypes[0]].toLowerCase()})`
                    : e.changeTypes.map((c) => (c === 'room-change' ? `moved to ${t.room}` : c === 'substitution' ? `taken by ${t.faculty}` : c === 'swap' ? `now in P${e.period}` : CHANGE_LABEL[c])).join(', ');
              return (
                <li key={`${date}-${e.key}`}>
                  <span className="font-semibold">
                    {date === today ? '' : `${fmtDate(date, 'EEE')} `}P{e.period} {t.code}
                  </span>{' '}
                  {what}
                  {e.reason ? <span className="text-ink-2">: {e.reason}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <section aria-labelledby="today-h" className="mb-7">
        <h2 id="today-h" className="mb-3 flex items-baseline gap-2 text-[17px] font-semibold text-ink">
          Today <span className="text-[13px] font-normal text-muted">{fmtDate(today, 'EEEE d MMMM')}</span>
        </h2>
        {todayEntries.length === 0 ? (
          <Card>
            <EmptyState icon={<CalendarDays />} title="No classes today">
              Enjoy the day. Your week is below.
            </EmptyState>
          </Card>
        ) : (
          <ol className="space-y-2">
            {todayEntries.map((e) => {
              const info = periodInfo(e.period);
              const t = slotText(e, lookup);
              const live = now >= toMin(info.start) && now < toMin(info.end) && e.status !== 'cancelled';
              const isNext = next?.key === e.key;
              return (
                <li
                  key={e.key}
                  className={cn(
                    'flex gap-3 rounded-2xl border bg-surface p-3.5 shadow-1 sm:gap-4',
                    live ? 'border-primary-ink/50 ring-2 ring-[color-mix(in_srgb,var(--primary-ink)_15%,transparent)]' : e.status === 'cancelled' ? 'border-critical-line' : e.status !== 'normal' ? 'border-[color-mix(in_srgb,var(--accent)_55%,transparent)]' : 'border-line',
                  )}
                >
                  <div className="w-16 shrink-0 text-center">
                    <p className="tabular text-[15px] font-semibold text-ink">{info.start}</p>
                    <p className="tabular text-[11.5px] text-muted">{info.end}</p>
                    <p className="mt-1 text-[11px] font-medium text-muted">P{e.period}</p>
                  </div>
                  <div className="min-w-0 flex-1 border-l border-line pl-3 sm:pl-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className={cn('text-[15px] font-semibold text-ink', e.status === 'cancelled' && 'text-muted line-through')}>{t.title}</p>
                      {live && <Badge tone="primary">Now</Badge>}
                      {isNext && !live && <Badge tone="neutral">Next</Badge>}
                      {e.status === 'cancelled' && <Badge tone="critical">Cancelled</Badge>}
                      {e.status === 'changed' && <Badge tone="accent">Changed</Badge>}
                      {e.status === 'added' && <Badge tone="success">{CHANGE_LABEL[e.changeTypes[0]]}</Badge>}
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="size-3.5 text-muted" aria-hidden />
                        {e.previous?.facultyId && <s className="text-muted">{lookup.faculty[e.previous.facultyId]?.name}</s>} {t.faculty}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-muted" aria-hidden />
                        {e.previous?.roomId && <s className="text-muted">{lookup.rooms[e.previous.roomId]?.name}</s>} {t.room === '—' ? 'Room to be announced' : lookup.rooms[e.roomId ?? '']?.name ?? t.room}
                      </span>
                      {e.previous?.period && (
                        <span className="inline-flex items-center gap-1.5 text-accent-ink">
                          <Clock className="size-3.5" aria-hidden /> moved from P{e.previous.period}
                        </span>
                      )}
                    </p>
                    {e.reason && e.status !== 'normal' && <p className="mt-1 text-[12px] text-muted">{e.reason}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="week-h" className="render-lazy">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 id="week-h" className="text-[17px] font-semibold text-ink">
            The week
          </h2>
          <Segmented<number>
            label="Week"
            value={weekOffset}
            onChange={setWeekOffset}
            options={[
              { value: 0, label: 'This week' },
              { value: 1, label: 'Next week' },
            ]}
          />
          <span className="text-[12.5px] text-muted">
            {fmtShort(week)} – {fmtShort(addDaysISO(week, 5))}
          </span>
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface shadow-1 md:block">
          <table className="w-full border-collapse">
            <caption className="sr-only">Weekly timetable</caption>
            <thead>
              <tr className="bg-grid-head">
                <th scope="col" className="w-20 px-3 py-2.5 text-left text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                  Day
                </th>
                {shiftPeriods.map((p) => (
                  <th key={p} scope="col" className="border-l border-line px-2.5 py-2 text-left">
                    <span className="block text-[12.5px] font-semibold text-ink">P{p}</span>
                    <span className="tabular block text-[11px] font-normal text-muted">
                      {periodInfo(p).start}–{periodInfo(p).end}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(({ d, date, entries }) => (
                <tr key={d} className={cn('border-t border-line', date === today && 'bg-primary-soft/50')}>
                  <th scope="row" className="px-3 py-2 text-left align-top">
                    <span className={cn('block text-[13px] font-semibold', date === today ? 'text-primary-ink' : 'text-ink')}>{DAY_SHORT[d]}</span>
                    <span className="text-[11px] font-normal text-muted">{date === today ? 'Today' : fmtShort(date)}</span>
                  </th>
                  {shiftPeriods.map((p) => (
                    <td key={p} className="h-[74px] border-l border-line p-1.5 align-top">
                      <div className="flex flex-col gap-1">
                        {entries
                          .filter((e) => e.period === p)
                          .map((e) => (
                            <EntryChip key={e.key} entry={e} lookup={lookup} />
                          ))}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2 md:hidden">
          {days.map(({ d, date, entries }) => (
            <details key={d} open={date === today || weekOffset === 1} className="group rounded-2xl border border-line bg-surface shadow-1">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[14px] font-semibold text-ink">
                {DAYS[d]} <span className="text-[12px] font-normal text-muted">{fmtShort(date)}</span>
                {date === today && <Badge tone="primary">Today</Badge>}
                {entries.some((e) => e.status !== 'normal') && <Badge tone="accent">Changed</Badge>}
                <span className="ml-auto text-[12px] font-normal text-muted">{entries.filter((e) => e.status !== 'cancelled').length} classes</span>
              </summary>
              <ul className="space-y-1.5 px-3 pb-3">
                {entries.map((e) => (
                  <li key={e.key} className="flex gap-2">
                    <span className="tabular w-12 shrink-0 pt-1.5 text-[11.5px] text-muted">{periodInfo(e.period).start}</span>
                    <EntryChip entry={e} lookup={lookup} />
                  </li>
                ))}
                {entries.length === 0 && <li className="px-1 text-[12.5px] text-muted">No classes.</li>}
              </ul>
            </details>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-muted">
          Served from published snapshot v{snap.version}
          {lastPub ? ` · today's changes published ${fmtTimeIST(lastPub.publishedAt)} IST` : ''}. Drafts never reach this view.
        </p>
      </section>
    </div>
  );
}
