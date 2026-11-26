import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/util';

const control =
  'w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-ink shadow-1 outline-none transition-[border-color,box-shadow] placeholder:text-muted/80 hover:border-line-strong focus:border-[var(--focus)] focus:ring-3 focus:ring-[color-mix(in_srgb,var(--focus)_18%,transparent)] disabled:opacity-60 aria-[invalid=true]:border-critical';

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink-2">
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[12.5px] text-critical">
      {children}
    </p>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, 'h-9', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(control, 'min-h-[84px] py-2 leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className={cn('relative', className)}>
      <select ref={ref} className={cn(control, 'h-9 appearance-none pr-8')} {...rest}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
});

/** Label + control + error, wired with ids for screen readers. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className={className}>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? errId : undefined })}
      <FieldError id={errId}>{error}</FieldError>
    </div>
  );
}
