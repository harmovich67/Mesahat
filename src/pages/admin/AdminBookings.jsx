import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import arLocale from '@fullcalendar/core/locales/ar';
import { CalendarDays, CalendarRange, List, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate, formatEGP, formatTime, getLocalized, ltr, methodLabel } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { Button } from '../../components/ui/Button';
import { Card, DataTable, PageHeader, Pagination, SearchInput, Tabs, useDebounced } from '../../components/ui/Dash';
import { EmptyState, ErrorState } from '../../components/ui/Feedback';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Select } from '../../components/ui/Select';
import { AdminBookingDrawer } from '../../components/bookings/AdminBookingDrawer';

const LIMIT = 12;

function CalendarView({ onOpen }) {
  const { lang, dir } = useLanguageStore();
  const [range, setRange] = useState(null);
  const calRef = useRef(null);

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'calendar', range?.from, range?.to],
    queryFn: () => api.get('/admin/calendar', range),
    enabled: Boolean(range),
    placeholderData: (prev) => prev,
  });

  const events = useMemo(
    () =>
      (data?.events || []).map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        backgroundColor: e.color,
        borderColor: e.color,
        extendedProps: e,
      })),
    [data],
  );

  return (
    <Card padded={false} className={isFetching ? 'opacity-90 transition-opacity' : ''}>
      <div className="p-3 sm:p-5" dir="ltr">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          initialView={window.innerWidth < 640 ? 'listWeek' : 'dayGridMonth'}
          locale={lang === 'ar' ? arLocale : 'en'}
          direction={dir}
          firstDay={6}
          height="auto"
          headerToolbar={{ start: 'prev,next today', center: 'title', end: 'dayGridMonth,timeGridWeek,listWeek' }}
          buttonText={lang === 'ar' ? { today: 'اليوم', month: 'شهر', week: 'أسبوع', list: 'قائمة' } : { today: 'Today', month: 'Month', week: 'Week', list: 'List' }}
          events={events}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
          dayMaxEvents={3}
          slotMinTime="07:00:00"
          slotMaxTime="23:00:00"
          nowIndicator
          datesSet={(arg) => setRange({ from: arg.startStr.slice(0, 10), to: arg.endStr.slice(0, 10) })}
          eventClick={(info) => info.event.extendedProps.kind === 'booking' && onOpen(info.event.id)}
        />
      </div>
    </Card>
  );
}

export function AdminBookings() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState('list');
  const [scope, setScope] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const openId = params.get('open');

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['admin', 'bookings', { scope, status, page, q }],
    queryFn: () => api.get('/admin/bookings', { scope, status, q, page, limit: LIMIT }),
    placeholderData: (prev) => prev,
    enabled: view === 'list',
  });

  useEffect(() => setPage(1), [scope, status, q]);

  const setOpen = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('open', id);
    else next.delete('open');
    setParams(next, { replace: true });
  };

  const columns = [
    { key: 'booking_number', header: ar ? 'رقم الحجز' : 'Booking', render: (b) => <span className="num whitespace-nowrap font-mono text-xs font-bold text-stone-500">{b.booking_number}</span> },
    {
      key: 'customer',
      header: ar ? 'العميل' : 'Customer',
      render: (b) => (
        <div className="min-w-[130px]">
          <p className="font-bold text-ink">{b.customer?.name}</p>
          <p className="text-[11px] text-stone-400" {...ltr}>{b.customer?.phone}</p>
        </div>
      ),
    },
    { key: 'space', header: ar ? 'المساحة' : 'Space', render: (b) => <span className="line-clamp-2 min-w-[140px] font-medium text-stone-700">{getLocalized(b.space?.name, lang)}</span> },
    {
      key: 'when',
      header: ar ? 'الموعد' : 'When',
      render: (b) => (
        <div className="whitespace-nowrap">
          <p className="font-semibold text-ink">{formatDate(b.start_at, lang)}</p>
          <p className="num text-[11px] text-stone-400">{formatTime(b.start_at, lang)} – {formatTime(b.end_at, lang)}</p>
        </div>
      ),
    },
    { key: 'amount', header: ar ? 'المبلغ' : 'Amount', render: (b) => <span className="num whitespace-nowrap font-extrabold text-brand-700">{formatEGP(b.final_amount, lang)}</span> },
    { key: 'method', header: ar ? 'الدفع' : 'Payment', render: (b) => <span className="whitespace-nowrap text-xs text-stone-600">{b.payment?.method ? methodLabel(b.payment.method, lang) : '—'}</span> },
    { key: 'status', header: ar ? 'الحالة' : 'Status', render: (b) => <StatusBadge status={b.status} /> },
  ];

  const statusOptions = ['pending_payment', 'payment_under_review', 'confirmed', 'active', 'completed', 'cancelled', 'rejected', 'expired'];
  const statusLabel = (s) => ({ pending_payment: ar ? 'بانتظار الدفع' : 'Pending payment', payment_under_review: ar ? 'قيد مراجعة الدفع' : 'Under review', confirmed: ar ? 'مؤكد' : 'Confirmed', active: ar ? 'نشط' : 'Active', completed: ar ? 'مكتمل' : 'Completed', cancelled: ar ? 'ملغي' : 'Cancelled', rejected: ar ? 'مرفوض' : 'Rejected', expired: ar ? 'منتهي' : 'Expired' }[s]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarRange}
        title={ar ? 'الحجوزات والتقويم' : 'Bookings & calendar'}
        description={ar ? 'تابع كل الحجوزات عبر الفروع، افتح أي حجز لرؤية تفاصيله وسجله، أو انتقل للتقويم.' : 'Every booking across branches — open one for details and history, or switch to the calendar.'}
        actions={
          <>
            <Tabs
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: <span className="inline-flex items-center gap-1.5"><List className="size-3.5" />{ar ? 'قائمة' : 'List'}</span> },
                { value: 'calendar', label: <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{ar ? 'تقويم' : 'Calendar'}</span> },
              ]}
            />
            {view === 'list' && (
              <Button variant="outline" size="icon" aria-label="refresh" loading={isFetching && !isLoading} icon={RefreshCw} onClick={() => refetch()} />
            )}
          </>
        }
      />

      {view === 'calendar' ? (
        <CalendarView onOpen={setOpen} />
      ) : (
        <Card padded={false}>
          <div className="flex flex-col gap-3 border-b border-sand-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              value={scope}
              onChange={setScope}
              options={[
                { value: '', label: ar ? 'الكل' : 'All' },
                { value: 'today', label: ar ? 'اليوم' : 'Today' },
                { value: 'upcoming', label: ar ? 'القادمة' : 'Upcoming' },
              ]}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="sm:w-48" aria-label="status">
                <option value="">{ar ? 'كل الحالات' : 'All statuses'}</option>
                {statusOptions.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </Select>
              <SearchInput className="sm:w-64" value={search} onChange={setSearch} placeholder={ar ? 'رقم الحجز، العميل، الهاتف…' : 'Booking #, customer, phone…'} />
            </div>
          </div>
          {error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={data?.items || []}
                loading={isLoading}
                onRowClick={(b) => setOpen(b.id)}
                empty={<EmptyState icon={CalendarRange} title={ar ? 'لا توجد حجوزات مطابقة' : 'No matching bookings'} description={ar ? 'جرّب تغيير الفلاتر أو البحث.' : 'Try adjusting filters or search.'} />}
              />
              <Pagination page={page} total={data?.total || 0} limit={LIMIT} onChange={setPage} />
            </>
          )}
        </Card>
      )}

      <AdminBookingDrawer bookingId={openId} onClose={() => setOpen(null)} />
    </div>
  );
}
