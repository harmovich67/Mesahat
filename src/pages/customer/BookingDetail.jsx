import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Hourglass, MapPin, Navigation, Phone, Star, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { cn, formatDuration, formatEGP, formatRange, getLocalized, ltr, methodLabel, unitLabel } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Input';
import { Card, CardHeader, ConfirmDialog, InfoRow } from '../../components/ui/Dash';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BookingTimeline } from '../../components/bookings/BookingTimeline';
import { HoldCountdown, PaymentPanel } from '../../components/payments/PaymentPanel';
import { ReceiptViewer } from '../../components/payments/ReceiptViewer';

function ReviewForm({ booking, onDone }) {
  const ar = useLanguageStore((s) => s.lang) === 'ar';
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const submit = useMutation({
    mutationFn: () => api.post('/reviews', { booking_id: booking.id, rating, comment: comment || undefined }),
    onSuccess: () => { toast.success(ar ? 'شكراً! سيظهر تقييمك بعد المراجعة.' : 'Thanks! Your review will appear after moderation.'); onDone(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader title={ar ? 'كيف كانت تجربتك؟' : 'How was your experience?'} description={ar ? 'رأيك يساعد الآخرين على الاختيار.' : 'Your feedback helps others choose.'} />
      <div className="mb-4 flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} className="p-0.5 transition-transform hover:scale-125">
            <Star className={cn('size-8 transition-colors', (hover || rating) >= n ? 'fill-accent-400 text-accent-400' : 'text-sand-300')} />
          </button>
        ))}
      </div>
      <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={ar ? 'شاركنا تفاصيل تجربتك (اختياري)…' : 'Tell us more (optional)…'} />
      <Button className="mt-4" loading={submit.isPending} onClick={() => submit.mutate()}>{ar ? 'إرسال التقييم' : 'Submit review'}</Button>
    </Card>
  );
}

