import { Gauge, Play, Timer } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { create } from 'zustand';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusChip } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { createRng } from '../data/rng';
import { buildSimUsers, buildSyntheticSlots } from '../data/synthetic';
import { ClashEngine } from '../domain/clash';
import { ALL_PERIODS } from '../domain/constants';
import type { DayIndex, Period, Slot } from '../domain/types';
import { cn } from '../lib/util';

interface Metric {
  label: string;
  value: number;
  unit: string;
  budget?: number;
  note: string;
}

/* A tiny store for the synthetic dataset, shaped like the real one (cells keyed by section|day|period). */
const usePerfStore = create<{ cells: Record<string, readonly string[]>; slots: Record<string, Slot>; sections: string[]; set: (p: Partial<{ cells: Record<string, readonly string[]>; slots: Record<string, Slot>; sections: string[] }>) => void }>()(
  (set) => ({ cells: {}, slots: {}, sections: [], set }),
);

let renderCount = 0;

const DenseCell = memo(function DenseCell({ k }: { k: string }) {
  const ids = usePerfStore((s) => s.cells[k]);
  const slot = usePerfStore((s) => (ids?.[0] ? s.slots[ids[0]] : undefined));
  renderCount++;
  return (
    <td className={cn('border-l border-line px-1 py-0.5 text-[10px]', ids && ids.length > 1 && 'bg-critical-soft text-critical')}>
      {slot ? `${slot.subjectId?.replace('sx', 'S')}·${slot.facultyId?.replace('sf', 'F')}` : ''}
    </td>
  );
});

const DenseRow = memo(function DenseRow({ sec, day }: { sec: string; day: number }) {
  return (
    <tr className="border-t border-line">
      <th scope="row" className="sticky left-0 bg-surface px-2 text-left text-[10px] font-medium text-muted">
        {sec}
      </th>
      {ALL_PERIODS.map((p) => (
        <DenseCell key={p} k={`${sec}|${day}|${p}`} />
      ))}
    </tr>
  );
});

