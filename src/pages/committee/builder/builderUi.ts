import { create } from 'zustand';
import { engine, useData } from '../../../store/data';
import { toast } from '../../../store/toast';
import { useUi } from '../../../store/ui';
import { playClashAlert } from '../../../lib/sound';
import { DAY_SHORT, SHIFTS } from '../../../domain/constants';
import type { DayIndex, FixedLabel, Period } from '../../../domain/types';

export type DragPayload =
  | { type: 'subject'; subjectId: string; label: string }
  | { type: 'fixed'; label: FixedLabel }
  | { type: 'slot'; slotId: string; label: string };

interface BuilderUi {
  armed: DragPayload | null;
  flashKey: string | null;
  focusKey: string | null;
  editSlotId: string | null;
  panelOpen: boolean;
  selectedClashId: string | null;
  publishOpen: boolean;
  overrideMode: boolean;
  announce: string;
  set: (p: Partial<Omit<BuilderUi, 'set'>>) => void;
}

export const useBuilderUi = create<BuilderUi>()((set) => ({
  armed: null,
  flashKey: null,
  focusKey: null,
  editSlotId: null,
  panelOpen: false,
  selectedClashId: null,
  publishOpen: false,
  overrideMode: false,
  announce: '',
  set,
}));

export function parseCellKey(key: string): { sectionId: string; day: DayIndex; period: Period } {
  const [sectionId, d, p] = key.split('|');
  return { sectionId, day: Number(d) as DayIndex, period: Number(p) as Period };
}

/** Reports the outcome of an edit: alert sound + toast for critical, quieter notes otherwise. */
export function reportSlot(slotId: string, verb: string): void {
  const clashes = engine.clashesOf(slotId);
  const ms = useData.getState().lastCheckMs;
  const timing = `Checked in ${ms < 0.1 ? ms.toFixed(3) : ms.toFixed(2)} ms`;
  const critical = clashes.find((c) => c.severity === 'critical');
  const openPanel = { label: 'Open clash panel', onClick: () => useBuilderUi.getState().set({ panelOpen: true, selectedClashId: critical?.id ?? clashes[0]?.id ?? null }) };
  if (critical) {
    if (!useUi.getState().muted) playClashAlert();
    toast.error(`Critical clash: ${critical.title.toLowerCase()}`, engine.describeFor(critical, slotId), openPanel);
    useBuilderUi.getState().set({ announce: `Critical clash. ${engine.describeFor(critical, slotId)}` });
  } else if (clashes.length) {
    toast.warning(clashes[0].title, `${clashes[0].message} ${timing}.`, openPanel);
    useBuilderUi.getState().set({ announce: `${clashes[0].title}. ${clashes[0].message}` });
  } else {
    toast.success(verb, `No clashes. ${timing}.`);
    useBuilderUi.getState().set({ announce: `${verb}. No clashes.` });
  }
}

/** Scrolls the builder to a slot: switches section, then flashes and focuses the cell. */
export function focusSlot(slotId: string): void {
  const st = useData.getState();
  const slot = st.slots[slotId];
  if (!slot) return;
  const sec = st.sections[slot.sectionIds[0]];
  if (sec) {
    const inShift = SHIFTS[sec.shift].periods.includes(slot.period);
    useUi.getState().setBuilder({ program: sec.program, semester: sec.semester, sectionId: sec.id, allPeriods: useUi.getState().builder.allPeriods || !inShift });
  }
  const key = `${slot.sectionIds[0]}|${slot.day}|${slot.period}`;
  useBuilderUi.getState().set({ flashKey: null });
  setTimeout(() => {
    useBuilderUi.getState().set({ flashKey: key, focusKey: key });
    const el = document.querySelector<HTMLElement>(`[data-cell="${key}"]`);
    el?.scrollIntoView({ block: 'center', inline: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el?.focus({ preventScroll: true });
    setTimeout(() => useBuilderUi.getState().flashKey === key && useBuilderUi.getState().set({ flashKey: null }), 2000);
  }, 60);
}

export function dropOn(payload: DragPayload, cellKey: string): void {
  const { sectionId, day, period } = parseCellKey(cellKey);
  const st = useData.getState();
  const where = `${DAY_SHORT[day]} P${period}`;
  if (payload.type === 'subject') {
    const slot = st.placeSubject(sectionId, payload.subjectId, day, period);
    if (slot) reportSlot(slot.id, `Placed ${payload.label} · ${where}`);
  } else if (payload.type === 'fixed') {
    const slot = st.placeFixed(sectionId, payload.label, day, period);
    if (slot) reportSlot(slot.id, `Placed ${payload.label} · ${where}`);
  } else {
    const s = st.slots[payload.slotId];
    if (!s || (s.day === day && s.period === period)) return;
    st.moveSlot(payload.slotId, day, period);
    reportSlot(payload.slotId, `Moved ${payload.label} to ${where}`);
  }
  useBuilderUi.getState().set({ armed: null });
}

/* ------------------------------------------------------------------ */
/* Pointer drag with a lifted ghost. Hover targets are marked directly  */
/* on the DOM, so dragging never re-renders the grid.                   */
/* ------------------------------------------------------------------ */

export function beginDrag(e: React.PointerEvent, payload: DragPayload, label: string): void {
  if (e.button !== 0 || e.pointerType === 'touch') return;
  const sx = e.clientX;
  const sy = e.clientY;
  let started = false;
  let ghost: HTMLDivElement | null = null;
  let target: HTMLElement | null = null;
  let raf = 0;
  let x = sx;
  let y = sy;

  const paint = () => {
    raf = 0;
    if (ghost) ghost.style.transform = `translate3d(${x + 14}px, ${y + 10}px, 0) rotate(-1.5deg) scale(1.04)`;
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]') ?? null;
    if (el !== target) {
      target?.removeAttribute('data-drop-active');
      el?.setAttribute('data-drop-active', 'true');
      target = el;
    }
  };

  const cleanup = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('keydown', onKey, true);
    if (raf) cancelAnimationFrame(raf);
    target?.removeAttribute('data-drop-active');
    ghost?.remove();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  const onMove = (ev: PointerEvent) => {
    x = ev.clientX;
    y = ev.clientY;
    if (!started) {
      if (Math.hypot(x - sx, y - sy) < 5) return;
      started = true;
      ghost = document.createElement('div');
      ghost.className = 'drag-ghost rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-[13px] font-semibold text-ink';
      ghost.textContent = label;
      document.body.appendChild(ghost);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    }
    if (!raf) raf = requestAnimationFrame(paint);
  };

  const onUp = () => {
    const t = target;
    cleanup();
    if (!started) return;
    // Swallow the click that follows a drag so it does not open an editor.
    const swallow = (ce: MouseEvent) => ce.stopPropagation();
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 60);
    const key = t?.getAttribute('data-drop');
    if (key) dropOn(payload, key);
  };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      started = false;
      cleanup();
    }
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('keydown', onKey, true);
}
