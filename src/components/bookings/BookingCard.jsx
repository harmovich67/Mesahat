import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarClock, MapPin } from 'lucide-react';
import { cn, formatEGP, formatRange, getLocalized } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { StatusBadge } from '../ui/StatusBadge';
import { HoldCountdown } from '../payments/PaymentPanel';

export function BookingCard({ booking: b, index = 0, className }) {
  const lang = useLanguageStore((s) => s.lang);
  const ar = lang === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const needsPayment = b.status === 'pending_payment';
  return (
    <Link
      to={`/dashboard/bookings/${b.id}`}
      style={{ '--i': index }}
      className={cn('surface surface-hover stagger group flex gap-4 overflow-hidden p-3 sm:p-4', needsPayment && 'ring-2 ring-accent-300/70', className)}
    >
      <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-sand-100 sm:size-28">
        <img src={b.space?.cover || '/images/hero.jpg'} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-110" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-0.5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={b.status} />
            <span className="num font-mono text-[11px] font-bold text-stone-400">{b.booking_number}</span>
          </div>
          <h3 className="truncate text-[15px] font-bold text-ink">{getLocalized(b.space?.name, lang)}</h3>
          <p className="flex items-center gap-1.5 truncate text-xs text-stone-500">
            <CalendarClock className="size-3.5 shrink-0" />
            <span className="num truncate">{formatRange(b.start_at, b.end_at, lang)}</span>
          </p>
          <p className="hidden items-center gap-1.5 truncate text-xs text-stone-400 sm:flex">
            <MapPin className="size-3.5 shrink-0" />
            {getLocalized(b.location?.name, lang)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="num text-base font-extrabold text-brand-700">{formatEGP(b.final_amount, lang)}</span>
          {needsPayment && b.hold_expires_at ? (
            <HoldCountdown expiresAt={b.hold_expires_at} />
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 opacity-0 transition-opacity group-hover:opacity-100">
              {ar ? 'التفاصيل' : 'Details'} <Arrow className="size-3.5" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
