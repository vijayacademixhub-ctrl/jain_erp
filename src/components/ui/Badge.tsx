import type { ReactNode } from 'react';
import type { Severity } from '../../domain/types';
import { cn } from '../../lib/util';
import { SEVERITY_META, type Tone } from './severity';

export type { Tone };

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  primary: 'bg-primary-soft text-primary-ink border-[color-mix(in_srgb,var(--primary-ink)_18%,transparent)]',
  accent: 'bg-accent-soft text-accent-ink border-[color-mix(in_srgb,var(--accent)_30%,transparent)]',
  success: 'bg-success-soft text-success border-success-line',
  warning: 'bg-warning-soft text-warning border-warning-line',
  critical: 'bg-critical-soft text-critical border-critical-line',
  advisory: 'bg-advisory-soft text-advisory border-advisory-line',
};

const dots: Record<Tone, string> = {
  neutral: 'bg-muted',
  primary: 'bg-primary-ink',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning-icon',
  critical: 'bg-critical',
  advisory: 'bg-advisory',
};

export function Badge({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11.5px] font-medium leading-none [&_svg]:size-3',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Status chip with a dot that gently pulses for live states. */
export function StatusChip({ tone, children, live = false, className }: { tone: Tone; children: ReactNode; live?: boolean; className?: string }) {
  return (
    <span className={cn('animate-chip-in inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium', tones[tone], className)}>
      <span className="relative flex size-1.5">
        {live && <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', dots[tone])} />}
        <span className={cn('relative inline-flex size-1.5 rounded-full', dots[tone])} />
      </span>
      {children}
    </span>
  );
}

/** Severity is always shown as icon + text, never colour alone. */
export function SeverityBadge({ severity, count, className }: { severity: Severity; count?: number; className?: string }) {
  const m = SEVERITY_META[severity];
  return (
    <Badge tone={m.tone} className={className} icon={<m.Icon aria-hidden />}>
      {count !== undefined ? `${count} ${m.label.toLowerCase()}` : m.label}
    </Badge>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line bg-surface-2 px-1.5 font-sans text-[11px] font-medium whitespace-nowrap text-muted">
      {children}
    </kbd>
  );
}
