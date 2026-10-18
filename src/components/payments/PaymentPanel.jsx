import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Send, Timer } from 'lucide-react';
import { api, fieldErrors } from '../../lib/api';
import { formatEGP } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { ReceiptUploader } from './ReceiptUploader';

const pad = (n) => String(n).padStart(2, '0');
const nowLocalInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function HoldCountdown({ expiresAt, onExpire }) {
  const ar = useLanguageStore((s) => s.lang) === 'ar';
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt) - Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      const ms = Math.max(0, new Date(expiresAt) - Date.now());
      setLeft(ms);
      if (ms === 0) {
        clearInterval(id);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const urgent = left < 5 * 60000;
  return (
    <span className={`num inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${urgent ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
      <Timer className="size-3.5" />
      {pad(m)}:{pad(s)} {ar ? 'لإتمام الدفع' : 'left to pay'}
    </span>
  );
}

/**
 * The customer's three-step payment (choose method → upload receipt → submit transfer details).
 * Mirrors the server contract: POST /bookings/:id/payment, POST /payments/:id/receipt, POST /payments/:id/submit.
 */
export function PaymentPanel({ booking, onDone }) {
  const ar = useLanguageStore((s) => s.lang) === 'ar';
  const qc = useQueryClient();
  const payment = booking.payment;

  const methods = useQuery({ queryKey: ['payment-methods'], queryFn: () => api.get('/payment-methods'), staleTime: 5 * 60_000 });
  const settings = useQuery({ queryKey: ['public-settings'], queryFn: () => api.get('/settings/public'), staleTime: 5 * 60_000 });
  const list = methods.data?.items || [];

  const [method, setMethod] = useState(payment?.method || '');
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ sender_info: payment?.sender_info || '', transfer_reference: payment?.transfer_reference || '', transfer_time: nowLocalInput() });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!method && list.length) setMethod(payment?.method || list[0].code);
  }, [list, method, payment?.method]);

  const hasReceipt = payment?.has_receipt;
  const maxMb = settings.data?.settings?.payment?.receipt_max_mb || 8;
  const needsNew = payment?.needs_new_receipt || payment?.status === 'rejected';

  const submit = useMutation({
    mutationFn: async () => {
      await api.post(`/bookings/${booking.id}/payment`, { method });
      if (file) {
        const fd = new FormData();
        fd.append('receipt', file);
        await api.post(`/payments/${payment.id}/receipt`, fd);
      }
      return api.post(`/payments/${payment.id}/submit`, {
        transfer_time: new Date(form.transfer_time).toISOString(),
        sender_info: form.sender_info || undefined,
        transfer_reference: form.transfer_reference || undefined,
      });
    },
    onSuccess: () => {
      toast.success(ar ? 'تم إرسال بيانات الدفع — جارٍ المراجعة' : 'Payment submitted — under review');
      qc.invalidateQueries({ queryKey: ['booking', booking.id] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      onDone?.();
    },
    onError: (e) => {
      setErrors(fieldErrors(e));
      toast.error(e.message);
    },
  });

  const canSubmit = method && (file || hasReceipt) && form.transfer_time && form.sender_info.trim();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const hint = useMemo(() => (method === 'instapay' ? (ar ? 'اسم الحساب أو عنوان IPA المحوَّل منه' : 'Account name or IPA you sent from') : ar ? 'رقم الهاتف المحوَّل منه' : 'Phone number you sent from'), [method, ar]);

  return (
    <div className="space-y-6">
      {needsNew && payment?.rejection_reason && (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-bold">{ar ? 'مطلوب إيصال جديد' : 'A new receipt is needed'}</p>
            <p className="mt-0.5">{payment.rejection_reason}</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white">
        <p className="text-xs font-semibold text-brand-200">{ar ? 'المبلغ المطلوب تحويله' : 'Amount to transfer'}</p>
        <p className="num mt-1 text-3xl font-black tracking-tight">{formatEGP(booking.final_amount, ar ? 'ar' : 'en')}</p>
      </div>

      <section>
        <PaymentMethodSelector methods={list} value={method} onChange={setMethod} />
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-bold text-ink">{ar ? '٢) ارفع إيصال التحويل' : '2) Upload the transfer receipt'}</h4>
        {hasReceipt && !file && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            {ar ? 'لديك إيصال مرفوع بالفعل. يمكنك استبداله برفع إيصال جديد.' : 'A receipt is already uploaded. Upload another to replace it.'}
          </p>
        )}
        <ReceiptUploader file={file} onChange={setFile} maxMb={maxMb} />
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-bold text-ink">{ar ? '٣) بيانات التحويل' : '3) Transfer details'}</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input type="datetime-local" required max={nowLocalInput()} label={ar ? 'وقت التحويل' : 'Transfer time'} value={form.transfer_time} onChange={set('transfer_time')} error={errors.transfer_time} />
          <Input required label={ar ? 'المحوَّل منه' : 'Sent from'} value={form.sender_info} onChange={set('sender_info')} helper={hint} error={errors.sender_info} />
          <Input wrapperClassName="sm:col-span-2" label={ar ? 'رقم العملية / المرجع (اختياري)' : 'Transaction / reference # (optional)'} value={form.transfer_reference} onChange={set('transfer_reference')} />
        </div>
      </section>

      <Button size="lg" className="w-full" icon={Send} disabled={!canSubmit} loading={submit.isPending} onClick={() => submit.mutate()}>
        {ar ? 'إرسال للمراجعة' : 'Submit for review'}
      </Button>
      <p className="text-center text-xs text-stone-500">
        {ar ? 'سيراجع فريقنا التحويل ويؤكد الحجز عادةً خلال دقائق.' : 'Our team usually verifies and confirms within minutes.'}
      </p>
    </div>
  );
}
