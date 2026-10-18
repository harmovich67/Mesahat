import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const base =
  'relative inline-flex items-center justify-center font-semibold whitespace-nowrap select-none rounded-xl ' +
  'transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export const buttonVariants = {
  primary: 'bg-brand-700 text-white shadow-soft hover:bg-brand-800 hover:shadow-lift',
  accent: 'bg-accent-500 text-white shadow-soft hover:bg-accent-600 hover:shadow-lift',
  secondary: 'bg-sand-100 text-ink hover:bg-sand-200',
  outline: 'border border-sand-300 bg-white text-ink hover:border-brand-300 hover:bg-brand-50',
  ghost: 'text-stone-600 hover:bg-sand-100 hover:text-ink',
  danger: 'bg-rose-600 text-white shadow-soft hover:bg-rose-700',
  dangerOutline: 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50',
  success: 'bg-emerald-600 text-white shadow-soft hover:bg-emerald-700',
  dark: 'bg-brand-950 text-white hover:bg-brand-900',
  darkOutline: 'border border-white/20 bg-white/5 text-white hover:bg-white/10',
};

export const buttonSizes = {
  xs: 'text-[11px] px-2.5 py-1 gap-1 rounded-lg',
  sm: 'text-xs px-3.5 py-2 gap-1.5',
  md: 'text-sm px-5 py-2.5 gap-2',
  lg: 'text-base px-6 py-3.5 gap-2.5',
  icon: 'p-2.5',
};

export const Button = forwardRef(function Button(
  {
    children, className, variant = 'primary', size = 'md', isLoading = false, loading = false,
    disabled = false, type = 'button', icon: Icon, iconEnd: IconEnd, ...props
  },
  ref,
) {
  const busy = Boolean(loading || isLoading);
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(base, buttonVariants[variant] || buttonVariants.primary, buttonSizes[size], className)}
      {...props}
    >
      {busy ? <Loader2 className="size-4 shrink-0 animate-spin" /> : Icon ? <Icon className="size-4 shrink-0" /> : null}
      {children}
      {!busy && IconEnd ? <IconEnd className="size-4 shrink-0 rtl:rotate-180" /> : null}
    </button>
  );
});

export default Button;
