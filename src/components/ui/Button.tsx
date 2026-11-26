import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '../../lib/util';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium select-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:translate-y-px disabled:opacity-50 disabled:pointer-events-none [&_svg]:shrink-0';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary shadow-1 hover:bg-primary-hover',
  secondary: 'bg-surface text-ink border border-line shadow-1 hover:border-line-strong hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  subtle: 'bg-primary-soft text-primary-ink hover:brightness-[0.97]',
  danger: 'bg-critical text-white shadow-1 hover:brightness-110 dark:text-[#1a0503]',
  accent: 'bg-accent-soft text-accent-ink border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:brightness-[0.98]',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] [&_svg]:size-3.5',
  md: 'h-9 px-3.5 text-sm [&_svg]:size-4',
  lg: 'h-11 px-5 text-[15px] [&_svg]:size-4',
  icon: 'size-9 [&_svg]:size-[18px]',
  'icon-sm': 'size-8 [&_svg]:size-4',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, icon, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {icon}
      {children}
    </button>
  );
});

export function LinkButton({
  variant = 'secondary',
  size = 'md',
  className,
  icon,
  children,
  ...rest
}: LinkProps & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode }) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
