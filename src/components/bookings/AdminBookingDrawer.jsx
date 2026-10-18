import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, CalendarClock, Mail, MapPin, Phone, ShieldCheck, Ticket, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDuration, formatEGP, formatRange, getLocalized, ltr, methodLabel, unitLabel } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { useAuthStore } from '../../store/authStore';
import { Drawer } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { ErrorState, Skeleton } from '../ui/Feedback';
import { Avatar, ConfirmDialog, InfoRow } from '../ui/Dash';
import { StatusBadge } from '../ui/StatusBadge';
import { BookingTimeline } from './BookingTimeline';
import { PaymentReviewModal } from '../payments/PaymentReviewModal';

export function AdminBookingDrawer({ bookingId, onClose }) {
  const { lang } = useLanguageStore();
  const can = useAuthStore((s) => s.can);
  const qc = useQueryClient();
  const ar = lang === 'ar';
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reviewId, setReviewId] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'booking', bookingId],
    queryFn: () => api.get(`/admin/bookings/${bookingId}`),
    enabled: Boolean(bookingId),
  });
  const b = data?.booking;
  const quote = data?.cancellation;

  const cancel = useMutation({
    mutationFn: () => api.post(`/admin/bookings/${bookingId}/cancel`, { reason: reason || undefined }),
    onSuccess: () => {
      toast.success(ar ? 'تم إلغاء الحجز' : 'Booking cancelled');
      setCancelOpen(false);
      setReason('');
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <Drawer
        isOpen={Boolean(bookingId)}
        onClose={onClose}
        title={b ? `${ar ? 'حجز' : 'Booking'} ${b.booking_number}` : ar ? 'تفاصيل الحجز' : 'Booking details'}
        description={b ? getLocalized(b.space?.name, lang) : undefined}
        footer={
          b && can('bookings.cancel') && quote?.allowed ? (
            <div className="flex justify-end">
              <Button variant="dangerOutline" size="sm" icon={Ban} onClick={() => setCancelOpen(true)}>
                {ar ? 'إلغاء الحجز' : 'Cancel booking'}
              </Button>
            </div>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : b ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <StatusBadge status={b.status} />
              <span className="num text-2xl font-black tracking-tight text-brand-700">{formatEGP(b.final_amount, lang)}</span>
            </div>

            <section className="rounded-2xl border border-sand-200 p-4">
              <div className="flex items-center gap-3">
                <Avatar name={b.customer?.name} />
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{b.customer?.name}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-stone-500">
                    {b.customer?.phone && <span {...ltr} className="inline-flex items-center gap-1"><Phone className="size-3" />{b.customer.phone}</span>}
                    {b.customer?.email && <span {...ltr} className="inline-flex items-center gap-1"><Mail className="size-3" />{b.customer.email}</span>}
                  </div>
                </div>
              </div>
            </section>

            <section className="divide-y divide-sand-100 rounded-2xl border border-sand-200 px-4 py-1">
              <InfoRow label={<span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" />{ar ? 'الموعد' : 'When'}</span>}>{formatRange(b.start_at, b.end_at, lang)}</InfoRow>
              <InfoRow label={ar ? 'المدة' : 'Duration'}>{formatDuration(b.duration_minutes, lang)} · {unitLabel(b.unit, lang)}</InfoRow>
              <InfoRow label={<span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{ar ? 'الفرع' : 'Branch'}</span>}>{getLocalized(b.location?.name, lang)}</InfoRow>
              <InfoRow label={<span className="inline-flex items-center gap-1.5"><Users className="size-4" />{ar ? 'الحضور' : 'Guests'}</span>}>{b.guest_count} / {b.space?.capacity}</InfoRow>
              {b.coupon_code && <InfoRow label={<span className="inline-flex items-center gap-1.5"><Ticket className="size-4" />{ar ? 'الكوبون' : 'Coupon'}</span>}>{b.coupon_code}</InfoRow>}
              {b.notes && <InfoRow label={ar ? 'ملاحظات' : 'Notes'}>{b.notes}</InfoRow>}
              <InfoRow label={ar ? 'المصدر' : 'Source'}>{b.source === 'admin' ? (ar ? 'إدخال يدوي' : 'Manual') : ar ? 'الموقع' : 'Online'}</InfoRow>
            </section>

            <section className="rounded-2xl border border-sand-200 p-4">
              <h4 className="mb-1 text-sm font-bold text-ink">{ar ? 'تفاصيل السعر' : 'Pricing'}</h4>
              <div className="divide-y divide-sand-100 text-sm">
                <InfoRow label={ar ? 'الأساسي' : 'Base'}>{formatEGP(b.base_amount, lang)}</InfoRow>
                {b.addons?.map((a) => (
                  <InfoRow key={a.id} label={`${getLocalized(a.name, lang)} × ${a.quantity}`}>{formatEGP(a.total, lang)}</InfoRow>
                ))}
                {b.discount_amount > 0 && <InfoRow label={ar ? 'الخصم' : 'Discount'}><span className="text-emerald-700">−{formatEGP(b.discount_amount, lang)}</span></InfoRow>}
                {b.tax_amount > 0 && <InfoRow label={ar ? 'الضريبة' : 'Tax'}>{formatEGP(b.tax_amount, lang)}</InfoRow>}
                <InfoRow label={<b className="text-ink">{ar ? 'الإجمالي' : 'Total'}</b>}><b className="num text-brand-700">{formatEGP(b.final_amount, lang)}</b></InfoRow>
              </div>
            </section>

            {b.payment && (
              <section className="rounded-2xl border border-sand-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-ink">{ar ? 'الدفع' : 'Payment'}</h4>
                  <StatusBadge type="payment" status={b.payment.status} />
                </div>
                <div className="divide-y divide-sand-100">
                  <InfoRow label={ar ? 'الوسيلة' : 'Method'}>{methodLabel(b.payment.method, lang)}</InfoRow>
                  {b.payment.sender_info && <InfoRow label={ar ? 'المحوِّل' : 'Sender'}><span {...ltr}>{b.payment.sender_info}</span></InfoRow>}
                  {b.payment.refund_amount > 0 && <InfoRow label={ar ? 'المسترد' : 'Refund'}>{formatEGP(b.payment.refund_amount, lang)}</InfoRow>}
                </div>
                {b.payment.has_receipt && can('payments.view') && (
                  <Button className="mt-3 w-full" variant="outline" size="sm" icon={ShieldCheck} onClick={() => setReviewId(b.payment.id)}>
                    {b.payment.status === 'under_review' ? (ar ? 'فحص الإيصال واعتماده' : 'Inspect receipt') : ar ? 'عرض الإيصال' : 'View receipt'}
                  </Button>
                )}
              </section>
            )}

            {b.cancel_reason && (
              <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <b>{ar ? 'سبب الإلغاء: ' : 'Cancel reason: '}</b>{b.cancel_reason}
              </p>
            )}

            <section>
              <h4 className="mb-3 text-sm font-bold text-ink">{ar ? 'سجل الحجز' : 'Timeline'}</h4>
              <BookingTimeline events={b.events} showActor />
            </section>
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => cancel.mutate()}
        loading={cancel.isPending}
        danger
        title={ar ? 'إلغاء الحجز' : 'Cancel booking'}
        confirmLabel={ar ? 'نعم، ألغِ الحجز' : 'Yes, cancel'}
      >
        <div className="space-y-4">
          {quote?.paid_amount > 0 ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {ar
                ? `الحجز مدفوع (${formatEGP(quote.paid_amount, lang)}). وفق سياسة الإلغاء سيُسجَّل استرداد ${formatEGP(quote.refund_amount, lang)} (${quote.refund_percent}%).`
                : `This booking is paid (${formatEGP(quote.paid_amount, lang)}). Under the policy a refund of ${formatEGP(quote.refund_amount, lang)} (${quote.refund_percent}%) will be queued.`}
            </p>
          ) : (
            <p className="text-sm text-stone-600">{ar ? 'سيتم تحرير المساحة فوراً.' : 'The slot will be released immediately.'}</p>
          )}
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={ar ? 'سبب الإلغاء (اختياري)…' : 'Reason (optional)…'} />
        </div>
      </ConfirmDialog>

      {reviewId && <PaymentReviewModal isOpen paymentId={reviewId} onClose={() => setReviewId(null)} onUpdated={refetch} />}
    </>
  );
}
