import { AlertOctagon, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useToasts, type ToastTone } from '../../store/toast';
import { cn } from '../../lib/util';

const META: Record<ToastTone, { Icon: typeof Info; cls: string }> = {
  success: { Icon: CheckCircle2, cls: 'text-success' },
  info: { Icon: Info, cls: 'text-primary-ink' },
  warning: { Icon: AlertTriangle, cls: 'text-warning-icon' },
  error: { Icon: AlertOctagon, cls: 'text-critical' },
};

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 sm:items-end">
      {toasts.map((t) => {
        const { Icon, cls } = META[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-3 pr-2 shadow-3"
          >
            <Icon aria-hidden className={cn('mt-0.5 size-[18px] shrink-0', cls)} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{t.description}</p>}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-1.5 text-[12.5px] font-semibold text-primary-ink hover:underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink">
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
