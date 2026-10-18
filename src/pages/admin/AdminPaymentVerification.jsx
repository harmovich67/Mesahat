import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Eye, RefreshCw, ShieldCheck, Smartphone, Landmark, Wallet } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDateTime, formatEGP, getLocalized, ltr, methodLabel, timeAgo } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader, Pagination, SearchInput, Tabs, useDebounced } from '../../components/ui/Dash';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PaymentReviewModal } from '../../components/payments/PaymentReviewModal';
import { ReceiptViewer } from '../../components/payments/ReceiptViewer';

const LIMIT = 10;
const METHOD_ICON = { vodafone_cash: Smartphone, instapay: Landmark };

export function AdminPaymentVerification() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const [tab, setTab] = useState('under_review');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [reviewId, setReviewId] = useState(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['admin', 'payments', tab, page, q],
    queryFn: () => api.get('/admin/payments', { status: tab, page, limit: LIMIT, q }),
    placeholderData: (prev) => prev,
    refetchInterval: tab === 'under_review' ? 30_000 : false,
  });
  const counts = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api.get('/admin/dashboard'),
  });

  const tabs = [
    { value: 'under_review', label: ar ? 'بانتظار المراجعة' : 'Pending review', count: counts.data?.pending_payments },
    { value: 'refund_pending', label: ar ? 'استرداد معلّق' : 'Refunds due' },
    { value: 'approved', label: ar ? 'المعتمدة' : 'Approved' },
    { value: 'rejected', label: ar ? 'المرفوضة' : 'Rejected' },
    { value: 'all', label: ar ? 'الكل' : 'All' },
  ];
  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title={ar ? 'مراجعة المدفوعات' : 'Payment verification'}
        description={ar ? 'افحص إيصالات فودافون كاش وإنستاباي ثم اعتمد الدفع أو ارفضه أو اطلب إيصالاً أوضح.' : 'Inspect Vodafone Cash / InstaPay receipts, then approve, reject or request a clearer one.'}
        actions={
          <Button variant="outline" size="sm" icon={RefreshCw} loading={isFetching && !isLoading} onClick={() => refetch()}>
            {ar ? 'تحديث' : 'Refresh'}
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs options={tabs} value={tab} onChange={(v) => { setTab(v); setPage(1); }} />
        <SearchInput
          className="w-full lg:w-72"
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder={ar ? 'رقم الحجز، اسم العميل، رقم المرجع…' : 'Booking #, customer, reference…'}
        />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : items.length ? (
        <Card padded={false}>
          <ul className="divide-y divide-sand-100">
            {items.map((p, i) => {
              const Icon = METHOD_ICON[p.method] || Wallet;
              return (
                <li key={p.id} style={{ '--i': i }} className="stagger flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <button
                    onClick={() => setReviewId(p.id)}
                    className="group relative size-24 shrink-0 overflow-hidden rounded-2xl border border-sand-200 bg-sand-50"
                    aria-label={ar ? 'معاينة الإيصال' : 'Inspect receipt'}
                  >
                    {p.has_receipt ? <ReceiptViewer paymentId={p.id} version={p.receipt?.id} admin compact /> : <Wallet className="m-auto mt-8 size-6 text-stone-300" />}
                    <span className="absolute inset-0 grid place-items-center bg-brand-950/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Eye className="size-5" />
                    </span>
                  </button>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num font-mono text-xs font-bold text-stone-400">{p.booking?.booking_number}</span>
                      <StatusBadge type="payment" status={p.status} />
                      {p.needs_new_receipt && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{ar ? 'بانتظار إيصال جديد' : 'awaiting new receipt'}</span>}
                    </div>
                    <h3 className="truncate text-base font-bold text-ink">{getLocalized(p.booking?.space?.name, lang)}</h3>
                    <p className="truncate text-sm text-stone-600">
                      <b className="text-ink">{p.booking?.customer?.name}</b> · <span {...ltr}>{p.booking?.customer?.phone}</span>
                    </p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                      <span className="inline-flex items-center gap-1 font-semibold text-stone-700">
                        <Icon className="size-3.5 text-brand-600" /> {methodLabel(p.method, lang)}
                      </span>
                      {p.sender_info && <span {...ltr} className="font-mono">{p.sender_info}</span>}
                      {p.transfer_reference && <span {...ltr} className="font-mono">#{p.transfer_reference}</span>}
                      <span>{p.submitted_at ? timeAgo(p.submitted_at, lang) : formatDateTime(p.booking?.start_at, lang)}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
                    <p className="num text-xl font-black tracking-tight text-brand-700">{formatEGP(p.amount, lang)}</p>
                    <Button
                      size="sm"
                      variant={p.status === 'under_review' ? 'success' : 'outline'}
                      icon={p.status === 'under_review' ? ShieldCheck : Eye}
                      onClick={() => setReviewId(p.id)}
                    >
                      {p.status === 'under_review' ? (ar ? 'فحص واعتماد' : 'Inspect') : ar ? 'عرض' : 'View'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} total={data.total} limit={LIMIT} onChange={setPage} />
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={tab === 'under_review' ? CheckCircle2 : Wallet}
            title={tab === 'under_review' ? (ar ? 'ممتاز! لا توجد إيصالات معلّقة' : 'All clear — nothing pending') : ar ? 'لا توجد نتائج' : 'No results'}
            description={tab === 'under_review' ? (ar ? 'تمت مراجعة جميع التحويلات.' : 'Every incoming transfer has been processed.') : undefined}
          />
        </Card>
      )}

      {reviewId && <PaymentReviewModal isOpen paymentId={reviewId} onClose={() => setReviewId(null)} />}
    </div>
  );
}