function HeavyScreen({ day }: { day: number }) {
  const sections = usePerfStore((s) => s.sections);
  return (
    <div className="max-h-[420px] overflow-auto rounded-xl border border-line">
      <table className="w-full border-collapse">
        <caption className="sr-only">Synthetic all-sections day grid</caption>
        <thead>
          <tr className="bg-grid-head text-[10px] text-muted">
            <th scope="col" className="px-2 text-left">
              Section
            </th>
            {ALL_PERIODS.map((p) => (
              <th key={p} scope="col" className="px-1">
                P{p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => (
            <DenseRow key={s} sec={s} day={day} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Perf() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [running, setRunning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState('Ready');
  const engineRef = useRef<ClashEngine | null>(null);
  const mount = useRef({ ms: 0, cells: 0 });

  const run = async () => {
    setRunning(true);
    setMounted(false);
    const out: Metric[] = [];
    const tick = () => new Promise((r) => setTimeout(r, 30));

    setPhase('Generating 2,000 users and 5,000 slots');
    await tick();
    let t = performance.now();
    const { slots, refs, sections } = buildSyntheticSlots(5000, 42);
    const users = buildSimUsers(sections, Object.keys(refs.faculty), 2000);
    out.push({ label: 'Generate data', value: performance.now() - t, unit: 'ms', note: `${users.length.toLocaleString('en-IN')} users, ${slots.length.toLocaleString('en-IN')} slots, ${sections.length} sections` });

    setPhase('Building the clash index');
    await tick();
    const engine = new ClashEngine(refs);
    t = performance.now();
    engine.load(slots);
    out.push({ label: 'Build clash index', value: performance.now() - t, unit: 'ms', note: `${engine.list().length.toLocaleString('en-IN')} clashes found in the random data` });
    engineRef.current = engine;

    setPhase('1,000 random edits');
    await tick();
    const rng = createRng(7);
    const times: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const s = slots[Math.floor(rng() * slots.length)];
      const next = { ...s, day: Math.floor(rng() * 6) as DayIndex, period: (1 + Math.floor(rng() * 8)) as Period };
      const a = performance.now();
      engine.upsert(next);
      times.push(performance.now() - a);
    }
    times.sort((a, b) => a - b);
    const avg = times.reduce((n, x) => n + x, 0) / times.length;
    out.push({ label: 'Clash check per edit (avg)', value: avg, unit: 'ms', budget: 5, note: 'Incremental index: only touched keys are re-evaluated' });
    out.push({ label: 'Clash check per edit (p95)', value: times[Math.floor(times.length * 0.95)], unit: 'ms', budget: 5, note: `Worst of 1,000: ${times[times.length - 1].toFixed(3)} ms` });

    setPhase('Resolving 2,000 personal timetables');
    await tick();
    t = performance.now();
    let classes = 0;
    for (const u of users) {
      for (let d = 0 as DayIndex; d < 6; d = (d + 1) as DayIndex) {
        if (u.sectionId) for (const p of ALL_PERIODS) classes += engine.cell(u.sectionId, d, p).length;
        else if (u.facultyId) classes += engine.slotsOfFaculty(u.facultyId, d).length;
      }
    }
    out.push({ label: 'Resolve 2,000 user views', value: performance.now() - t, unit: 'ms', budget: 100, note: `${classes.toLocaleString('en-IN')} class entries read from the snapshot index` });

    setPhase('Mounting the heaviest screen');
    const cells: Record<string, readonly string[]> = {};
    for (const s of slots) {
      const k = `${s.sectionIds[0]}|${s.day}|${s.period}`;
      cells[k] = engine.cellByKey(k);
    }
    usePerfStore.getState().set({ cells, slots: Object.fromEntries([...engine.slots.values()].map((s) => [s.id, s])), sections: sections.map((s) => s.id) });
    setMetrics(out);
    // flushSync makes React render and commit synchronously, so wall-clock time is the real mount cost (works in production builds).
    renderCount = 0;
    const t0 = performance.now();
    flushSync(() => setMounted(true));
    mount.current = { ms: performance.now() - t0, cells: renderCount };
  };

  // After the heavy screen mounts, measure a single-cell edit.
  useEffect(() => {
    if (!mounted) return;
    const id = requestAnimationFrame(() => {
      const engine = engineRef.current!;
      const st = usePerfStore.getState();
      const firstSec = st.sections[0];
      const target = Object.values(st.slots).find((s) => s.sectionIds[0] === firstSec && s.day === 0)!;
      const moved = { ...target, period: (target.period === 8 ? 1 : target.period + 1) as Period };
      const t1 = performance.now();
      const cs = engine.upsert(moved);
      const nextCells = { ...st.cells };
      for (const k of cs.cells) nextCells[k] = engine.cellByKey(k);
      renderCount = 0;
      flushSync(() => st.set({ cells: nextCells, slots: { ...st.slots, [moved.id]: moved } }));
      const updMs = performance.now() - t1;
      const updCells = renderCount;
      setMetrics((m) => [
        ...m,
        { label: 'Mount heaviest screen', value: mount.current.ms, unit: 'ms', budget: 200, note: `${st.sections.length} sections × 8 periods, ${mount.current.cells.toLocaleString('en-IN')} cells rendered and committed` },
        { label: 'Edit → clash check → re-render', value: updMs, unit: 'ms', budget: 16, note: `${updCells} of ${(st.sections.length * 8).toLocaleString('en-IN')} cells re-rendered (memoised selectors)` },
      ]);
      setPhase('Done');
      setRunning(false);
    });
    return () => cancelAnimationFrame(id);
  }, [mounted]);

  useEffect(() => {
    const t = setTimeout(() => void run(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-14 sm:px-6">
      <PageHeader
        eyebrow="Hidden page · /perf"
        title="Performance lab"
        docTitle="Performance lab"
        description="Generates 2,000 simulated users and a 5,000-slot master, benchmarks the incremental clash index, then mounts the heaviest screen and times the synchronous render and commit."
        actions={
          <Button variant="primary" icon={<Play />} onClick={() => void run()} disabled={running}>
            {running ? phase : 'Run again'}
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => {
          const pass = m.budget === undefined || m.value <= m.budget;
          return (
            <Card key={m.label} className="animate-fade-up p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-ink">{m.label}</p>
                {m.budget !== undefined && (
                  <StatusChip tone={pass ? 'success' : 'critical'}>
                    {pass ? 'Within' : 'Over'} {m.budget} {m.unit}
                  </StatusChip>
                )}
              </div>
              <p className="font-display-tight tabular mt-2 text-[36px] leading-none text-ink">
                {m.value < 1 ? m.value.toFixed(3) : m.value.toFixed(1)} <span className="font-sans text-[14px] text-muted">{m.unit}</span>
              </p>
              <p className="mt-1.5 text-[12px] text-muted">{m.note}</p>
            </Card>
          );
        })}
        {running && (
          <Card className="flex items-center gap-3 p-4">
            <Timer className="size-5 animate-pulse text-primary-ink" aria-hidden />
            <p className="text-[13px] text-ink-2">{phase}…</p>
          </Card>
        )}
      </div>
      <Card className="mt-4">
        <CardHeader title="Heaviest screen: all-sections day grid (synthetic)" description="Each cell subscribes to its own key, so one edit re-renders one or two cells." icon={<Gauge />} />
        <CardBody>
          {mounted ? (
            <HeavyScreen day={0} />
          ) : (
            <p className="text-[13px] text-muted">Mounted after the engine benchmarks finish.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
