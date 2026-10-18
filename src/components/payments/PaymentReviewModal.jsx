import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, FileText, RefreshCw, Undo2, XCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { ErrorState, Skeleton } from '../ui/Feedback';
import { InfoRow } from '../ui/Dash';
import { StatusBadge } from '../ui/StatusBadge';
import { ReceiptViewer } from './ReceiptViewer';
import { BookingTimeline } from '../bookings/BookingTimeline';
import { api } from '../../lib/api';
import { formatDateTime, formatEGP, formatRange, getLocalized, ltr, methodLabel } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { useAuthStore } from '../../store/authStore';

/**
 * Staff review of one payment: receipt preview, transfer details and the four decisions the API supports
 * (approve · reject · request a new receipt · mark refunded).
 */
export function PaymentReviewModal({ isOpen, onClose, paymentId, onUpdated }) {
  const { lang } = useLanguageStore();
  const can = useAuthStore((s) => s.can);
  const qc = useQueryClient();
  const [mode, setMode] = useState(null); // 'reject' | 'reupload'
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'payment', paymentId],
    queryFn: () => api.get(`/admin/payments/${paymentId}`),
    enabled: Boolean(isOpen && paymentId),
  });

  const payment = data?.payment;
  const booking = data?.booking;
  const ar = lang === 'ar';

  const done = (message) => {
    toast.success(message);
    qc.invalidateQueries({ queryKey: ['admin'] });
    onUpdated?.();
    close();
  };
  const close = () => {
    setMode(null);
    setReason('');
    setNote('');
    onClose?.();
  };
  const onError = (e) => toast.error(e.message);

  const approve = useMutation({
    mutationFn: () => api.post(`/admin/payments/${paymentId}/approve`, { note: note || undefined }),
    onSuccess: () => done(ar ? 'تم اعتماد الدفع وتأكيد الحجز' : 'Payment approved — booking confirmed'),
    onError,
  });
  const reject = useMutation({
    mutationFn: () => api.post(`/admin/payments/${paymentId}/reject`, { reason }),
    onSuccess: () => done(ar ? 'تم رفض الدفع وتحرير المساحة' : 'Payment rejected'),
    onError,
  });
  const reupload = useMutation({
    mutationFn: () => api.post(`/admin/payments/${paymentId}/request-new-receipt`, { reason }),
    onSuccess: () => done(ar ? 'تم إرسال طلب إيصال جديد للعميل' : 'New receipt requested'),
    onError,
  });
  const refund = useMutation({
    mutationFn: () => api.post(`/admin/payments/${paymentId}/refund`),
    onSuccess: () => done(ar ? 'تم تسجيل الاسترداد' : 'Refund recorded'),
    onError,
  });

  const busy = approve.isPending || reject.isPending || reupload.isPending || refund.isPending;
  const underReview = payment?.status === 'under_review';
  const canReview = can('payments.review');
  const canRefund = can('payments.refund');
  const reasonValid = reason.trim().length >= 3;

  const footer = payment && (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {mode ? (
        <>
          <Button variant="ghost" onClick={() => setMode(null)} disabled={busy}>
            {ar ? 'تراجع' : 'Back'}
          </Button>
          {mode === 'reject' ? (
            <Button variant="danger" icon={XCircle} loading={reject.isPending} disabled={!reasonValid} onClick={() => reject.mutate()}>
              {ar ? 'تأكيد الرفض النهائي' : 'Confirm rejection'}
            </Button>
          ) : (
            <Button variant="accent" icon={RefreshCw} loading={reupload.isPending} disabled={!reasonValid} onClick={() => reupload.mutate()}>
              {ar ? 'إرسال طلب إيصال جديد' : 'Send request'}
            </Button>
          )}
        </>
      ) : underReview && canReview ? (
        <>
          <div className="flex gap-2">
            <Button variant="dangerOutline" size="sm" icon={XCircle} onClick={() => setMode('reject')}>
              {ar ? 'رفض' : 'Reject'}
            </Button>
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => setMode('reupload')}>
              {ar ? 'طلب إيصال جديد' : 'Request new receipt'}
            </Button>
          </div>
          <Button variant="success" icon={CheckCircle} loading={approve.isPending} onClick={() => approve.mutate()}>
            {ar ? 'اعتماد الدفع وتأكيد الحجز' : 'Approve & confirm'}
          </Button>
        </>
      ) : payment.status === 'refund_pending' && canRefund ? (
        <>
          <span className="text-sm text-stone-500">
            {ar ? 'المبلغ المستحق للاسترداد:' : 'Refund due:'} <b className="num text-ink">{formatEGP(payment.refund_amount, lang)}</b>
          </span>
          <Button variant="primary" icon={Undo2} loading={refund.isPending} onClick={() => refund.mutate()}>
            {ar ? 'تأكيد تحويل الاسترداد' : 'Mark as refunded'}
          </Button>
        </>
      ) : (
        <Button variant="ghost" onClick={close} className="ms-auto">
          {ar ? 'إغلاق' : 'Close'}
        </Button>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="xl"
      title={booking ? `${ar ? 'مراجعة الدفع' : 'Payment review'} · ${booking.booking_number}` : ar ? 'مراجعة الدفع' : 'Payment review'}
      description={booking ? getLocalized(booking.space?.name, lang) : undefined}
      footer={footer}
    >
      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : payment ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          {/* Receipt */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-sand-200 bg-sand-50">
              <div className="flex items-center justify-between border-b border-sand-200 bg-white px-4 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink">
                  <FileText className="size-4 text-brand-600" />
                  {ar ? 'إيصال التحويل' : 'Transfer receipt'}
                </span>
                {payment.receipt && <span className="num text-[11px] text-stone-400">{(payment.receipt.file_size / 1024).toFixed(0)} KB</span>}
              </div>
              <div className="p-3">
                {payment.has_receipt ? (
                  <ReceiptViewer paymentId={payment.id} version={payment.receipt?.id} admin />
                ) : (
                  <p className="py-16 text-center text-sm text-stone-400">{ar ? 'لا يوجد إيصال حالي' : 'No current receipt'}</p>
                )}
              </div>
            </div>

            {mode && (
              <div className="animate-fade-up rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <h5 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <AlertTriangle className="size-4 text-amber-600" />
                  {mode === 'reject'
                    ? ar ? 'رفض نهائي — سيتم رفض الحجز وتحرير المساحة' : 'Final rejection — the slot will be released'
                    : ar ? 'سيحتفظ النظام بالمساحة مؤقتاً حتى يرفع العميل إيصالاً جديداً' : 'The slot stays held while the customer re-uploads'}
                </h5>
                <Textarea
                  autoFocus
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={mode === 'reject' ? (ar ? 'سبب الرفض (يظهر للعميل)…' : 'Reason (shown to customer)…') : ar ? 'ما الذي يجب تصحيحه؟ (يظهر للعميل)…' : 'What should be fixed? (shown to customer)…'}
                />
              </div>
            )}
            {!mode && underReview && canReview && (
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? 'ملاحظة داخلية عند الاعتماد (اختياري)…' : 'Internal note on approval (optional)…'} />
            )}
          </div>

          {/* Details */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-sand-200 bg-gradient-to-br from-brand-50 to-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-500">{ar ? 'المبلغ المحوّل' : 'Amount'}</span>
                <StatusBadge type="payment" status={payment.status} />
              </div>
              <p className="num mt-1 text-3xl font-black tracking-tight text-brand-700">{formatEGP(payment.amount, lang)}</p>
              <div className="mt-3 divide-y divide-sand-100 border-t border-sand-100">
                <InfoRow label={ar ? 'الوسيلة' : 'Method'}>{methodLabel(payment.method, lang)}</InfoRow>
                <InfoRow label={ar ? 'بيانات المحوِّل' : 'Sender'}><span {...ltr}>{payment.sender_info || '—'}</span></InfoRow>
                <InfoRow label={ar ? 'رقم المرجع' : 'Reference'}><span {...ltr} className="font-mono">{payment.transfer_reference || '—'}</span></InfoRow>
                <InfoRow label={ar ? 'وقت التحويل' : 'Transfer time'}>{formatDateTime(payment.transfer_time, lang) || '—'}</InfoRow>
                <InfoRow label={ar ? 'تاريخ الإرسال' : 'Submitted'}>{formatDateTime(payment.submitted_at, lang) || '—'}</InfoRow>
                {payment.reviewer_name && <InfoRow label={ar ? 'راجعه' : 'Reviewed by'}>{payment.reviewer_name}</InfoRow>}
              </div>
              {payment.rejection_reason && (
                <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  <b>{ar ? 'سبب الرفض: ' : 'Rejection reason: '}</b>
                  {payment.rejection_reason}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-sand-200 p-4">
              <h4 className="mb-1 text-sm font-bold text-ink">{ar ? 'الحجز' : 'Booking'}</h4>
              <div className="divide-y divide-sand-100">
                <InfoRow label={ar ? 'العميل' : 'Customer'}>{booking.customer?.name}</InfoRow>
                <InfoRow label={ar ? 'الهاتف' : 'Phone'}><span {...ltr}>{booking.customer?.phone || '—'}</span></InfoRow>
                <InfoRow label={ar ? 'الموعد' : 'When'}>{formatRange(booking.start_at, booking.end_at, lang)}</InfoRow>
                <InfoRow label={ar ? 'الفرع' : 'Branch'}>{getLocalized(booking.location?.name, lang)}</InfoRow>
                <InfoRow label={ar ? 'عدد الحضور' : 'Guests'}>{booking.guest_count}</InfoRow>
                {booking.coupon_code && <InfoRow label={ar ? 'الكوبون' : 'Coupon'}>{booking.coupon_code} (−{formatEGP(booking.discount_amount, lang)})</InfoRow>}
                <InfoRow label={ar ? 'حالة الحجز' : 'Status'}><StatusBadge status={booking.status} /></InfoRow>
              </div>
            </div>

            {booking.events?.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-bold text-ink">{ar ? 'سجل الحجز' : 'History'}</h4>
                <BookingTimeline events={booking.events} showActor />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
