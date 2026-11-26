import { useEffect, type ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  docTitle,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  docTitle: string;
}) {
  useEffect(() => {
    document.title = `${docTitle} · CMS Timetable Platform`;
  }, [docTitle]);
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-[11.5px] font-semibold tracking-[0.08em] text-accent-ink uppercase">{eyebrow}</p>}
        <h1 className="font-display-tight text-[34px] leading-[1.05] text-ink sm:text-[40px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SimulatedNote({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[11.5px] font-medium text-muted">
      <span aria-hidden className="size-1.5 rounded-full bg-accent" />
      {children}
    </p>
  );
}
