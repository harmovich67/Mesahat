import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck, CheckCircle2, CircleAlert, Hourglass, Star, Wallet, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { cn, getLocalized, timeAgo } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/Dash';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';

const ICONS = {
  booking_confirmed: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  payment_approved: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  payment_submitted: { icon: Hourglass, tone: 'bg-blue-50 text-blue-600' },
  payment_rejected: { icon: XCircle, tone: 'bg-rose-50 text-rose-600' },
  booking_cancelled: { icon: XCircle, tone: 'bg-rose-50 text-rose-600' },
  new_receipt_requested: { icon: CircleAlert, tone: 'bg-amber-50 text-amber-600' },
  booking_expired: { icon: Hourglass, tone: 'bg-stone-100 text-stone-500' },
  review_request: { icon: Star, tone: 'bg-accent-50 text-accent-600' },
  proof_uploaded: { icon: Wallet, tone: 'bg-blue-50 text-blue-600' },
};

export function Notifications() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/notifications') });
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });

  const readAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: refresh });
  const open = async (n) => {
    if (!n.read_at) api.post(`/notifications/${n.id}/read`).then(refresh);
    if (n.link) navigate(n.link.replace(/^\/account/, '/dashboard'));
  };
  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={ar ? 'الإشعارات' : 'Notifications'}
        description={data?.unread ? (ar ? `لديك ${data.unread} إشعارات غير مقروءة` : `${data.unread} unread`) : ar ? 'أنت على اطلاع بكل جديد.' : 'You are all caught up.'}
        actions={data?.unread > 0 && <Button variant="outline" size="sm" icon={CheckCheck} loading={readAll.isPending} onClick={() => readAll.mutate()}>{ar ? 'تحديد الكل كمقروء' : 'Mark all read'}</Button>}
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : items.length ? (
        <ul className="surface divide-y divide-sand-100 overflow-hidden">
          {items.map((n, i) => {
            const meta = ICONS[n.type] || { icon: Bell, tone: 'bg-sand-100 text-stone-500' };
            const Icon = meta.icon;
            return (
              <li key={n.id} style={{ '--i': Math.min(i, 8) }} className="stagger">
                <button onClick={() => open(n)} className={cn('flex w-full items-start gap-4 p-4 text-start transition-colors hover:bg-sand-50 sm:p-5', !n.read_at && 'bg-brand-50/40')}>
                  <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', meta.tone)}><Icon className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-bold text-ink">{getLocalized(n.title, lang)}</span>
                      {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent-500" aria-label="unread" />}
                    </span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-stone-600">{getLocalized(n.body, lang)}</span>
                    <span className="mt-1.5 block text-[11px] text-stone-400">{timeAgo(n.created_at || n.createdAt, lang)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="surface"><EmptyState icon={BellOff} title={ar ? 'لا توجد إشعارات' : 'No notifications yet'} description={ar ? 'سنخبرك هنا بكل تحديث على حجوزاتك.' : 'Updates about your bookings will show up here.'} /></div>
      )}
    </div>
  );
}
