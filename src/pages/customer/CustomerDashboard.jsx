import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CalendarCheck2, CalendarX2, Compass, History, Hourglass, RefreshCw, Wallet } from 'lucide-react';
import { api } from '../../lib/api';
import { formatEGP, getLocalized, unitLabel } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, PageHeader, StatCard } from '../../components/ui/Dash';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { BookingCard } from '../../components/bookings/BookingCard';

export function CustomerDashboard() {
  const { lang } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const ar = lang === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;

  const bookings = useQuery({ queryKey: ['bookings', 'all'], queryFn: () => api.get('/bookings') });
  const rebook = useQuery({ queryKey: ['bookings', 'rebook'], queryFn: () => api.get('/bookings/rebook-suggestions') });

  const items = bookings.data?.items || [];
  const now = Date.now();
  const pendingPay = items.filter((b) => b.status === 'pending_payment');
  const inReview = items.filter((b) => b.status === 'payment_under_review');
  const upcoming = items.filter((b) => ['confirmed', 'active'].includes(b.status) && new Date(b.end_at) >= now).sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  const done = items.filter((b) => b.status === 'completed');
  const spent = items.filter((b) => b.payment && ['approved', 'refund_pending', 'refunded'].includes(b.payment.status)).reduce((n, b) => n + b.final_amount - (b.refund_amount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${ar ? 'أهلاً' : 'Welcome'}، ${user?.name?.split(' ')[0] || ''} 👋`}
        description={ar ? 'هنا تجد حجوزاتك القادمة، وما يحتاج إجراءً منك، واختصاراً لإعادة الحجز.' : 'Your upcoming bookings, anything that needs attention, and quick rebooking.'}
        actions={<Link to="/spaces"><Button icon={Compass}>{ar ? 'احجز مساحة' : 'Book a space'}</Button></Link>}
      />

      {bookings.error ? (
        <ErrorState error={bookings.error} onRetry={bookings.refetch} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard index={0} loading={bookings.isLoading} icon={CalendarCheck2} label={ar ? 'حجوزات قادمة' : 'Upcoming'} value={upcoming.length} />
            <StatCard index={1} loading={bookings.isLoading} icon={Hourglass} tone="amber" label={ar ? 'بانتظار إجراء' : 'Needs action'} value={pendingPay.length + inReview.length} hint={pendingPay.length ? (ar ? 'ادفع لتأكيد الحجز' : 'pay to confirm') : inReview.length ? (ar ? 'قيد المراجعة' : 'in review') : undefined} />
            <StatCard index={2} loading={bookings.isLoading} icon={History} tone="blue" label={ar ? 'حجوزات مكتملة' : 'Completed'} value={done.length} />
            <StatCard index={3} loading={bookings.isLoading} icon={Wallet} tone="accent" label={ar ? 'إجمالي ما أنفقته' : 'Total spent'} value={formatEGP(spent, lang)} />
          </div>

          {pendingPay.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-accent-700"><Hourglass className="size-4" />{ar ? 'أكمل الدفع قبل انتهاء المهلة' : 'Finish paying before the hold expires'}</h2>
              <div className="grid gap-3 lg:grid-cols-2">{pendingPay.map((b, i) => <BookingCard key={b.id} booking={b} index={i} />)}</div>
            </section>
          )}

          <Card padded={false}>
            <div className="p-5 pb-3 sm:p-6 sm:pb-3">
              <CardHeader
                className="mb-0"
                title={ar ? 'الحجوزات القادمة' : 'Upcoming bookings'}
                action={<Link to="/dashboard/bookings" className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">{ar ? 'كل الحجوزات' : 'All bookings'}<Arrow className="size-3.5" /></Link>}
              />
            </div>
            <div className="space-y-3 p-5 pt-2 sm:p-6 sm:pt-2">
              {bookings.isLoading ? (
                [0, 1].map((i) => <Skeleton key={i} className="h-32" />)
              ) : upcoming.length ? (
                upcoming.slice(0, 4).map((b, i) => <BookingCard key={b.id} booking={b} index={i} className="shadow-none" />)
              ) : (
                <EmptyState icon={CalendarX2} title={ar ? 'لا توجد حجوزات قادمة' : 'No upcoming bookings'} description={ar ? 'ابدأ باختيار المساحة المناسبة لك.' : 'Start by picking the right space.'} action={<Link to="/spaces"><Button>{ar ? 'تصفح المساحات' : 'Browse spaces'}</Button></Link>} />
              )}
            </div>
          </Card>
        </>
      )}

      {rebook.data?.items?.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ink"><RefreshCw className="size-4 text-brand-600" />{ar ? 'احجز مرة أخرى بنفس إعداداتك' : 'Book again, your way'}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rebook.data.items.map((r) => {
              const qs = new URLSearchParams({ unit: r.unit, start: r.start_time, minutes: r.duration_minutes, guests: r.guest_count }).toString();
              return (
                <Link key={r.space.id} to={`/spaces/${r.space.slug}?${qs}`} className="surface surface-hover group overflow-hidden">
                  <div className="relative aspect-[16/9] overflow-hidden bg-sand-100">
                    <img src={r.space.cover || '/images/hero.jpg'} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <span className="num absolute start-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-brand-700 backdrop-blur">×{r.times_booked}</span>
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-bold text-ink">{getLocalized(r.space.name, lang)}</h3>
                    <p className="mt-0.5 truncate text-xs text-stone-500">{getLocalized(r.space.location, lang)} · {unitLabel(r.unit, lang)} · <span className="num">{r.start_time}</span> · {r.guest_count} {ar ? 'أفراد' : 'ppl'}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-700">{ar ? 'احجز بنفس الإعدادات' : 'Rebook'} <Arrow className="size-3.5" /></span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
