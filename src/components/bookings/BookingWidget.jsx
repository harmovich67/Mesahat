import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, CalendarDays, Check, Minus, Plus, ShieldCheck, Sparkles, Tag, Timer, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { cn, formatEGP, formatTime, getLocalized, isoDate, unitLabel } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import { usePublicSettings } from '../../lib/hooks';
import { Button } from '../ui/Button';
import { useDebounced } from '../ui/Dash';
import { Spinner } from '../ui/Feedback';

const MODE_LABEL = {
  per_booking: { ar: 'للحجز', en: 'per booking' },
  per_hour: { ar: 'للساعة', en: 'per hour' },
  per_person: { ar: 'للفرد', en: 'per person' },
};
const UNIT_ORDER = ['hourly', 'half_day', 'full_day', 'daily', 'weekly', 'monthly'];

function Label({ icon: Icon, children }) {
  return (
    <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">
      {Icon && <Icon className="size-3.5 text-brand-600" />}
      {children}
    </span>
  );
}

export function BookingWidget({ space }) {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const settings = usePublicSettings().data?.settings;
  const step = settings?.booking?.slot_step_minutes || 30;
  const minDur = settings?.booking?.min_duration_minutes || 60;
  const maxDur = settings?.booking?.max_duration_minutes || 720;
  const holdMin = settings?.booking?.payment_hold_minutes || 30;

  const units = useMemo(() => {
    const set = new Set((space.pricing || []).filter((p) => p.kind === 'base' && p.active).map((p) => p.unit));
    return UNIT_ORDER.filter((u) => set.has(u));
  }, [space.pricing]);

  // Prefill from "book again" links (?unit=&start=&minutes=&guests=)
  const [unit, setUnit] = useState(() => (units.includes(params.get('unit')) ? params.get('unit') : units[0]));
  const [date, setDate] = useState(() => isoDate(new Date(Date.now() + 864e5)));
  const [start, setStart] = useState(params.get('start') || '');
  const [minutes, setMinutes] = useState(() => Number(params.get('minutes')) || 120);
  const [guests, setGuests] = useState(() => Math.min(space.capacity, Number(params.get('guests')) || 1));
  const [addons, setAddons] = useState({}); // id -> qty
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState('');

  const timed = unit === 'hourly' || unit === 'half_day';
  const duration = unit === 'hourly' ? minutes : unit === 'half_day' ? (settings?.booking?.half_day_hours || 4) * 60 : null;

  const addonsQ = useQuery({ queryKey: ['addons', space.type?.key], queryFn: () => api.get('/addons', { type: space.type?.key }), staleTime: 5 * 60_000 });
  const addonList = addonsQ.data?.items || [];

  const avail = useQuery({
    queryKey: ['availability', space.id, date, unit, duration],
    queryFn: () => api.get(`/spaces/${space.id}/availability`, { date, unit, duration: duration || 60 }),
    enabled: Boolean(date && unit),
    staleTime: 15_000,
  });
  const slots = avail.data?.detail?.slots || [];
  const free = slots.filter((s) => s.available);
  const dayInfo = avail.data?.days?.[0];

  // Keep the chosen start valid when availability changes
  useEffect(() => {
    if (!timed || !slots.length) return;
    if (!free.find((s) => s.time === start)) setStart(free[0]?.time || '');
  }, [avail.data, timed]); // eslint-disable-line react-hooks/exhaustive-deps

  const body = useMemo(
    () => ({
      space_id: space.id,
      unit,
      date,
      ...(timed ? { start_time: start, duration_minutes: duration } : {}),
      guest_count: guests,
      addons: Object.entries(addons).filter(([, q]) => q > 0).map(([add_on_id, quantity]) => ({ add_on_id, quantity })),
      coupon_code: coupon || undefined,
    }),
    [space.id, unit, date, timed, start, duration, guests, addons, coupon],
  );
  const quoteKey = useDebounced(JSON.stringify(body), 250);
  // The quote is debounced, so decide readiness from the same (debounced) snapshot that is sent.
  const snapshot = useMemo(() => JSON.parse(quoteKey), [quoteKey]);
  const ready = Boolean(snapshot.unit && snapshot.date && (!timed || snapshot.start_time));

  const quoteQ = useQuery({
    queryKey: ['quote', quoteKey],
    queryFn: () => api.post('/bookings/quote', JSON.parse(quoteKey)),
    enabled: ready,
    retry: false,
    placeholderData: (prev) => prev,
  });
  const quote = quoteQ.data?.quote;
  const quoteError = quoteQ.error;
  const couponError = quoteError && ['COUPON_INVALID', 'COUPON_EXPIRED', 'COUPON_LIMIT', 'COUPON_USER_LIMIT', 'COUPON_MIN_AMOUNT', 'COUPON_NOT_APPLICABLE'].includes(quoteError.code);

  const book = useMutation({
    mutationFn: () => api.post('/bookings', { ...body, expected_total: quote?.final_amount }),
    onSuccess: (res) => {
      toast.success(ar ? 'تم حجز المساحة مؤقتاً — أكمل الدفع' : 'Space held — complete your payment');
      navigate(`/dashboard/bookings/${res.booking.id}`);
    },
    onError: (e) => {
      toast.error(e.message);
      avail.refetch();
    },
  });

  const submit = () => {
    if (!isAuthenticated) {
      const redirect = `${window.location.pathname}${window.location.search}`;
      toast.info(ar ? 'سجّل الدخول لإتمام الحجز' : 'Sign in to complete your booking');
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    book.mutate();
  };

  const setAddon = (a, delta) =>
    setAddons((cur) => {
      const q = Math.max(0, Math.min(a.max_quantity, (cur[a.id] || 0) + delta));
      return { ...cur, [a.id]: q };
    });

  const durations = [];
  for (let m = minDur; m <= Math.min(maxDur, 480); m += minDur >= 60 ? 60 : step) durations.push(m);

  const priceFrom = space.from_price != null ? space.from_price : null;

  return (
    <div className="surface w-full max-w-full overflow-hidden shadow-lift">
      <div className="bg-brand-gradient relative overflow-hidden p-4 sm:p-6 text-white">
        <div className="pointer-events-none absolute -end-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center justify-between text-xs font-bold text-brand-100">
          <span>{ar ? 'احجز الآن' : 'Book now'}</span>
          <span className="inline-flex items-center gap-1.5 text-accent-300"><ShieldCheck className="size-4 shrink-0" />{ar ? 'تأكيد خلال دقائق' : 'Fast confirmation'}</span>
        </div>
        {priceFrom != null && (
          <div className="relative mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-xs text-brand-200">{ar ? 'تبدأ من' : 'from'}</span>
            <span className="num text-2xl sm:text-3xl font-black tracking-tight">{formatEGP(priceFrom, lang)}</span>
            <span className="text-sm text-brand-200">/ {unitLabel(space.from_unit, lang)}</span>
          </div>
        )}
      </div>

      <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
        {units.length > 1 && (
          <div>
            <Label>{ar ? 'نوع الحجز' : 'Booking type'}</Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {units.map((u) => (
                <button key={u} role="radio" aria-checked={unit === u} onClick={() => setUnit(u)} className={cn('rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-all', unit === u ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-sand-200 text-stone-600 hover:border-brand-300')}>
                  {unitLabel(u, lang)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label icon={CalendarDays}>{ar ? 'التاريخ' : 'Date'}</Label>
          <input type="date" min={isoDate()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-sand-300 bg-white px-3.5 py-2.5 text-sm font-semibold transition-all focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10" />
          {dayInfo && <p className="mt-1.5 text-xs text-stone-500">{dayInfo.open && dayInfo.close ? `${ar ? 'ساعات العمل' : 'Open'}: ${dayInfo.open} – ${dayInfo.close}` : ar ? 'مغلق في هذا اليوم' : 'Closed this day'}</p>}
        </div>

        {unit === 'hourly' && (
          <div>
            <Label>{ar ? 'المدة' : 'Duration'}</Label>
            <div className="flex flex-wrap gap-2">
              {durations.map((m) => (
                <button key={m} onClick={() => setMinutes(m)} className={cn('num rounded-xl border-2 px-3.5 py-2 text-sm font-bold transition-all', minutes === m ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-sand-200 text-stone-600 hover:border-brand-300')}>
                  {m / 60} {ar ? 'س' : 'h'}
                </button>
              ))}
            </div>
          </div>
        )}

        {timed && (
          <div>
            <Label>{ar ? 'وقت البدء' : 'Start time'}</Label>
            {avail.isLoading ? (
              <div className="grid grid-cols-4 gap-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-9" />)}</div>
            ) : slots.length ? (
              <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto pe-1">
                {slots.map((s) => (
                  <button key={s.time} disabled={!s.available} onClick={() => setStart(s.time)} aria-pressed={start === s.time} title={s.available ? undefined : ar ? 'غير متاح' : 'Unavailable'}
                    className={cn('num rounded-lg border py-2 text-xs font-bold transition-all', start === s.time ? 'border-brand-700 bg-brand-700 text-white shadow-soft' : s.available ? 'border-sand-300 bg-white text-ink hover:border-brand-400' : 'cursor-not-allowed border-sand-100 bg-sand-50 text-stone-300 line-through', s.level === 'limited' && start !== s.time && s.available && 'border-amber-300 bg-amber-50')}>
                    {s.time}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">{ar ? 'لا توجد أوقات متاحة في هذا اليوم. جرّب تاريخاً آخر.' : 'No times available that day. Try another date.'}</p>
            )}
            {slots.length > 0 && free.length === 0 && <p className="mt-2 text-xs font-semibold text-rose-600">{ar ? 'اليوم محجوز بالكامل لهذه المدة.' : 'Fully booked for this duration.'}</p>}
          </div>
        )}

        <div>
          <Label icon={Users}>{ar ? 'عدد الحضور' : 'Guests'}</Label>
          <div className="flex items-center justify-between rounded-xl border border-sand-300 p-1.5">
            <button onClick={() => setGuests((g) => Math.max(1, g - 1))} disabled={guests <= 1} className="grid size-9 place-items-center rounded-lg bg-sand-100 text-ink transition-colors hover:bg-sand-200 disabled:opacity-40" aria-label="-"><Minus className="size-4" /></button>
            <span className="num text-base font-extrabold">{guests} <span className="text-xs font-medium text-stone-400">/ {space.capacity}</span></span>
            <button onClick={() => setGuests((g) => Math.min(space.capacity, g + 1))} disabled={guests >= space.capacity} className="grid size-9 place-items-center rounded-lg bg-sand-100 text-ink transition-colors hover:bg-sand-200 disabled:opacity-40" aria-label="+"><Plus className="size-4" /></button>
          </div>
        </div>

        {addonList.length > 0 && (
          <div>
            <Label icon={Sparkles}>{ar ? 'خدمات إضافية' : 'Add-ons'}</Label>
            <ul className="space-y-2">
              {addonList.map((a) => {
                const q = addons[a.id] || 0;
                return (
                  <li
                    key={a.id}
                    className={cn(
                      'flex min-w-0 items-center justify-between gap-2 sm:gap-3 rounded-xl border-2 p-2.5 sm:p-3 transition-all',
                      q ? 'border-brand-500 bg-brand-50/50' : 'border-sand-200'
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-start"
                      onClick={() => setAddons((c) => ({ ...c, [a.id]: q ? 0 : 1 }))}
                      aria-pressed={q > 0}
                    >
                      <span className="flex min-w-0 items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-ink">
                        {q > 0 && <Check className="size-4 shrink-0 text-brand-600" />}
                        <span className="truncate">{getLocalized(a.name, lang)}</span>
                      </span>
                      <span className="num block text-[11px] sm:text-xs text-stone-500">
                        {formatEGP(a.price, lang)} {MODE_LABEL[a.pricing_mode]?.[lang]}
                      </span>
                    </button>
                    {q > 0 && a.max_quantity > 1 && (
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setAddon(a, -1)}
                          className="grid size-7 place-items-center rounded-lg bg-white text-ink shadow-soft"
                          aria-label="-"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="num w-5 text-center text-xs sm:text-sm font-bold">{q}</span>
                        <button
                          type="button"
                          onClick={() => setAddon(a, 1)}
                          disabled={q >= a.max_quantity}
                          className="grid size-7 place-items-center rounded-lg bg-white text-ink shadow-soft disabled:opacity-40"
                          aria-label="+"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div>
          <Label icon={Tag}>{ar ? 'كود الخصم' : 'Promo code'}</Label>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setCoupon(couponInput.trim().toUpperCase()); }}>
            <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="WORKORA10" dir="ltr" className="min-w-0 flex-1 rounded-xl border border-sand-300 px-3.5 py-2.5 font-mono text-sm font-bold uppercase placeholder:font-sans placeholder:font-normal placeholder:normal-case focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10" />
            <Button type="submit" variant="outline" size="sm" disabled={!couponInput.trim()}>{ar ? 'تطبيق' : 'Apply'}</Button>
          </form>
          {coupon && !couponError && quote?.coupon_code && <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="size-3.5" />{ar ? `تم تطبيق ${quote.coupon_code}` : `${quote.coupon_code} applied`}</p>}
          {couponError && <p className="mt-1.5 text-xs font-semibold text-rose-600">{quoteError.message}</p>}
        </div>

        {/* Quote */}
        <div className="rounded-2xl bg-sand-50 p-3.5 sm:p-4">
          {!ready ? (
            <p className="text-center text-sm text-stone-500">{ar ? 'اختر الموعد لعرض السعر' : 'Pick a time to see the price'}</p>
          ) : quoteError && !couponError ? (
            <p className="flex items-start gap-2 text-sm font-semibold text-rose-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 break-words">{quoteError.message}</span>
            </p>
          ) : quote ? (
            <div className={cn('space-y-2 text-xs sm:text-sm transition-opacity', quoteQ.isFetching && 'opacity-50')}>
              <div className="flex items-center justify-between gap-2 text-stone-600">
                <span className="min-w-0 truncate">{quote.base.quantity > 1 || quote.unit === 'hourly' ? `${unitLabel(quote.unit, lang)} × ${quote.base.quantity}` : unitLabel(quote.unit, lang)}</span>
                <span className="num shrink-0 font-semibold">{formatEGP(quote.base_amount, lang)}</span>
              </div>
              {quote.addons?.map((a) => (
                <div key={a.add_on_id} className="flex items-center justify-between gap-2 text-stone-600">
                  <span className="min-w-0 truncate">{getLocalized(a.name, lang)} × {a.quantity}</span>
                  <span className="num shrink-0 font-semibold">{formatEGP(a.total, lang)}</span>
                </div>
              ))}
              {quote.discount_amount > 0 && (
                <div className="flex items-center justify-between gap-2 text-emerald-700">
                  <span className="min-w-0 truncate">{ar ? 'خصم' : 'Discount'} {quote.coupon_code}</span>
                  <span className="num shrink-0 font-semibold">−{formatEGP(quote.discount_amount, lang)}</span>
                </div>
              )}
              {quote.tax_amount > 0 && (
                <div className="flex items-center justify-between gap-2 text-stone-600">
                  <span className="min-w-0 truncate">{ar ? 'الضريبة' : 'VAT'}</span>
                  <span className="num shrink-0 font-semibold">{formatEGP(quote.tax_amount, lang)}</span>
                </div>
              )}
              <div className="flex items-end justify-between gap-2 border-t border-sand-200 pt-3">
                <span className="font-bold text-ink">{ar ? 'الإجمالي' : 'Total'}</span>
                <span className="num shrink-0 text-xl sm:text-2xl font-black tracking-tight text-brand-700">{formatEGP(quote.final_amount, lang)}</span>
              </div>
              <p className="num text-center text-[11px] text-stone-400 break-words">{formatTime(quote.start_at, lang)} → {formatTime(quote.end_at, lang)}</p>
            </div>
          ) : (
            <div className="flex justify-center py-2"><Spinner /></div>
          )}
        </div>

        <Button size="lg" className="w-full" loading={book.isPending} disabled={!ready || !quote || (quoteError && !couponError) || quoteQ.isFetching} onClick={submit}>
          {isAuthenticated ? (ar ? 'احجز وانتقل للدفع' : 'Reserve & continue to payment') : ar ? 'سجّل الدخول للحجز' : 'Sign in to book'}
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-stone-500">
          <Timer className="size-3.5 shrink-0" />
          {ar ? `نحجز لك المساحة ${holdMin} دقيقة لإتمام الدفع` : `We hold the slot for ${holdMin} minutes while you pay`}
        </p>
      </div>
    </div>
  );
}
