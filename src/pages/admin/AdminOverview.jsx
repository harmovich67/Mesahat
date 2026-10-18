import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Banknote, CalendarCheck2, Clock, Gauge, Inbox, ShieldCheck, Building2, Trophy, CalendarClock } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate, formatEGP, formatRange, formatTime, getLocalized, methodLabel, timeAgo } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, PageHeader, StatCard, Tabs, Avatar } from '../../components/ui/Dash';
import { EmptyState, Skeleton } from '../../components/ui/Feedback';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AreaTrend, Donut, HBarList } from '../../components/charts/Charts';
import { PaymentReviewModal } from '../../components/payments/PaymentReviewModal';

const pct = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : null);

export function AdminOverview() {
  const { lang } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const can = useAuthStore((s) => s.can);
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');
  const [reviewId, setReviewId] = useState(null);

  const dash = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api.get('/admin/dashboard'), refetchInterval: 30_000 });
  const canReports = can('reports.view');
  const reports = useQuery({
    queryKey: ['admin', 'reports', range],
    queryFn: () => api.get('/admin/reports', { range }),
    enabled: canReports,
  });
  const canPayments = can('payments.view');
  const queue = useQuery({
    queryKey: ['admin', 'payments', 'queue'],
    queryFn: () => api.get('/admin/payments', { status: 'under_review', limit: 5 }),
    enabled: canPayments,
    refetchInterval: 30_000,
  });

  const d = dash.data;
  const r = reports.data;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? (ar ? 'صباح الخير' : 'Good morning') : hour < 18 ? (ar ? 'مساء الخير' : 'Good afternoon') : ar ? 'مساء النور' : 'Good evening';
  const Arrow = ar ? ArrowLeft : ArrowRight;

  const statusItems = (r?.bookings_by_status || d?.status_mix || []).map((s) => ({
    key: s.status,
    label: { pending_payment: ar ? 'بانتظار الدفع' : 'Pending', payment_under_review: ar ? 'قيد المراجعة' : 'In review', confirmed: ar ? 'مؤكد' : 'Confirmed', active: ar ? 'نشط' : 'Active', completed: ar ? 'مكتمل' : 'Completed', cancelled: ar ? 'ملغي' : 'Cancelled', rejected: ar ? 'مرفوض' : 'Rejected', expired: ar ? 'منتهي' : 'Expired' }[s.status] || s.status,
    value: s.count,
  }));

  const chartData = (r?.revenue_daily || d?.revenue_week || []).map((x) => ({ ...x, label: formatDate(x.date, lang, { month: 'short', day: 'numeric', year: undefined }) }));
  const revenueTotal = chartData.reduce((n, x) => n + (x.revenue || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}، ${user?.name?.split(' ')[0] || ''}`}
        description={ar ? 'هذه لمحة سريعة عن أداء ووركورا اليوم. كل الأرقام مباشرة من قاعدة البيانات.' : 'A live snapshot of how WORKORA is performing today.'}
        actions={
          canPayments && (
            <Link to="/admin/payments">
              <Button variant="accent" icon={ShieldCheck} size="sm">
                {ar ? 'مراجعة المدفوعات' : 'Review payments'}
                {d?.pending_payments > 0 && <span className="num ms-1 rounded-full bg-white/25 px-1.5 text-[11px]">{d.pending_payments}</span>}
              </Button>
            </Link>
          )
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          index={0}
          loading={dash.isLoading}
          label={ar ? 'إيرادات اليوم' : "Today's revenue"}
          icon={Banknote}
          value={formatEGP(d?.today_revenue, lang)}
          delta={d && pct(d.today_revenue, d.yesterday_revenue)}
          hint={ar ? 'مقارنة بالأمس' : 'vs yesterday'}
        />
        <StatCard
          index={1}
          loading={dash.isLoading}
          label={ar ? 'حجوزات اليوم' : "Today's bookings"}
          icon={CalendarCheck2}
          tone="blue"
          value={d?.today_bookings}
          delta={d && pct(d.today_bookings, d.yesterday_bookings)}
          hint={ar ? 'مقارنة بالأمس' : 'vs yesterday'}
        />
        <StatCard
          index={2}
          loading={dash.isLoading}
          label={ar ? 'مدفوعات بانتظار المراجعة' : 'Awaiting review'}
          icon={Inbox}
          tone="amber"
          value={d?.pending_payments}
          hint={d?.pending_payments ? (ar ? 'تحتاج إجراءً الآن' : 'needs action') : ar ? 'لا شيء معلّق' : 'all clear'}
          onClick={canPayments ? () => navigate('/admin/payments') : undefined}
        />
        <StatCard
          index={3}
          loading={dash.isLoading}
          label={ar ? 'إشغال اليوم' : "Today's occupancy"}
          icon={Gauge}
          tone="violet"
          value={`${Math.round(d?.occupancy_today || 0)}%`}
          hint={`${d?.active_spaces ?? 0} ${ar ? 'مساحة نشطة' : 'active spaces'}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Revenue */}
        <Card className="xl:col-span-2">
          <CardHeader
            title={ar ? 'الإيرادات' : 'Revenue'}
            description={canReports ? `${ar ? 'الإجمالي في الفترة:' : 'Total in range:'} ${formatEGP(revenueTotal, lang)}` : ar ? 'آخر 7 أيام' : 'Last 7 days'}
            action={
              canReports && (
                <Tabs
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: '7d', label: ar ? '7 أيام' : '7d' },
                    { value: '30d', label: ar ? '30 يوم' : '30d' },
                    { value: '90d', label: ar ? '90 يوم' : '90d' },
                  ]}
                />
              )
            }
          />
          {dash.isLoading || (canReports && reports.isLoading) ? (
            <Skeleton className="h-64" />
          ) : (
            <AreaTrend
              data={chartData}
              xKey="label"
              yKey="revenue"
              name={ar ? 'الإيراد' : 'Revenue'}
              format={(v) => formatEGP(v, lang)}
            />
          )}
        </Card>

        {/* Status mix */}
        <Card>
          <CardHeader title={ar ? 'توزيع حالات الحجز' : 'Booking status mix'} description={canReports ? (ar ? 'في الفترة المحددة' : 'in selected range') : undefined} />
          {statusItems.length ? (
            <Donut items={statusItems} centerLabel={ar ? 'حجز' : 'bookings'} />
          ) : (
            <EmptyState icon={CalendarClock} title={ar ? 'لا توجد حجوزات بعد' : 'No bookings yet'} />
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Payment queue */}
        {canPayments && (
          <Card padded={false} className="xl:col-span-2">
            <div className="flex items-center justify-between px-5 pb-2 pt-5 sm:px-6">
              <div>
                <h3 className="text-base font-bold text-ink">{ar ? 'طابور مراجعة الدفع' : 'Payment review queue'}</h3>
                <p className="text-xs text-stone-500">{ar ? 'الأقدم أولاً' : 'Oldest first'}</p>
              </div>
              <Link to="/admin/payments" className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">
                {ar ? 'عرض الكل' : 'View all'} <Arrow className="size-3.5" />
              </Link>
            </div>
            {queue.isLoading ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : queue.data?.items?.length ? (
              <ul className="divide-y divide-sand-100">
                {queue.data.items.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => setReviewId(p.id)} className="flex w-full items-center gap-4 px-5 py-3.5 text-start transition-colors hover:bg-brand-50/50 sm:px-6">
                      <Avatar name={p.booking?.customer?.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{p.booking?.customer?.name}</p>
                        <p className="truncate text-xs text-stone-500">
                          {getLocalized(p.booking?.space?.name, lang)} · <span className="num">{p.booking?.booking_number}</span>
                        </p>
                      </div>
                      <div className="hidden text-end sm:block">
                        <p className="text-xs font-semibold text-stone-600">{methodLabel(p.method, lang)}</p>
                        <p className="text-[11px] text-stone-400">{timeAgo(p.submitted_at, lang)}</p>
                      </div>
                      <p className="num shrink-0 text-sm font-extrabold text-brand-700">{formatEGP(p.amount, lang)}</p>
                      <span className="hidden rounded-lg bg-accent-50 px-2.5 py-1 text-[11px] font-bold text-accent-700 sm:block">{ar ? 'مراجعة' : 'Review'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={ShieldCheck} title={ar ? 'لا توجد مدفوعات معلّقة' : 'Nothing to review'} description={ar ? 'تمت مراجعة كل الإيصالات.' : 'All receipts are processed.'} />
            )}
          </Card>
        )}

        {/* Upcoming */}
        <Card className={canPayments ? '' : 'xl:col-span-3'}>
          <CardHeader title={ar ? 'الحجوزات القادمة' : 'Upcoming bookings'} />
          {dash.isLoading ? (
            <Skeleton className="h-40" />
          ) : d?.upcoming?.length ? (
            <ul className="space-y-3">
              {d.upcoming.map((b) => (
                <li key={b.id} className="flex items-start gap-3 rounded-xl border border-sand-100 p-3">
                  <div className="grid w-12 shrink-0 place-items-center rounded-xl bg-brand-50 py-1.5 text-brand-700">
                    <span className="num text-lg font-black leading-none">{new Date(b.start_at).toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Africa/Cairo' })}</span>
                    <span className="text-[10px] font-semibold">{formatDate(b.start_at, lang, { day: undefined, month: 'short', year: undefined })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{getLocalized(b.space?.name, lang)}</p>
                    <p className="truncate text-xs text-stone-500">{b.customer?.name}</p>
                    <p className="num mt-0.5 flex items-center gap-1 text-[11px] text-stone-400">
                      <Clock className="size-3" /> {formatTime(b.start_at, lang)} – {formatTime(b.end_at, lang)}
                    </p>
                  </div>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarClock} title={ar ? 'لا توجد حجوزات قادمة' : 'No upcoming bookings'} className="py-8" />
          )}
        </Card>
      </div>

      {canReports && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title={ar ? 'المساحات الأكثر طلباً' : 'Top spaces'} description={ar ? 'حسب الإيراد في الفترة' : 'by revenue in range'} action={<Trophy className="size-5 text-accent-500" />} />
            {reports.isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <HBarList
                emptyLabel={ar ? 'لا توجد بيانات' : 'No data'}
                items={(r?.popular_spaces || []).filter((s) => s.bookings > 0).slice(0, 5).map((s) => ({ key: s.id, label: getLocalized(s.name, lang), value: s.revenue, sub: `${s.bookings} ${ar ? 'حجز' : 'bookings'}` }))}
                format={(v) => formatEGP(v, lang)}
              />
            )}
          </Card>
          <Card>
            <CardHeader title={ar ? 'طرق الدفع' : 'Payment methods'} description={ar ? 'المبالغ المعتمدة في الفترة' : 'approved amounts in range'} action={<Building2 className="size-5 text-brand-500" />} />
            {reports.isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <HBarList
                color="#3b78c4"
                emptyLabel={ar ? 'لا توجد بيانات' : 'No data'}
                items={(r?.payment_methods || []).map((m) => ({ key: m.method, label: methodLabel(m.method, lang), value: m.amount, sub: `${m.count} ${ar ? 'عملية' : 'tx'}` }))}
                format={(v) => formatEGP(v, lang)}
              />
            )}
          </Card>
        </div>
      )}

      {reviewId && <PaymentReviewModal isOpen paymentId={reviewId} onClose={() => setReviewId(null)} />}
    </div>
  );
}
