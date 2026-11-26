import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/util';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-line bg-surface shadow-1', className)} {...rest} />;
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-ink [&_svg]:size-4">{icon}</div>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5', className)} {...rest} />;
}

export function Divider({ className }: { className?: string }) {
  return <div role="separator" className={cn('h-px w-full bg-line', className)} />;
}
