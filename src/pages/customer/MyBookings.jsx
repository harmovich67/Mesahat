import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange } from 'lucide-react';
import { api } from '../../lib/api';
import { useLanguageStore } from '../../store/languageStore';
import { Button } from '../../components/ui/Button';
import { PageHeader, Tabs } from '../../components/ui/Dash';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { BookingCard } from '../../components/bookings/BookingCard';

export function MyBookings() {
  const ar = useLanguageStore((s) => s.lang) === 'ar';
  const [scope, setScope] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bookings', scope],
    queryFn: () => api.get('/bookings', { scope }),
  });
  const all = useQuery({ queryKey: ['bookings', 'all'], queryFn: () => api.get('/bookings') });
  const count = (fn) => all.data?.items?.filter(fn).length;
  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader title={ar ? 'حجوزاتي' : 'My bookings'} description={ar ? 'كل حجوزاتك وحالتها في مكان واحد.' : 'All your bookings and their status in one place.'} />
      <Tabs
        value={scope}
        onChange={setScope}
        options={[
          { value: '', label: ar ? 'الكل' : 'All', count: all.data?.items?.length },
          { value: 'upcoming', label: ar ? 'القادمة' : 'Upcoming', count: count((b) => ['confirmed', 'active'].includes(b.status) && new Date(b.end_at) >= new Date()) },
          { value: 'pending', label: ar ? 'بانتظار الدفع' : 'Pending', count: count((b) => ['pending_payment', 'payment_under_review'].includes(b.status)) },
          { value: 'past', label: ar ? 'السابقة' : 'Past', count: count((b) => ['completed', 'cancelled', 'expired', 'rejected'].includes(b.status)) },
        ]}
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : items.length ? (
        <div className="grid gap-3">{items.map((b, i) => <BookingCard key={b.id} booking={b} index={i} />)}</div>
      ) : (
        <div className="surface">
          <EmptyState icon={CalendarRange} title={ar ? 'لا توجد حجوزات هنا' : 'No bookings here'} description={ar ? 'عندما تحجز مساحة ستظهر هنا.' : 'Bookings will appear here.'} action={<Link to="/spaces"><Button>{ar ? 'تصفح المساحات' : 'Browse spaces'}</Button></Link>} />
        </div>
      )}
    </div>
  );
}
