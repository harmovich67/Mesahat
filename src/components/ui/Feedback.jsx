import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { useLanguageStore } from '../../store/languageStore';

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function Spinner({ className }) {
  return <Loader2 className={cn('size-5 animate-spin text-brand-600', className)} />;
}

export function PageLoader({ label }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-stone-500" role="status">
      <Spinner className="size-8" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mesh" role="status" aria-label="loading">
      <div className="flex flex-col items-center gap-4">
        <div className="grid size-14 animate-pulse place-items-center rounded-2xl bg-brand-gradient text-2xl font-black text-white shadow-lift">
          W
        </div>
        <Spinner />
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, action, className }) {
  return (
    <div className={cn('mx-auto flex max-w-md flex-col items-center justify-center px-4 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-4 grid size-16 place-items-center rounded-3xl border border-sand-200 bg-gradient-to-br from-white to-sand-100 text-brand-600 shadow-soft">
          <Icon className="size-7" />
        </div>
      )}
      <h4 className="mb-1 text-base font-bold text-ink">{title}</h4>
      {description && <p className="mb-5 text-sm leading-relaxed text-stone-500">{description}</p>}
      {action}
      {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }) {
  const lang = useLanguageStore((s) => s.lang);
  return (
    <div className={cn('mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center', className)} role="alert">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertTriangle className="size-6" />
      </div>
      <h4 className="mb-1 text-base font-bold text-ink">
        {lang === 'ar' ? 'تعذر تحميل البيانات' : 'Could not load data'}
      </h4>
      <p className="mb-5 text-sm text-stone-500">
        {error?.message || (lang === 'ar' ? 'حدث خطأ غير متوقع.' : 'Something went wrong.')}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={onRetry}>
          {lang === 'ar' ? 'إعادة المحاولة' : 'Try again'}
        </Button>
      )}
    </div>
  );
}

const UNIT_TEXT = {
  hourly: ['ساعة', 'hour'], half_day: ['نصف يوم', 'half day'], full_day: ['يوم كامل', 'full day'],
  daily: ['يوم', 'day'], weekly: ['أسبوع', 'week'], monthly: ['شهر', 'month'],
};

export function PriceDisplay({ amount, unit, lang = 'ar', size = 'md', className }) {
  const unitText = UNIT_TEXT[unit];
  const sizes = { sm: 'text-base font-bold', md: 'text-xl font-extrabold', lg: 'text-3xl font-black text-brand-700' };
  return (
    <div className={cn('inline-flex items-baseline gap-1', className)}>
      <span className={cn(sizes[size], 'num tracking-tight')}>{Number(amount || 0).toLocaleString('en-US')}</span>
      <span className="text-xs font-semibold text-stone-500">{lang === 'ar' ? 'ج.م' : 'EGP'}</span>
      {unitText && <span className="text-xs font-normal text-stone-400">/ {unitText[lang === 'ar' ? 0 : 1]}</span>}
    </div>
  );
}
