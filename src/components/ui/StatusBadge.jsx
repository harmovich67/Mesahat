import { cn, BOOKING_STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';

const TONES = {
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
  sky: 'bg-sky-50 text-sky-800 border-sky-200',
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  teal: 'bg-teal-50 text-teal-800 border-teal-200',
  stone: 'bg-stone-100 text-stone-700 border-stone-200',
  rose: 'bg-rose-50 text-rose-800 border-rose-200',
  red: 'bg-red-50 text-red-800 border-red-200',
  orange: 'bg-orange-50 text-orange-800 border-orange-200',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  accent: 'bg-accent-50 text-accent-700 border-accent-200',
  neutral: 'bg-sand-100 text-stone-700 border-sand-200',
};
const DOTS = {
  amber: 'bg-amber-500', blue: 'bg-blue-500', sky: 'bg-sky-500', green: 'bg-emerald-500', teal: 'bg-teal-500',
  stone: 'bg-stone-400', rose: 'bg-rose-500', red: 'bg-red-500', orange: 'bg-orange-500',
  brand: 'bg-brand-500', accent: 'bg-accent-500', neutral: 'bg-stone-400',
};
const LIVE = new Set(['pending_payment', 'payment_under_review', 'active', 'under_review']);

export function Badge({ children, className, variant = 'neutral', dot = false }) {
  const tone = { primary: 'brand', success: 'green', warning: 'amber', danger: 'rose', info: 'sky' }[variant] || variant;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        TONES[tone] || TONES.neutral,
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, type = 'booking', className }) {
  const lang = useLanguageStore((s) => s.lang);
  const config = (type === 'booking' ? BOOKING_STATUS_CONFIG : PAYMENT_STATUS_CONFIG)[status];
  if (!config) return <Badge className={className}>{status || '—'}</Badge>;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        TONES[config.tone],
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', DOTS[config.tone], LIVE.has(status) && 'animate-pulse')} />
      {config.label[lang] || config.label.ar}
    </span>
  );
}
