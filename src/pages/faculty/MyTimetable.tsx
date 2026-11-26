import { CalendarDays, CalendarPlus, Repeat2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge, StatusChip } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, Segmented } from '../../components/ui/Controls';
import { EntryChip } from '../../components/timetable/EntryChip';
import { ALL_PERIODS, DAY_INDEXES, DAY_SHORT, DAYS, periodInfo } from '../../domain/constants';
import type { DayEntry } from '../../domain/daily';
import { buildIcs } from '../../domain/ics';
import { computeWorkload } from '../../domain/workload';
import { addDaysISO, fmtDate, fmtShort, weekStartOf } from '../../lib/dates';
import { cn, downloadFile } from '../../lib/util';
import { dayEntries, latestSnapshot, sectionShort, useData, useLookup } from '../../store/data';
import { toast } from '../../store/toast';
import { useUi } from '../../store/ui';

interface MyEntry {
  date: string;
  entry: DayEntry;
  coveredBy?: string;
}

export default function MyTimetable() {
  const facultyId = useUi((s) => s.facultyId);
  const today = useData((s) => s.today);
  const snapshots = useData((s) => s.snapshots);
  const changes = useData((s) => s.changes);
  const leaves = useData((s) => s.leaves);
  const facultyList = useData((s) => s.facultyList);
  const term = useData((s) => s.term);
  const lookup = useLookup();
  const [weekOffset, setWeekOffset] = useState(0);
  const f = lookup.faculty[facultyId] ?? facultyList[0];
  const week = addDaysISO(weekStartOf(today), weekOffset * 7);
  const snap = latestSnapshot({ snapshots });

  // Faculty views read the published snapshot plus published daily changes only.
  const mine = useMemo(() => {
    const out: MyEntry[] = [];
    for (const d of DAY_INDEXES) {
      const date = addDaysISO(week, d);
      for (const e of dayEntries({ snapshots, changes }, date, false)) {
        if (e.facultyId === f.id) out.push({ date, entry: e });
        else if (e.previous?.facultyId === f.id) out.push({ date, entry: e, coveredBy: lookup.faculty[e.facultyId ?? '']?.name });
      }
    }
    return out;
  }, [week, snapshots, changes, f.id, lookup.faculty]);

  const status = useMemo(() => computeWorkload([f], snap.slots, leaves, changes, term, today)[0], [f, snap, leaves, changes, term, today]);
  const semesters = [...new Set(mine.flatMap(({ entry }) => entry.sectionIds.map((id) => lookup.sections[id]?.semester)).filter(Boolean))].sort();
  const flagged = mine.filter(({ entry, coveredBy }) => coveredBy || entry.status !== 'normal');
  const byCell = new Map<string, MyEntry[]>();
  for (const m of mine) {
    const k = `${m.date}|${m.entry.period}`;
    byCell.set(k, [...(byCell.get(k) ?? []), m]);
  }

  const exportIcs = () => {
    const events = snap.slots
      .filter((s) => s.facultyId === f.id)
      .map((s) => {
        const sub = lookup.subjects[s.subjectId ?? ''];
        return {
          slot: s,
          title: `${s.label ?? sub?.code ?? 'Class'} · ${sectionShort(lookup, s.sectionIds)}`,
          location: lookup.rooms[s.roomId ?? '']?.name ?? 'CMS Lalbagh Campus',
          description: `${sub?.name ?? s.label ?? ''}\nCMS Business School timetable (published v${snap.version})`,
        };
      });
    const ics = buildIcs(`${f.name} · CMS timetable`, weekStartOf(today), term.end, events);
    downloadFile(`${f.short.toLowerCase()}-timetable.ics`, ics, 'text/calendar');
    toast.success('Calendar file downloaded', `${events.length} weekly classes repeat until ${fmtDate(term.end, 'd MMM')}. Import it into Google Calendar or Outlook.`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="My timetable"
        title={f.name}
        docTitle="My Timetable"
        description={`${f.designation} · ${f.area}${f.type === 'External' ? ` · visiting, available P${f.window[0]}–P${f.window[1]}` : ''} · ${f.email}`}
        actions={
          <>
            <StatusChip tone={status.status === 'Completed' ? 'success' : status.status === 'On track' ? 'primary' : 'warning'}>
              Workload: {status.status} · {status.delivered}/{status.termTarget} h
            </StatusChip>
            <Button variant="secondary" icon={<CalendarPlus />} onClick={exportIcs}>
              Add to calendar (.ics)
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented<number>
          label="Week"
          value={weekOffset}
          onChange={setWeekOffset}
          options={[
            { value: 0, label: 'This week' },
            { value: 1, label: 'Next week' },
          ]}
        />
        <span className="text-[13px] text-ink-2">
          {fmtDate(week, 'd MMM')} – {fmtDate(addDaysISO(week, 5), 'd MMM')} · {mine.filter((m) => !m.coveredBy && m.entry.status !== 'cancelled').length} classes
        </span>
        {semesters.map((s) => (
          <Badge key={s} tone="neutral">
            Sem {s}
          </Badge>
        ))}
        {flagged.length > 0 && (
          <Badge tone="accent" icon={<Repeat2 />}>
            {flagged.length} change{flagged.length > 1 ? 's' : ''} this week
          </Badge>
        )}
      </div>

      {mine.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarDays />} title="No classes this week">
            {f.name} has no published classes in this week. Try next week, or pick another faculty member above.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface shadow-1 md:block">
            <table className="w-full min-w-[900px] border-collapse">
              <caption className="sr-only">Weekly timetable for {f.name}, all semesters merged</caption>
              <thead>
                <tr className="bg-grid-head">
                  <th scope="col" className="w-[84px] px-3 py-2.5 text-left text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                    Day
                  </th>
                  {ALL_PERIODS.map((p) => (
                    <th key={p} scope="col" className="border-l border-line px-2.5 py-2 text-left">
                      <span className="block text-[12.5px] font-semibold text-ink">P{p}</span>
                      <span className="tabular block text-[11px] font-normal text-muted">{periodInfo(p).start}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_INDEXES.map((d) => {
                  const date = addDaysISO(week, d);
                  const isToday = date === today;
                  return (
                    <tr key={d} className={cn('border-t border-line', isToday && 'bg-primary-soft/50')}>
                      <th scope="row" className="px-3 py-2 text-left align-top">
                        <span className={cn('block text-[13px] font-semibold', isToday ? 'text-primary-ink' : 'text-ink')}>{DAY_SHORT[d]}</span>
                        <span className="text-[11px] font-normal text-muted">{isToday ? 'Today' : fmtShort(date)}</span>
                      </th>
                      {ALL_PERIODS.map((p) => (
                        <td key={p} className="h-[76px] border-l border-line p-1.5 align-top">
                          <div className="flex flex-col gap-1">
                            {(byCell.get(`${date}|${p}`) ?? []).map((m) => (
                              <MineChip key={m.entry.key} m={m} lookup={lookup} />
                            ))}
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {DAY_INDEXES.map((d) => {
              const date = addDaysISO(week, d);
              const list = mine.filter((m) => m.date === date).sort((a, b) => a.entry.period - b.entry.period);
              const isToday = date === today;
              return (
                <section key={d} aria-label={`${DAYS[d]} ${fmtShort(date)}`} className={cn('rounded-2xl border bg-surface p-3 shadow-1', isToday ? 'border-primary-ink/40' : 'border-line')}>
                  <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-ink">
                    {DAYS[d]} <span className="text-[12px] font-normal text-muted">{fmtShort(date)}</span>
                    {isToday && <Badge tone="primary">Today</Badge>}
                  </h2>
                  {list.length === 0 ? (
                    <p className="text-[12.5px] text-muted">No classes.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {list.map((m) => (
                        <li key={m.entry.key} className="flex gap-2">
                          <span className="tabular w-14 shrink-0 pt-1.5 text-[11.5px] text-muted">
                            P{m.entry.period}
                            <br />
                            {periodInfo(m.entry.period).start}
                          </span>
                          <MineChip m={m} lookup={lookup} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MineChip({ m, lookup }: { m: MyEntry; lookup: ReturnType<typeof useLookup> }) {
  if (m.coveredBy) {
    return (
      <div className="rounded-[9px] border border-dashed border-line-strong px-2.5 py-1.5 text-[11.5px] text-muted">
        <s className="font-semibold">{lookup.subjects[m.entry.subjectId ?? '']?.code ?? m.entry.label}</s> · {sectionShort(lookup, m.entry.sectionIds)}
        <span className="mt-0.5 block font-medium text-accent-ink">Covered by {m.coveredBy}</span>
      </div>
    );
  }
  return (
    <div className="w-full">
      <EntryChip entry={m.entry} lookup={lookup} showTitle={false} />
      <span className="mt-0.5 block truncate pl-1 text-[10.5px] text-muted">{sectionShort(lookup, m.entry.sectionIds)}</span>
    </div>
  );
}
