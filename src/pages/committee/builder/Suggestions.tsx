import { ArrowRightLeft, Building2, Clock, UserRoundCheck } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { DAY_SHORT } from '../../../domain/constants';
import { makeLeaveLookup } from '../../../domain/leave';
import { suggestFixes } from '../../../domain/suggest';
import { engine, engineRefs, useData } from '../../../store/data';
import { reportSlot } from './builderUi';

function Section({ icon, title, empty, children }: { icon: ReactNode; title: string; empty: boolean; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.03em] text-muted uppercase">
        {icon}
        {title}
      </h4>
      {empty ? <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-muted">No free option found at this time.</p> : <div className="flex flex-wrap gap-1.5">{children}</div>}
    </div>
  );
}

/** Free faculty, free rooms and alternative periods for one slot, each one click away. */
export function Suggestions({ slotId, onApplied }: { slotId: string; onApplied?: () => void }) {
  const slot = useData((s) => s.slots[slotId]);
  const leaves = useData((s) => s.leaves);
  const week = useData((s) => s.builderWeek);
  const changes = useData((s) => s.changes);
  const clashVersion = useData((s) => s.clashList);
  const updateSlot = useData((s) => s.updateSlot);
  const moveSlot = useData((s) => s.moveSlot);

  const fixes = useMemo(() => {
    if (!slot) return null;
    const lookup = makeLeaveLookup(leaves, week, changes);
    void clashVersion;
    return suggestFixes(engine, slot, engineRefs(), (fid, d, p) => lookup(fid, d, p, '__probe__') !== null);
  }, [slot, leaves, week, changes, clashVersion]);

  if (!slot || !fixes) return null;
  const after = (verb: string) => {
    reportSlot(slotId, verb);
    onApplied?.();
  };

  const chip = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink shadow-1 transition-colors hover:border-primary-ink hover:bg-primary-soft';

  return (
    <div className="space-y-3">
      {slot.facultyId && (
        <Section icon={<UserRoundCheck className="size-3.5" aria-hidden />} title="Free faculty" empty={!fixes.faculty.length}>
          {fixes.faculty.map((f) => (
            <button key={f.id} type="button" className={chip} onClick={() => (updateSlot(slotId, { facultyId: f.id }, 'suggestion applied'), after(`Assigned ${f.name}`))}>
              {f.name}
              <span className="text-[11px] font-normal text-muted">{f.load} h/wk</span>
            </button>
          ))}
        </Section>
      )}
      {slot.roomId && (
        <Section icon={<Building2 className="size-3.5" aria-hidden />} title="Free rooms" empty={!fixes.rooms.length}>
          {fixes.rooms.map((r) => (
            <button key={r.id} type="button" className={chip} onClick={() => (updateSlot(slotId, { roomId: r.id }, 'suggestion applied'), after(`Moved to ${r.name}`))}>
              {r.name}
              <span className="text-[11px] font-normal text-muted">{r.capacity} seats</span>
            </button>
          ))}
        </Section>
      )}
      <Section icon={<Clock className="size-3.5" aria-hidden />} title="Alternative periods" empty={!fixes.periods.length}>
        {fixes.periods.map((p) => (
          <button
            key={`${p.day}-${p.period}`}
            type="button"
            className={chip}
            onClick={() => (moveSlot(slotId, p.day, p.period), after(`Moved to ${DAY_SHORT[p.day]} P${p.period}`))}
          >
            <ArrowRightLeft className="size-3 text-muted" aria-hidden />
            {DAY_SHORT[p.day]} P{p.period}
          </button>
        ))}
      </Section>
    </div>
  );
}