export function BookingDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const qc = useQueryClient();
  const Back = ar ? ChevronRight : ChevronLeft;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get(`/bookings/${id}`),
    refetchInterval: (q) => (['payment_under_review', 'pending_payment'].includes(q.state.data?.booking?.status) ? 20_000 : false),
  });
  const b = data?.booking;
  const quote = data?.cancellation;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['booking', id] });
    qc.invalidateQueries({ queryKey: ['bookings'] });
  };

  const cancel = useMutation({
    mutationFn: () => api.post(`/bookings/${id}/cancel`, { reason: reason || undefined }),
    onSuccess: () => { toast.success(ar ? 'تم إلغاء الحجز' : 'Booking cancelled'); setCancelOpen(false); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-80" /></div>;
  }
  if (error) {
    return error.status === 404 ? (
      <Card><EmptyState icon={CalendarClock} title={ar ? 'الحجز غير موجود' : 'Booking not found'} action={<Link to="/dashboard/bookings"><Button>{ar ? 'حجوزاتي' : 'My bookings'}</Button></Link>} /></Card>
    ) : (
      <ErrorState error={error} onRetry={refetch} />
    );
  }

  const pay = b.payment;
  const showReview = b.status === 'completed' && !b.review;
  const maps = b.location?.latitude ? `https://www.google.com/maps?q=${b.location.latitude},${b.location.longitude}` : null;

  return (
    <div className="space-y-6">
      <Link to="/dashboard/bookings" className="inline-flex items-center gap-1 text-sm font-semibold text-stone-500 hover:text-brand-700"><Back className="size-4" />{ar ? 'كل الحجوزات' : 'All bookings'}</Link>

      {/* Hero */}
      <div className="surface overflow-hidden">
        <div className="grid gap-0 sm:grid-cols-[260px_1fr]">
          <div className="relative aspect-[16/9] bg-sand-100 sm:aspect-auto">
            <img src={b.space?.cover || '/images/hero.jpg'} alt="" className="absolute inset-0 size-full object-cover" />
          </div>
          <div className="space-y-3 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={b.status} />
              <span className="num font-mono text-xs font-bold text-stone-400">{b.booking_number}</span>
              {b.status === 'pending_payment' && b.hold_expires_at && <HoldCountdown expiresAt={b.hold_expires_at} onExpire={refresh} />}
            </div>
            <Link to={`/spaces/${b.space?.slug}`} className="block text-xl font-extrabold tracking-tight text-ink hover:text-brand-700">{getLocalized(b.space?.name, lang)}</Link>
            <div className="grid gap-2 text-sm text-stone-600 sm:grid-cols-2">
              <p className="flex items-center gap-2"><CalendarClock className="size-4 shrink-0 text-brand-600" /><span className="num">{formatRange(b.start_at, b.end_at, lang)}</span></p>
              <p className="flex items-center gap-2"><Users className="size-4 shrink-0 text-brand-600" />{b.guest_count} {ar ? 'أفراد' : 'guests'} · {formatDuration(b.duration_minutes, lang)}</p>
              <p className="flex items-center gap-2 sm:col-span-2"><MapPin className="size-4 shrink-0 text-brand-600" />{getLocalized(b.location?.name, lang)} — {getLocalized(b.location?.address, lang)}</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {maps && <a href={maps} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" icon={Navigation}>{ar ? 'الاتجاهات' : 'Directions'}</Button></a>}
              {b.location?.phone && <a href={`tel:${b.location.phone}`}><Button variant="outline" size="sm" icon={Phone}><span {...ltr}>{b.location.phone}</span></Button></a>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {b.status === 'pending_payment' && (
            <Card>
              <CardHeader title={ar ? 'أكمل الدفع لتأكيد حجزك' : 'Complete payment to confirm'} description={ar ? 'المساحة محجوزة لك مؤقتاً — ادفع وارفع الإيصال قبل انتهاء المهلة.' : 'The slot is held for you — pay and upload your receipt before the hold ends.'} />
              <PaymentPanel booking={b} onDone={refresh} />
            </Card>
          )}

          {b.status === 'payment_under_review' && (
            <div className="flex gap-4 rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-100 text-blue-700"><Hourglass className="size-6 animate-pulse" /></span>
              <div>
                <h3 className="font-bold text-blue-900">{ar ? 'جارٍ مراجعة دفعتك' : 'Your payment is being reviewed'}</h3>
                <p className="mt-1 text-sm leading-relaxed text-blue-800/80">{ar ? 'استلمنا إيصال التحويل. سنؤكد حجزك ونرسل لك إشعاراً فور الانتهاء — عادةً خلال دقائق. يمكنك ترك هذه الصفحة.' : 'We received your receipt. We will confirm your booking and notify you shortly — usually within minutes.'}</p>
              </div>
            </div>
          )}

          {['confirmed', 'active'].includes(b.status) && (
            <div className="flex gap-4 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-6" /></span>
              <div>
                <h3 className="font-bold text-emerald-900">{b.status === 'active' ? (ar ? 'حجزك جارٍ الآن' : 'Your booking is in progress') : ar ? 'حجزك مؤكد 🎉' : 'You are all set 🎉'}</h3>
                <p className="mt-1 text-sm text-emerald-800/80">{ar ? 'اذكر رقم الحجز عند الوصول للاستقبال.' : 'Mention your booking number at reception.'} <b className="num font-mono">{b.booking_number}</b></p>
              </div>
            </div>
          )}

          {['rejected', 'cancelled', 'expired'].includes(b.status) && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-6 text-sm text-rose-900">
              <h3 className="mb-1 font-bold">{{ rejected: ar ? 'تم رفض الدفع' : 'Payment rejected', cancelled: ar ? 'تم إلغاء الحجز' : 'Booking cancelled', expired: ar ? 'انتهت مهلة الحجز' : 'Hold expired' }[b.status]}</h3>
              {(pay?.rejection_reason || b.cancel_reason) && <p>{pay?.rejection_reason || b.cancel_reason}</p>}
              {b.refund_amount > 0 && <p className="mt-1 font-semibold">{ar ? 'المبلغ المسترد:' : 'Refund:'} {formatEGP(b.refund_amount, lang)} {pay?.status === 'refunded' ? (ar ? '— تم التحويل' : '— sent') : ar ? '— قيد المعالجة' : '— processing'}</p>}
              <Link to={`/spaces/${b.space?.slug}`} className="mt-3 inline-block"><Button size="sm" variant="outline">{ar ? 'احجز مرة أخرى' : 'Book again'}</Button></Link>
            </div>
          )}

          {showReview && <ReviewForm booking={b} onDone={refresh} />}
          {b.review && (
            <Card className="flex items-center gap-3">
              <span className="flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn('size-5', n <= b.review.rating ? 'fill-accent-400 text-accent-400' : 'text-sand-300')} />)}</span>
              <span className="text-sm text-stone-600">{ar ? 'شكراً على تقييمك' : 'Thanks for your review'}{b.review.status === 'pending' && (ar ? ' — قيد المراجعة' : ' — pending moderation')}</span>
            </Card>
          )}

          <Card>
            <CardHeader title={ar ? 'سجل الحجز' : 'Timeline'} />
            <BookingTimeline events={b.events} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={ar ? 'ملخص الدفع' : 'Payment summary'} />
            <div className="divide-y divide-sand-100">
              <InfoRow label={ar ? 'الأساسي' : 'Base'}>{formatEGP(b.base_amount, lang)}</InfoRow>
              {b.addons?.map((a) => <InfoRow key={a.id} label={`${getLocalized(a.name, lang)} × ${a.quantity}`}>{formatEGP(a.total, lang)}</InfoRow>)}
              {b.discount_amount > 0 && <InfoRow label={`${ar ? 'خصم' : 'Discount'} ${b.coupon_code || ''}`}><span className="text-emerald-700">−{formatEGP(b.discount_amount, lang)}</span></InfoRow>}
              {b.tax_amount > 0 && <InfoRow label={ar ? 'الضريبة' : 'Tax'}>{formatEGP(b.tax_amount, lang)}</InfoRow>}
              <InfoRow label={<b className="text-ink">{ar ? 'الإجمالي' : 'Total'}</b>}><b className="num text-lg text-brand-700">{formatEGP(b.final_amount, lang)}</b></InfoRow>
              <InfoRow label={ar ? 'نوع الحجز' : 'Booking type'}>{unitLabel(b.unit, lang)}</InfoRow>
              {pay?.method && <InfoRow label={ar ? 'وسيلة الدفع' : 'Method'}>{methodLabel(pay.method, lang)}</InfoRow>}
              {pay && <InfoRow label={ar ? 'حالة الدفع' : 'Payment'}><StatusBadge type="payment" status={pay.status} /></InfoRow>}
            </div>
          </Card>

          {pay?.has_receipt && b.status !== 'pending_payment' && (
            <Card>
              <CardHeader title={ar ? 'إيصال التحويل' : 'Transfer receipt'} />
              <ReceiptViewer paymentId={pay.id} version={pay.receipt?.id} />
            </Card>
          )}

          {quote?.allowed && (
            <Card className="space-y-3">
              <h3 className="text-sm font-bold text-ink">{ar ? 'تحتاج للإلغاء؟' : 'Need to cancel?'}</h3>
              <p className="text-xs leading-relaxed text-stone-500">
                {quote.paid_amount > 0
                  ? (ar ? `إذا ألغيت الآن سيُسترد ${formatEGP(quote.refund_amount, lang)} (${quote.refund_percent}%) وفق سياسة الإلغاء.` : `Cancelling now refunds ${formatEGP(quote.refund_amount, lang)} (${quote.refund_percent}%) under the policy.`)
                  : ar ? 'يمكنك الإلغاء مجاناً قبل اعتماد الدفع.' : 'You can cancel for free before payment is approved.'}
              </p>
              <Button variant="dangerOutline" size="sm" icon={Ban} onClick={() => setCancelOpen(true)}>{ar ? 'إلغاء الحجز' : 'Cancel booking'}</Button>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog isOpen={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={() => cancel.mutate()} loading={cancel.isPending} danger title={ar ? 'تأكيد إلغاء الحجز' : 'Cancel this booking?'} confirmLabel={ar ? 'نعم، ألغِ' : 'Yes, cancel'} cancelLabel={ar ? 'تراجع' : 'Keep it'}>
        <div className="space-y-3">
          <p className="text-sm text-stone-600">{quote?.paid_amount > 0 ? (ar ? `سيتم استرداد ${formatEGP(quote.refund_amount, lang)} بعد المراجعة.` : `${formatEGP(quote.refund_amount, lang)} will be refunded after review.`) : ar ? 'سيتم تحرير المساحة فوراً.' : 'The slot will be released immediately.'}</p>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={ar ? 'سبب الإلغاء (اختياري)…' : 'Reason (optional)…'} />
        </div>
      </ConfirmDialog>
    </div>
  );
}
