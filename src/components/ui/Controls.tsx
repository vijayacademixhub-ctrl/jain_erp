import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/util';

/* ------------------------------- Tabs ------------------------------- */

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  count?: number;
}

/** Accessible tab list with arrow-key navigation. Render the panel yourself with `tabPanelProps`. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  label,
  size = 'md',
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  label: string;
  size?: 'sm' | 'md';
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const onKey = (e: KeyboardEvent, i: number) => {
    let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % items.length;
    if (e.key === 'ArrowLeft') j = (i - 1 + items.length) % items.length;
    if (e.key === 'Home') j = 0;
    if (e.key === 'End') j = items.length - 1;
    if (j >= 0) {
      e.preventDefault();
      refs.current[j]?.focus();
      onChange(items[j].id);
    }
  };
  return (
    <div role="tablist" aria-label={label} className={cn('no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface-2 p-1', className)}>
      {items.map((it, i) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${baseId}-${it.id}`}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-[9px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150',
              size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]',
              active ? 'bg-surface text-ink shadow-1' : 'text-muted hover:text-ink',
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span className={cn('tabular rounded-full px-1.5 text-[11px]', active ? 'bg-primary-soft text-primary-ink' : 'bg-surface-3 text-muted')}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Switch ------------------------------ */

export function Switch({
  checked,
  onChange,
  label,
  description,
  className,
  hideLabel = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: ReactNode;
  className?: string;
  hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={hideLabel ? label : undefined}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border transition-colors duration-200',
          checked ? 'border-primary bg-primary' : 'border-line-strong bg-surface-3',
        )}
      >
        <span
          className={cn('inline-block size-4 rounded-full bg-white shadow-1 transition-transform duration-200 ease-out', checked ? 'translate-x-[18px]' : 'translate-x-[2px]')}
        />
      </button>
      {!hideLabel && (
        <label htmlFor={id} className="cursor-pointer select-none">
          <span className="block text-[13px] font-medium text-ink">{label}</span>
          {description && <span className="block text-xs text-muted">{description}</span>}
        </label>
      )}
    </div>
  );
}

/* ---------------------------- Segmented ----------------------------- */

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex items-center gap-0.5 rounded-[10px] border border-line bg-surface-2 p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-7 rounded-[8px] px-2.5 text-[13px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150',
              active ? 'bg-surface text-ink shadow-1' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------- EmptyState ---------------------------- */

export function EmptyState({ icon, title, children, action, className }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <div className="mb-3 grid size-12 place-items-center rounded-2xl border border-line bg-surface-2 text-muted [&_svg]:size-5">{icon}</div>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------------------- Sparkline ----------------------------- */

export function Sparkline({ data, className, tone = 'primary', label }: { data: number[]; className?: string; tone?: 'primary' | 'critical' | 'success' | 'accent'; label: string }) {
  const w = 96;
  const h = 28;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const color = { primary: 'var(--primary-ink)', critical: 'var(--critical)', success: 'var(--success)', accent: 'var(--accent)' }[tone];
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={className} role="img" aria-label={label}>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity={0.08} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.4} fill={color} />
    </svg>
  );
}

/* ---------------------------- Meter bar ----------------------------- */

export function Meter({ value, max, tone = 'primary', label }: { value: number; max: number; tone?: 'primary' | 'success' | 'warning' | 'critical'; label: string }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  const color = { primary: 'bg-primary-ink', success: 'bg-success', warning: 'bg-warning-icon', critical: 'bg-critical' }[tone];
  return (
    <div role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div className={cn('h-full origin-left rounded-full transition-transform duration-500 ease-out', color)} style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  );
}
