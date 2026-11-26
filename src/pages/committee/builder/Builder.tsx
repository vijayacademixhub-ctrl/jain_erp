import { ChevronLeft, ChevronRight, Gauge, ListChecks, ShieldAlert, Siren, Sparkles, UploadCloud, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { SEVERITY_META } from '../../../components/ui/severity';
import { Button } from '../../../components/ui/Button';
import { Segmented, Switch } from '../../../components/ui/Controls';
import { KIND_LEGEND, KIND_STYLE } from '../../../components/timetable/slotDisplay';
import { ALL_PERIODS, SEMESTERS, SHIFTS } from '../../../domain/constants';
import type { Program, Semester, Severity } from '../../../domain/types';
import { addDaysISO, fmtDate, fmtStamp, weekStartOf } from '../../../lib/dates';
import { cn } from '../../../lib/util';
import { latestSnapshot, sectionName, useData } from '../../../store/data';
import { useUi } from '../../../store/ui';
import { BuilderGrid } from './BuilderGrid';
import { focusSlot, useBuilderUi } from './builderUi';
import { ClashPanel } from './ClashPanel';
import { LeaveColumn } from './LeaveColumn';
import { PublishDialog } from './PublishDialog';
import { SlotEditor } from './SlotEditor';
import { SubjectPanel } from './SubjectPanel';

export default function Builder() {
  const prefs = useUi((s) => s.builder);
  const setBuilder = useUi((s) => s.setBuilder);
  const muted = useUi((s) => s.muted);
  const setMuted = useUi((s) => s.setMuted);
  const sectionList = useData((s) => s.sectionList);
  const sections = useData((s) => s.sections);
  const counts = useData((s) => s.clashCounts);
  const lastCheckMs = useData((s) => s.lastCheckMs);
  const week = useData((s) => s.builderWeek);
  const setWeek = useData((s) => s.setBuilderWeek);
  const today = useData((s) => s.today);
  const snap = useData((s) => latestSnapshot(s));
  const dirty = useData((s) => s.dirty);
  const scenarios = useData((s) => s.scenarios);
  const armed = useBuilderUi((s) => s.armed);
  const announce = useBuilderUi((s) => s.announce);
  const setUi = useBuilderUi((s) => s.set);
  const [showScenarios, setShowScenarios] = useState(true);

  const cohort = useMemo(() => sectionList.filter((s) => s.program === prefs.program && s.semester === prefs.semester), [sectionList, prefs.program, prefs.semester]);
  const section = sections[prefs.sectionId] && cohort.some((c) => c.id === prefs.sectionId) ? sections[prefs.sectionId] : cohort[0];

  useEffect(() => {
    if (section && section.id !== prefs.sectionId) setBuilder({ sectionId: section.id });
  }, [section, prefs.sectionId, setBuilder]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useBuilderUi.getState().armed) useBuilderUi.getState().set({ armed: null, announce: 'Selection cleared.' });
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      useBuilderUi.getState().set({ armed: null, editSlotId: null, panelOpen: false, publishOpen: false });
    };
  }, []);

  useEffect(() => {
    setUi({ focusKey: null });
  }, [section?.id, setUi]);

  if (!section) return null;
  const shiftPeriods = SHIFTS[section.shift].periods;
  const periods = prefs.allPeriods ? [...ALL_PERIODS] : shiftPeriods;
  const blocked = counts.critical > 0;
  const total = counts.critical + counts.warning + counts.advisory;

  const openPanel = (sev?: Severity) => {
    const first = sev ? useData.getState().clashList.find((c) => c.severity === sev) : undefined;
    setUi({ panelOpen: true, selectedClashId: first?.id ?? null });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Committee Console"
        title="Master Timetable Builder"
        docTitle="Master Builder"
        description="Drag subjects into the week. Every edit is checked instantly for faculty, room, section, leave, capacity, hours and elective clashes."
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMuted(!muted)}
              icon={muted ? <VolumeX /> : <Volume2 />}
              aria-pressed={!muted}
              title="Alert sound for critical clashes (off by default for shared workspaces)"
            >
              {muted ? 'Sound off' : 'Sound on'}
            </Button>
            <Button variant="secondary" onClick={() => openPanel()} icon={<Siren />}>
              Clash panel
              <span className={cn('tabular ml-0.5 rounded-full px-1.5 text-[11px] font-semibold', counts.critical ? 'bg-critical text-white dark:text-[#1a0503]' : total ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success')}>
                {total}
              </span>
            </Button>
            <span className="inline-flex flex-col items-end">
              <Button variant="primary" onClick={() => setUi({ publishOpen: true, overrideMode: false })} disabled={blocked} icon={<UploadCloud />} aria-describedby={blocked ? 'publish-blocked' : undefined}>
                Publish v{snap.version + 1}
              </Button>
            </span>
          </>
        }
      />

      {blocked && (
        <div id="publish-blocked" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-critical-line bg-critical-soft px-4 py-2.5 text-[13px] text-critical">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          <span className="font-medium">
            Publishing is blocked: {counts.critical} critical clash{counts.critical > 1 ? 'es' : ''} in the draft.
          </span>
          <button type="button" onClick={() => openPanel('critical')} className="font-semibold underline-offset-2 hover:underline">
            Review
          </button>
          <button type="button" onClick={() => setUi({ publishOpen: true, overrideMode: true })} className="ml-auto text-[12.5px] font-semibold text-ink-2 underline-offset-2 hover:underline">
            Admin override…
          </button>
        </div>
      )}

      {showScenarios && scenarios.length > 0 && (
        <div className="mb-4 rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-accent-soft/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent-ink" aria-hidden />
            <p className="text-[13px] font-semibold text-ink">Demo scenarios seeded in this draft</p>
            <button type="button" onClick={() => setShowScenarios(false)} aria-label="Hide demo scenarios" className="ml-auto grid size-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink">
              <X className="size-3.5" />
            </button>
          </div>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-0.5">
            {scenarios.map((sc, i) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => sc.slotId && focusSlot(sc.slotId)}
                className="flex w-[250px] shrink-0 flex-col rounded-xl border border-line bg-surface px-3 py-2 text-left shadow-1 transition-colors hover:border-line-strong"
              >
                <span className="text-[11px] font-semibold text-accent-ink">Scenario {i + 1}</span>
                <span className="text-[12.5px] font-semibold text-ink">{sc.title}</span>
                <span className="mt-0.5 line-clamp-2 text-[11.5px] text-muted">{sc.detail}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-1">
        <Segmented<Program>
          label="Programme"
          value={prefs.program}
          onChange={(program) => setBuilder({ program })}
          options={[
            { value: 'BBA', label: 'BBA' },
            { value: 'WOW', label: 'WOW' },
          ]}
        />
        <Segmented<Semester> label="Semester" value={prefs.semester} onChange={(semester) => setBuilder({ semester })} options={SEMESTERS.map((s) => ({ value: s, label: `Sem ${s}` }))} />
        <Segmented<string> label="Section" value={section.id} onChange={(sectionId) => setBuilder({ sectionId })} options={cohort.map((s) => ({ value: s.id, label: `Sec ${s.name}` }))} />
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Previous week" onClick={() => setWeek(addDaysISO(week, -7))}>
            <ChevronLeft />
          </Button>
          <button
            type="button"
            onClick={() => setWeek(weekStartOf(today))}
            className="tabular h-8 rounded-lg px-2 text-[13px] font-medium text-ink hover:bg-surface-2"
            title="Week used for the Planned Leave overlay. Click for this week."
          >
            Week of {fmtDate(week, 'd MMM')}
          </button>
          <Button size="icon-sm" variant="ghost" aria-label="Next week" onClick={() => setWeek(addDaysISO(week, 7))}>
            <ChevronRight />
          </Button>
        </div>
        <Switch label="All periods" checked={prefs.allPeriods} onChange={(allPeriods) => setBuilder({ allPeriods })} />
        <span className="text-[12.5px] text-muted lg:ml-auto">
          {SHIFTS[section.shift].name} · {SHIFTS[section.shift].start}–{SHIFTS[section.shift].end} · {section.strength} students
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(['critical', 'warning', 'advisory'] as Severity[]).map((sev) => {
          const m = SEVERITY_META[sev];
          return (
            <button
              key={sev}
              type="button"
              onClick={() => openPanel(sev)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors',
                sev === 'critical' ? 'border-critical-line bg-critical-soft text-critical' : sev === 'warning' ? 'border-warning-line bg-warning-soft text-warning' : 'border-advisory-line bg-advisory-soft text-advisory',
              )}
            >
              <m.Icon className="size-3.5" aria-hidden />
              <span className="tabular">{counts[sev]}</span> {m.label.toLowerCase()}
            </button>
          );
        })}
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[12px] text-muted" title="Time taken by the incremental clash index for the last edit">
          <Gauge className="size-3.5" aria-hidden />
          Last check {lastCheckMs ? `${lastCheckMs < 0.1 ? lastCheckMs.toFixed(3) : lastCheckMs.toFixed(2)} ms` : 'idle'}
        </span>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[12px] text-muted">
          <ListChecks className="size-3.5" aria-hidden />
          {dirty ? 'Draft has unpublished edits' : 'Draft'} · live v{snap.version} published {fmtStamp(snap.publishedAt)} by {snap.publishedBy}
        </span>
        <span className="hidden flex-wrap items-center gap-2 text-[11.5px] text-muted 2xl:ml-auto 2xl:flex">
          {KIND_LEGEND.map((k) => (
            <span key={k.kind} className="inline-flex items-center gap-1">
              <span className={cn('relative inline-block h-3 w-4 rounded border before:absolute before:inset-y-0.5 before:left-0.5 before:w-[2px] before:rounded-full', KIND_STYLE[k.kind])} aria-hidden />
              {k.label}
            </span>
          ))}
        </span>
      </div>

      {armed && (
        <div className="animate-fade-up sticky top-[72px] z-20 mb-3 flex items-center gap-3 rounded-xl border border-primary-ink/30 bg-primary-soft px-4 py-2 text-[13px] text-primary-ink shadow-2">
          <span className="font-semibold">Placing {armed.type === 'fixed' ? armed.label : armed.label}</span>
          <span className="text-ink-2">Click or press Enter on a cell. Esc to cancel.</span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setUi({ armed: null })}>
            Cancel
          </Button>
        </div>
      )}

      <div className="render-lazy grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)] 2xl:grid-cols-[248px_minmax(0,1fr)_220px]">
        <div className="lg:sticky lg:top-[84px] lg:self-start">
          <SubjectPanel sectionId={section.id} />
        </div>
        <div className="min-w-0">
          <BuilderGrid sectionId={section.id} sectionLabel={sectionName(section)} periods={periods} shiftPeriods={shiftPeriods} weekStart={week} today={today} />
          <p className="mt-2 text-[12px] text-muted">
            Keyboard: arrow keys move between cells, Enter opens a class or places the selected subject, Esc cancels. Colours always come with an icon and a label.
          </p>
        </div>
        <div className="lg:col-span-2 2xl:col-span-1">
          <LeaveColumn sectionId={section.id} />
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
      <ClashPanel />
      <SlotEditor />
      <PublishDialog />
    </div>
  );
}
