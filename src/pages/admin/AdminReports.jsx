import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Banknote, CalendarCheck2, Download, Percent, Receipt, TrendingUp, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate, formatEGP, formatNumber, getLocalized, methodLabel, unitLabel } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, PageHeader, StatCard, Tabs } from '../../components/ui/Dash';
import { ErrorState, Skeleton } from '../../components/ui/Feedback';
import { AreaTrend, BarTrend, CHART_COLORS, Donut, HBarList } from '../../components/charts/Charts';

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function AdminReports() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const [range, setRange] = useState('30d');
  const { data: r, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'reports', range],
    queryFn: () => api.get('/admin/reports', { range }),
  });

  const day = (x) => formatDate(x, lang, { month: 'short', day: 'numeric', year: undefined });
  const t = r?.totals;

  const exportCsv = () => {
    if (!r) return;
    const rows = [[ar ? 'التاريخ' : 'Date', ar ? 'الإيراد' : 'Revenue', ar ? 'عدد المدفوعات' : 'Payments', ar ? 'الحجوزات' : 'Bookings']];
    const bookings = new Map(r.bookings_daily.map((b) => [b.date, b.bookings]));
    r.revenue_daily.forEach((d) => rows.push([d.date, d.revenue, d.payments, bookings.get(d.date) || 0]));
    const blob = new Blob([`﻿${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `workora-report-${r.range.from}_${r.range.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const statusLabel = (s) => ({ pending_payment: ar ? 'بانتظار الدفع' : 'Pending', payment_under_review: ar ? 'قيد المراجعة' : 'In review', confirmed: ar ? 'مؤكد' : 'Confirmed', active: ar ? 'نشط' : 'Active', completed: ar ? 'مكتمل' : 'Completed', cancelled: ar ? 'ملغي' : 'Cancelled', rejected: ar ? 'مرفوض' : 'Rejected', expired: ar ? 'منتهي' : 'Expired' }[s] || s);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TrendingUp}
        title={ar ? 'التقارير والإيرادات' : 'Reports & revenue'}
        description={
          r ? `${ar ? 'الفترة:' : 'Range:'} ${formatDate(r.range.from, lang)} → ${formatDate(r.range.to, lang)}` : ar ? 'تحليل الأداء المالي والتشغيلي.' : 'Financial and operational performance.'
        }
        actions={
          <>
            <Tabs
              value={range}
              onChange={setRange}
              options={[
                { value: 'today', label: ar ? 'اليوم' : 'Today' },
                { value: '7d', label: ar ? '7 أيام' : '7d' },
                { value: '30d', label: ar ? '30 يوم' : '30d' },
                { value: '90d', label: ar ? '90 يوم' : '90d' },
              ]}
            />
            <Button variant="outline" size="sm" icon={Download} onClick={exportCsv} disabled={!r}>
              CSV
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
            <StatCard index={0} loading={isLoading} icon={Banknote} label={ar ? 'الإيراد' : 'Revenue'} value={formatEGP(t?.revenue, lang)} />
            <StatCard index={1} loading={isLoading} icon={CalendarCheck2} tone="blue" label={ar ? 'الحجوزات' : 'Bookings'} value={formatNumber(t?.bookings, lang)} />
            <StatCard index={2} loading={isLoading} icon={Receipt} tone="accent" label={ar ? 'متوسط الحجز' : 'Avg. booking'} value={formatEGP(t?.avg_booking_value, lang)} />
            <StatCard index={3} loading={isLoading} icon={UserPlus} tone="violet" label={ar ? 'عملاء جدد' : 'New customers'} value={formatNumber(t?.new_customers, lang)} />
            <StatCard index={4} loading={isLoading} icon={Percent} tone="rose" label={ar ? 'نسبة الإلغاء' : 'Cancellation rate'} value={`${t?.cancellation_rate ?? 0}%`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title={ar ? 'الإيراد اليومي' : 'Daily revenue'} description={ar ? 'صافي بعد المسترد، حسب تاريخ اعتماد الدفع' : 'net of refunds, by approval date'} />
              {isLoading ? <Skeleton className="h-64" /> : <AreaTrend data={r.revenue_daily} yKey="revenue" name={ar ? 'الإيراد' : 'Revenue'} tickFormat={day} labelFormat={day} format={(v) => formatEGP(v, lang)} />}
            </Card>
            <Card>
              <CardHeader title={ar ? 'حالات الحجز' : 'Booking status'} />
              {isLoading ? (
                <Skeleton className="h-52" />
              ) : (
                <Donut items={r.bookings_by_status.map((s) => ({ key: s.status, label: statusLabel(s.status), value: s.count }))} centerLabel={ar ? 'حجز' : 'bookings'} />
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title={ar ? 'الحجوزات اليومية' : 'Daily bookings'} description={ar ? 'حسب تاريخ بدء الحجز' : 'by start date'} />
              {isLoading ? <Skeleton className="h-52" /> : <BarTrend data={r.bookings_daily} yKey="bookings" name={ar ? 'حجوزات' : 'Bookings'} tickFormat={day} labelFormat={day} />}
            </Card>
            <Card>
              <CardHeader title={ar ? 'نمو العملاء' : 'Customer growth'} description={ar ? 'إجمالي العملاء المسجلين' : 'total registered customers'} />
              {isLoading ? <Skeleton className="h-52" /> : <AreaTrend data={r.customer_growth} yKey="total" height={220} color={CHART_COLORS[3]} name={ar ? 'العملاء' : 'Customers'} tickFormat={day} labelFormat={day} />}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title={ar ? 'المساحات الأكثر إيراداً' : 'Top spaces'} />
              <HBarList
                emptyLabel={ar ? 'لا توجد بيانات' : 'No data'}
                items={(r?.popular_spaces || []).filter((s) => s.revenue > 0 || s.bookings > 0).map((s) => ({ key: s.id, label: getLocalized(s.name, lang), value: s.revenue, sub: `${s.bookings} ${ar ? 'حجز' : 'bk'}` }))}
                format={(v) => formatEGP(v, lang)}
              />
            </Card>
            <Card>
              <CardHeader title={ar ? 'الأقل استخداماً' : 'Least used'} description={ar ? 'فرصة للترويج أو إعادة التسعير' : 'candidates for promotion'} />
              <HBarList
                color={CHART_COLORS[2]}
                emptyLabel={ar ? 'لا توجد بيانات' : 'No data'}
                items={(r?.least_used_spaces || []).map((s) => ({ key: s.id, label: getLocalized(s.name, lang), value: s.bookings, sub: ar ? 'حجز' : 'bookings' }))}
              />
            </Card>
            <Card>
              <CardHeader title={ar ? 'وسائل الدفع' : 'Payment methods'} />
              <HBarList
                color={CHART_COLORS[1]}
                emptyLabel={ar ? 'لا توجد بيانات' : 'No data'}
                items={(r?.payment_methods || []).map((m) => ({ key: m.method, label: methodLabel(m.method, lang), value: m.amount, sub: `${m.count} ${ar ? 'عملية' : 'tx'}` }))}
                format={(v) => formatEGP(v, lang)}
              />
              {r?.bookings_by_unit?.length > 0 && (
                <div className="mt-6 border-t border-sand-100 pt-5">
                  <h4 className="mb-3 text-xs font-bold text-stone-500">{ar ? 'حسب نوع الحجز' : 'By booking unit'}</h4>
                  <HBarList
                    color={CHART_COLORS[3]}
                    items={r.bookings_by_unit.map((u) => ({ key: u.unit, label: unitLabel(u.unit, lang), value: u.count }))}
                  />
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
