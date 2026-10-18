import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileClock, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDateTime, ltr } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { Button } from '../../components/ui/Button';
import { Avatar, Card, DataTable, PageHeader, Pagination, SearchInput, useDebounced } from '../../components/ui/Dash';
import { EmptyState, ErrorState } from '../../components/ui/Feedback';
import { Badge } from '../../components/ui/StatusBadge';

const LIMIT = 20;

const ACTION_LABELS = {
  'payment.approve': { ar: 'اعتماد دفع', en: 'Payment approved', tone: 'green' },
  'payment.reject': { ar: 'رفض دفع', en: 'Payment rejected', tone: 'rose' },
  'payment.request_new_receipt': { ar: 'طلب إيصال جديد', en: 'New receipt requested', tone: 'amber' },
  'payment.refund': { ar: 'تسجيل استرداد', en: 'Refund recorded', tone: 'orange' },
  'payment.view_receipt': { ar: 'عرض إيصال', en: 'Receipt viewed', tone: 'sky' },
  'booking.cancel': { ar: 'إلغاء حجز', en: 'Booking cancelled', tone: 'rose' },
  'customer.suspend': { ar: 'إيقاف عميل', en: 'Customer suspended', tone: 'red' },
  'customer.activate': { ar: 'تفعيل عميل', en: 'Customer activated', tone: 'green' },
};

export function AdminAuditLogs() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  useEffect(() => setPage(1), [q]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['admin', 'audit', page, q],
    queryFn: () => api.get('/admin/audit-logs', { page, limit: LIMIT, q }),
    placeholderData: (prev) => prev,
  });

  const columns = [
    { key: 'at', header: ar ? 'الوقت' : 'When', render: (l) => <span className="num whitespace-nowrap text-xs text-stone-600">{formatDateTime(l.created_at, lang)}</span> },
    {
      key: 'actor',
      header: ar ? 'المنفّذ' : 'Actor',
      render: (l) => (
        <span className="flex items-center gap-2.5 font-semibold text-ink">
          <Avatar name={l.actor_name} size="sm" className="size-7! text-[10px]!" />
          {l.actor_name}
        </span>
      ),
    },
    {
      key: 'action',
      header: ar ? 'العملية' : 'Action',
      render: (l) => {
        const a = ACTION_LABELS[l.action];
        return a ? <Badge variant={a.tone}>{a[lang]}</Badge> : <span {...ltr} className="rounded bg-sand-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-stone-700">{l.action}</span>;
      },
    },
    { key: 'target', header: ar ? 'الهدف' : 'Target', render: (l) => <span className="num text-sm text-stone-700">{l.entity_label || l.entity_type || '—'}</span> },
    { key: 'meta', header: ar ? 'تفاصيل' : 'Details', render: (l) => <span className="line-clamp-2 max-w-[260px] text-xs text-stone-500">{l.meta ? Object.entries(l.meta).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}</span> },
    { key: 'ip', header: 'IP', render: (l) => <span {...ltr} className="font-mono text-[11px] text-stone-400">{l.ip || '—'}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileClock}
        title={ar ? 'سجل المراجعة' : 'Audit log'}
        description={ar ? 'سجل دائم لكل القرارات الحساسة: اعتماد المدفوعات، الرفض، الاسترداد، والإلغاء.' : 'A permanent record of every sensitive decision: approvals, rejections, refunds and cancellations.'}
        actions={
          <>
            <SearchInput className="w-full sm:w-64" value={search} onChange={setSearch} placeholder={ar ? 'بحث في السجل…' : 'Search log…'} />
            <Button variant="outline" size="icon" icon={RefreshCw} loading={isFetching && !isLoading} aria-label="refresh" onClick={() => refetch()} />
          </>
        }
      />
      <Card padded={false}>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data?.items || []}
              loading={isLoading}
              empty={<EmptyState icon={FileClock} title={ar ? 'السجل فارغ' : 'No entries yet'} description={ar ? 'ستظهر هنا قرارات الفريق فور اتخاذها.' : 'Staff decisions will appear here as they happen.'} />}
            />
            <Pagination page={page} total={data?.total || 0} limit={LIMIT} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
