import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Coffee, ReceiptText, ShieldCheck, Timer, Wifi } from 'lucide-react';
import { api } from '../lib/api';
import { UNIT_LABELS, cn, formatEGP, getLocalized } from '../lib/utils';
import { useLanguageStore } from '../store/languageStore';
import { usePublicSettings, useSpaceTypes } from '../lib/hooks';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { PageHero } from '../components/layout/PageHero';
import { Button } from '../components/ui/Button';
import { ErrorState, Skeleton } from '../components/ui/Feedback';

const UNITS = ['hourly', 'half_day', 'full_day', 'daily', 'weekly', 'monthly'];

export function Pricing() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const types = useSpaceTypes().data?.items || [];
  const settings = usePublicSettings().data?.settings;
  const spaces = useQuery({ queryKey: ['spaces', 'all-prices'], queryFn: () => api.get('/spaces', { limit: 60 }) });
  const addons = useQuery({ queryKey: ['addons'], queryFn: () => api.get('/addons'), staleTime: 5 * 60_000 });

  // Lowest base price per type & unit, straight from the live catalogue.
  const tiers = types
    .map((t) => {
      const list = (spaces.data?.items || []).filter((s) => s.type?.key === t.key);
      if (!list.length) return null;
      const from = (unit) => {
        const prices = list.flatMap((s) => s.prices.filter((p) => p.unit === unit).map((p) => p.amount));
        return prices.length ? Math.min(...prices) : null;
      };
      return { type: t, count: list.length, minCap: Math.min(...list.map((s) => s.capacity)), maxCap: Math.max(...list.map((s) => s.capacity)), prices: Object.fromEntries(UNITS.map((u) => [u, from(u)])) };
    })
    .filter(Boolean);
  const popular = tiers.find((t) => t.type.key === 'meeting_room')?.type.key;
  const tax = settings?.general?.tax_rate;

  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <Navbar />
      <PageHero eyebrow={ar ? 'الأسعار' : 'Pricing'} title={ar ? 'أسعار شفافة، بلا رسوم خفية' : 'Transparent pricing, no surprises'} description={ar ? 'هذه أقل الأسعار الحالية لكل نوع من المساحات. السعر النهائي يظهر لحظياً عند اختيار الموعد.' : 'Current starting prices per space type. The final price shows live when you pick a time.'} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-14 sm:px-6 lg:px-8">
        {spaces.error ? (
          <ErrorState error={spaces.error} onRetry={spaces.refetch} />
        ) : spaces.isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-80" />)}</div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tiers.map((t, i) => (
              <div key={t.type.key} style={{ '--i': i }} className={cn('surface stagger relative flex flex-col p-7', t.type.key === popular && 'border-brand-300 shadow-glow ring-2 ring-brand-500/20')}>
                {t.type.key === popular && <span className="absolute -top-3 start-6 rounded-full bg-accent-500 px-3 py-1 text-[11px] font-bold text-white shadow">{ar ? 'الأكثر طلباً' : 'Most popular'}</span>}
                <h2 className="text-xl font-extrabold text-ink">{getLocalized(t.type.name, lang)}</h2>
                <p className="num mt-1 text-sm text-stone-500">{t.minCap === t.maxCap ? t.minCap : `${t.minCap}–${t.maxCap}`} {ar ? 'أفراد' : 'people'} · {t.count} {ar ? 'مساحة' : 'spaces'}</p>
                <div className="my-6 space-y-3 border-y border-sand-100 py-6">
                  {UNITS.map((u) =>
                    t.prices[u] != null ? (
                      <div key={u} className="flex items-baseline justify-between">
                        <span className="text-sm font-semibold text-stone-600">{UNIT_LABELS[u][lang]}</span>
                        <span className="num text-xl font-black tracking-tight text-brand-700">{formatEGP(t.prices[u], lang)}</span>
                      </div>
                    ) : null,
                  )}
                </div>
                <Link to={`/spaces?type=${t.type.key}`} className="mt-auto"><Button className="w-full" variant={t.type.key === popular ? 'primary' : 'outline'} iconEnd={Arrow}>{ar ? 'تصفح المتاح' : 'See available'}</Button></Link>
              </div>
            ))}
          </div>
        )}

        <section className="mt-16 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="surface p-7">
            <h2 className="mb-5 text-xl font-extrabold text-ink">{ar ? 'مشمول في كل حجز' : 'Included with every booking'}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                { i: Wifi, t: ar ? 'إنترنت ألياف سريع' : 'Fast fibre internet' },
                { i: Coffee, t: ar ? 'قهوة وشاي (حسب المساحة)' : 'Coffee & tea (per space)' },
                { i: ShieldCheck, t: ar ? 'استقبال وأمن' : 'Reception & security' },
                { i: Timer, t: ar ? 'إلغاء مرن حسب السياسة' : 'Flexible cancellation' },
                { i: ReceiptText, t: tax > 0 ? (ar ? `شامل ضريبة ${tax}% عند التطبيق` : `${tax}% VAT applied at checkout`) : ar ? 'بدون رسوم خفية' : 'No hidden fees' },
              ].map(({ i: Icon, t: text }) => (
                <li key={text} className="flex items-center gap-3 text-sm font-semibold text-ink"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-4" /></span>{text}</li>
              ))}
            </ul>
            {settings?.booking?.cancellation?.tiers && (
              <div className="mt-6 rounded-2xl bg-sand-50 p-4 text-sm text-stone-600">
                <p className="mb-2 font-bold text-ink">{ar ? 'سياسة الاسترداد' : 'Refund policy'}</p>
                <ul className="space-y-1">
                  {[...settings.booking.cancellation.tiers].sort((a, b) => b.hours_before - a.hours_before).map((t) => (
                    <li key={t.hours_before} className="flex items-center gap-2"><Check className="size-4 text-brand-500" />
                      {t.hours_before > 0 ? (ar ? `قبل البدء بـ ${t.hours_before} ساعة أو أكثر: استرداد ${t.refund_percent}%` : `${t.hours_before}h+ before start: ${t.refund_percent}% refund`) : ar ? `أقل من ذلك: استرداد ${t.refund_percent}%` : `Later: ${t.refund_percent}% refund`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="surface p-7">
            <h2 className="mb-5 text-xl font-extrabold text-ink">{ar ? 'خدمات إضافية' : 'Add-ons'}</h2>
            <ul className="divide-y divide-sand-100">
              {(addons.data?.items || []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 py-3.5">
                  <span className="min-w-0"><span className="block truncate text-sm font-bold text-ink">{getLocalized(a.name, lang)}</span><span className="text-xs text-stone-500">{{ per_booking: ar ? 'للحجز' : 'per booking', per_hour: ar ? 'للساعة' : 'per hour', per_person: ar ? 'للفرد' : 'per person' }[a.pricing_mode]}</span></span>
                  <span className="num shrink-0 font-extrabold text-brand-700">{formatEGP(a.price, lang)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
