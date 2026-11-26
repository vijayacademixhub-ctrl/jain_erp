import { CalendarDays, ChevronLeft, ChevronRight, History, Plus, Send, Trash2, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge, StatusChip } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { EmptyState, Segmented } from '../../components/ui/Controls';
import { EntryChip } from '../../components/timetable/EntryChip';
import { KindIcon } from '../../components/timetable/SlotIcons';
import { ALL_PERIODS, BREAK_AFTER, periodInfo, SHIFTS } from '../../domain/constants';
import { CHANGE_LABEL, type DayEntry } from '../../domain/daily';
import type { Period, Program, Semester } from '../../domain/types';
import { addDaysISO, dayIndexOf, diffDays, fmtDate, fmtTimeIST, relativeLabel } from '../../lib/dates';
import { cn } from '../../lib/util';
import { dayEntries, describeChange, latestSnapshot, useData, useLookup } from '../../store/data';
import { toast } from '../../store/toast';
import { ChangeDialog, type ChangeTarget } from './daily/ChangeDialog';

export default function Daily() {
  const today = useData((s) => s.today);
  const [date, setDate] = useState(today);
  const [program, setProgram] = useState<Program | 'all'>('all');
  const [semester, setSemester] = useState<Semester | 0>(0);
  const [target, setTarget] = useState<ChangeTarget | null>(null);
  const snapshots = useData((s) => s.snapshots);
  const changes = useData((s) => s.changes);
  const publications = useData((s) => s.publications);
  const sectionList = useData((s) => s.sectionList);
  const publishDay = useData((s) => s.publishDay);
  const undoLastPublish = useData((s) => s.undoLastPublish);
  const removeChange = useData((s) => s.removeChange);
  const lookup = useLookup();
  const snap = latestSnapshot({ snapshots });

  const entries = useMemo(() => dayEntries({ snapshots, changes }, date, true), [snapshots, changes, date]);
  const grid = useMemo(() => {
    const m = new Map<string, DayEntry[]>();
    for (const e of entries) for (const s of e.sectionIds) {
      const k = `${s}|${e.period}`;
      const list = m.get(k) ?? [];
      list.push(e);
      m.set(k, list);
    }
    return m;
  }, [entries]);

  const dayChanges = changes.filter((c) => c.date === date);
  const drafts = dayChanges.filter((c) => c.status === 'draft');
  const pubs = publications.filter((p) => p.date === date);
  const lastPub = pubs[pubs.length - 1];
  const sections = sectionList.filter((s) => (program === 'all' || s.program === program) && (semester === 0 || s.semester === semester));
  const isSunday = dayIndexOf(date) === null;
  const isPast = date < today;

  const publish = () => {
    const pub = publishDay(date);
    if (pub) toast.success(`Published ${fmtDate(date, 'EEE d MMM')}`, `${pub.changeIds.length} change(s) are live for students and faculty.`, { label: 'Undo', onClick: () => undoLastPublish(date) });
  };
  const undo = () => {
    const pub = undoLastPublish(date);
    if (pub) toast.info('Last publish undone', `${pub.changeIds.length} change(s) moved back to draft. Students see the previous version.`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Committee Console"
        title="Daily Timetable"
        docTitle="Daily Timetable"
        description={`Generated from master v${snap.version}. Apply swaps, substitutions, room changes, cancellations, extra classes and workshops, then publish the day.`}
        actions={
          <>
            <Button variant="secondary" icon={<Undo2 />} onClick={undo} disabled={!lastPub}>
              Undo last publish
            </Button>
            <Button variant="primary" icon={<Send />} onClick={publish} disabled={drafts.length === 0}>
              Publish {drafts.length ? `${drafts.length} change${drafts.length > 1 ? 's' : ''}` : 'day'}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-1">
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Previous day" onClick={() => setDate(addDaysISO(date, -1))}>
            <ChevronLeft />
          </Button>
          <label className="sr-only" htmlFor="daily-date">
            Date
          </label>
          <input
            id="daily-date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] font-medium text-ink"
          />
          <Button size="icon-sm" variant="ghost" aria-label="Next day" onClick={() => setDate(addDaysISO(date, 1))}>
            <ChevronRight />
          </Button>
          <Button size="sm" variant={date === today ? 'subtle' : 'ghost'} onClick={() => setDate(today)}>
            Today
          </Button>
        </div>
        <span className="text-[14px] font-semibold text-ink">
          {fmtDate(date, 'EEEE d MMM')}
          {Math.abs(diffDays(date, today)) <= 1 && <span className="ml-1.5 text-[12.5px] font-normal text-muted">({relativeLabel(date, today)})</span>}
        </span>
        {lastPub ? (
          <StatusChip tone="success">
            Published {fmtTimeIST(lastPub.publishedAt)} by {lastPub.publishedBy}
          </StatusChip>
        ) : (
          !isSunday && <StatusChip tone="neutral">Not published yet</StatusChip>
        )}
        {drafts.length > 0 && (
          <StatusChip tone="accent" live>
            {drafts.length} draft{drafts.length > 1 ? 's' : ''}
          </StatusChip>
        )}
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <Segmented<Program | 'all'>
            label="Programme"
            value={program}
            onChange={setProgram}
            options={[
              { value: 'all', label: 'All' },
              { value: 'BBA', label: 'BBA' },
              { value: 'WOW', label: 'WOW' },
            ]}
          />
          <Segmented<Semester | 0>
            label="Semester"
            value={semester}
            onChange={setSemester}
            options={[
              { value: 0, label: 'All' },
              { value: 1, label: 'Sem 1' },
              { value: 3, label: 'Sem 3' },
              { value: 5, label: 'Sem 5' },
            ]}
          />
        </div>
      </div>

      {isSunday ? (
        <Card>
          <EmptyState
            icon={<CalendarDays />}
            title="Sunday: no classes"
            action={
              <Button variant="primary" onClick={() => setDate(addDaysISO(date, 1))}>
                Go to Monday
              </Button>
            }
          >
            The campus runs Monday to Saturday across three shifts.
          </EmptyState>
        </Card>
      ) : (
        <div className="render-lazy grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 overflow-x-auto rounded-2xl border border-line bg-surface shadow-1">
            <table className="w-full min-w-[1080px] border-collapse text-left">
              <caption className="sr-only">
                Timetable for {fmtDate(date)} by section and period
              </caption>
              <thead>
                <tr className="bg-grid-head">
                  <th scope="col" className="sticky left-0 z-10 w-[118px] bg-grid-head px-3 py-2.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                    Section
                  </th>
                  {ALL_PERIODS.map((p) => (
                    <th key={p} scope="col" className="border-l border-line px-2.5 py-2 align-bottom">
                      <span className="block text-[12.5px] font-semibold text-ink">P{p}</span>
                      <span className="tabular block text-[11px] font-normal text-muted">
                        {periodInfo(p).start}
                        {BREAK_AFTER[p] && <span className="ml-1 text-[10px] uppercase">· {BREAK_AFTER[p]}</span>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sections.map((sec) => (
                  <tr key={sec.id} className="border-t border-line">
                    <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 align-top">
                      <span className="block text-[13px] font-semibold text-ink">
                        {sec.program} {sec.semester}
                        {sec.name}
                      </span>
                      <span className="block text-[11px] font-normal text-muted">Shift {sec.shift}</span>
                    </th>
                    {ALL_PERIODS.map((p) => (
                      <DailyCell
                        key={p}
                        list={grid.get(`${sec.id}|${p}`)}
                        inShift={SHIFTS[sec.shift].periods.includes(p)}
                        lookup={lookup}
                        readOnly={isPast}
                        onEntry={(entry) => setTarget({ kind: 'entry', entry })}
                        onEmpty={() => setTarget({ kind: 'empty', sectionId: sec.id, period: p as Period })}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title={`Changes for ${fmtDate(date, 'EEE d MMM')}`} description={dayChanges.length ? `${drafts.length} draft, ${dayChanges.length - drafts.length} published` : undefined} />
              <CardBody>
                {dayChanges.length === 0 ? (
                  <EmptyState icon={<Plus />} title="No changes yet" className="py-6">
                    Click any class to substitute, swap, move rooms or cancel. Click a free cell to add an extra class or workshop.
                  </EmptyState>
                ) : (
                  <ul className="space-y-2">
                    {dayChanges.map((c) => (
                      <li key={c.id} className="flex items-start gap-2 rounded-xl border border-line px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-ink">{describeChange(c, useData.getState())}</p>
                          {c.reason && <p className="mt-0.5 text-[11.5px] text-muted">{c.reason}</p>}
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge tone={c.status === 'draft' ? 'accent' : 'success'}>{c.status === 'draft' ? 'Draft' : 'Published'}</Badge>
                            {c.scope === 'master' && <Badge tone="primary">Master updated</Badge>}
                          </div>
                        </div>
                        {c.status === 'draft' && (
                          <Button size="icon-sm" variant="ghost" aria-label={`Discard draft: ${CHANGE_LABEL[c.type]}`} onClick={() => removeChange(c.id)}>
                            <Trash2 />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Publish history" icon={<History />} />
              <CardBody>
                {pubs.length === 0 ? (
                  <p className="text-[12.5px] text-muted">Nothing published for this date yet. Students see the master as published.</p>
                ) : (
                  <ol className="space-y-2">
                    {[...pubs].reverse().map((p, i) => (
                      <li key={p.id} className="flex items-center gap-2 text-[12.5px]">
                        <span className={cn('size-2 rounded-full', i === 0 ? 'bg-success' : 'bg-line-strong')} aria-hidden />
                        <span className="text-ink">
                          {fmtTimeIST(p.publishedAt)} IST · {p.publishedBy}
                        </span>
                        <span className="ml-auto text-muted">{p.changeIds.length} change(s)</span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-1 text-[11.5px] text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-accent" aria-hidden /> Changed
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-success" aria-hidden /> Added
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-critical" aria-hidden /> Cancelled
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm border border-dashed border-line-strong" aria-hidden /> Draft
              </span>
            </div>
          </div>
        </div>
      )}

      <ChangeDialog date={date} target={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function DailyCell({
  list,
  inShift,
  lookup,
  readOnly,
  onEntry,
  onEmpty,
}: {
  list: DayEntry[] | undefined;
  inShift: boolean;
  lookup: ReturnType<typeof useLookup>;
  readOnly: boolean;
  onEntry: (e: DayEntry) => void;
  onEmpty: () => void;
}) {
  const items = list ?? [];
  const grouped = items.length > 1 && items.every((e) => e.group && e.group === items[0].group);
  return (
    <td className={cn('h-[78px] border-l border-line p-1.5 align-top', !inShift && 'bg-surface-2/70')}>
      {items.length === 0 ? (
        inShift && !readOnly ? (
          <button
            type="button"
            onClick={onEmpty}
            className="grid h-full min-h-[64px] w-full place-items-center rounded-lg border border-dashed border-transparent text-[11px] text-muted opacity-60 transition-[opacity,border-color] hover:border-line-strong hover:opacity-100 focus-visible:opacity-100"
            aria-label="Free period. Add an extra class or workshop"
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        ) : null
      ) : grouped ? (
        <div className="relative flex h-full flex-col rounded-[9px] border border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-accent-soft py-1.5 pr-1.5 pl-3 before:absolute before:inset-y-1.5 before:left-1 before:w-[3px] before:rounded-full before:bg-accent">
          <span className="flex items-center gap-1 text-[12px] font-semibold text-accent-ink">
            <KindIcon kind={items[0].kind} /> {items[0].kind} ×{items.length}
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            {items.map((e) => (
              <button
                key={e.key}
                type="button"
                disabled={readOnly}
                onClick={() => onEntry(e)}
                className={cn('rounded bg-surface/80 px-1 text-[10.5px] font-medium text-ink-2 hover:text-ink', e.status !== 'normal' && 'ring-1 ring-accent')}
              >
                {lookup.subjects[e.subjectId ?? '']?.code}
              </button>
            ))}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((e) => (
            <EntryChip key={e.key} entry={e} lookup={lookup} showTitle={false} onClick={readOnly ? undefined : () => onEntry(e)} />
          ))}
        </div>
      )}
    </td>
  );
}
