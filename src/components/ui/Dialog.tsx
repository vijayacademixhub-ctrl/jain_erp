import { AnimatePresence, m } from 'framer-motion';
import { X } from 'lucide-react';
import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../lib/hooks';
import { cn } from '../../lib/util';

const EASE = [0.2, 0.8, 0.2, 1] as const;

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  initialFocus?: RefObject<HTMLElement | null>;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
}

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Dialog(props: DialogProps) {
  return createPortal(<AnimatePresence>{props.open && <DialogPanel {...props} />}</AnimatePresence>, document.body);
}

function DialogPanel({ onClose, title, description, children, footer, size = 'md', initialFocus, icon, tone = 'default' }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(true, ref, onClose, initialFocus);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <m.div
        className="absolute inset-0 bg-[rgb(8_12_22/0.45)] backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
        aria-hidden
      />
      <m.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
        transition={{ duration: 0.2, ease: EASE }}
        className={cn(
          'relative flex max-h-[min(92dvh,860px)] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-3 outline-none sm:rounded-2xl',
          widths[size],
        )}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          {icon && (
            <div className={cn('grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]', tone === 'danger' ? 'bg-critical-soft text-critical' : 'bg-primary-soft text-primary-ink')}>
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold tracking-[-0.01em] text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-[13px] text-muted">
                {description}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="-mr-1 grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3">{footer}</div>}
      </m.div>
    </div>
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
  icon?: ReactNode;
}

export function Drawer(props: DrawerProps) {
  return createPortal(<AnimatePresence>{props.open && <DrawerPanel {...props} />}</AnimatePresence>, document.body);
}

function DrawerPanel({ onClose, title, description, children, footer, width = 'sm:max-w-[460px]', icon }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(true, ref, onClose);
  return (
    <div className="fixed inset-0 z-[55] flex justify-end">
      <m.div
        className="absolute inset-0 bg-[rgb(8_12_22/0.32)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
        aria-hidden
      />
      <m.aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.26, ease: EASE }}
        className={cn('relative flex h-full w-full flex-col border-l border-line bg-surface shadow-3 outline-none', width)}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          {icon && <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink [&_svg]:size-[18px]">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold tracking-[-0.01em]">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close panel" className="-mr-1 grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
      </m.aside>
    </div>
  );
}
