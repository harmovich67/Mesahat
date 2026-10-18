import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, CalendarClock, Landmark, Plus, Save, Settings, Smartphone, Store, Trash2, Wallet } from 'lucide-react';
import { api, fieldErrors } from '../../lib/api';
import { cn, ltr } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, PageHeader, Tabs, Toggle } from '../../components/ui/Dash';
import { ErrorState, Skeleton } from '../../components/ui/Feedback';
import { Input, Textarea } from '../../components/ui/Input';

function SaveBar({ dirty, loading, onSave, onReset }) {
  const ar = useLanguageStore((s) => s.lang) === 'ar';
  return (
    <div className={cn('sticky bottom-4 z-10 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-sand-200 bg-white/90 px-4 py-3 shadow-lift backdrop-blur transition-all', !dirty && 'translate-y-2 opacity-0 pointer-events-none')}>
      <span className="text-sm font-semibold text-stone-600">{ar ? 'لديك تعديلات غير محفوظة' : 'You have unsaved changes'}</span>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onReset}>{ar ? 'تراجع' : 'Discard'}</Button>
        <Button size="sm" icon={Save} loading={loading} onClick={onSave}>{ar ? 'حفظ التغييرات' : 'Save changes'}</Button>
      </div>
    </div>
  );
}

/** Edits one settings group, sends only that group to PATCH /admin/settings. */
function useGroup(group, settings) {
  const qc = useQueryClient();
  const ar = useLanguageStore((s) => s.lang) === 'ar';
  const [draft, setDraft] = useState(settings?.[group]);
  const [errors, setErrors] = useState({});
  useEffect(() => setDraft(settings?.[group]), [settings, group]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings?.[group]);
  const set = (path, value) =>
    setDraft((d) => {
      const next = structuredClone(d);
      const keys = path.split('.');
      let node = next;
      keys.slice(0, -1).forEach((k) => { node = node[k] ??= {}; });
      node[keys.at(-1)] = value;
      return next;
    });
  const save = useMutation({
    mutationFn: () => api.patch('/admin/settings', { [group]: draft }),
    onSuccess: (res) => {
      qc.setQueryData(['admin', 'settings'], res);
      qc.invalidateQueries({ queryKey: ['public-settings'] });
      toast.success(ar ? 'تم حفظ الإعدادات' : 'Settings saved');
      setErrors({});
    },
    onError: (e) => { setErrors(fieldErrors(e)); toast.error(e.message); },
  });
  return { draft, set, dirty, errors, save, reset: () => setDraft(settings?.[group]) };
}

function GeneralTab({ settings }) {
  const ar = useLanguageStore((s) => s.lang) === 'ar';
  const g = useGroup('general', settings);
  if (!g.draft) return null;
  const d = g.draft;
  return (
    <>
      <Card>
        <CardHeader title={ar ? 'هوية النشاط' : 'Business identity'} description={ar ? 'تظهر في الموقع والرسائل الإلكترونية.' : 'Shown on the site and in emails.'} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={ar ? 'اسم النشاط (عربي)' : 'Business name (Arabic)'} value={d.business_name?.ar || ''} onChange={(e) => g.set('business_name.ar', e.target.value)} />
          <Input label={ar ? 'اسم النشاط (إنجليزي)' : 'Business name (English)'} value={d.business_name?.en || ''} onChange={(e) => g.set('business_name.en', e.target.value)} />
          <Input label={ar ? 'الشعار النصي (عربي)' : 'Tagline (Arabic)'} value={d.tagline?.ar || ''} onChange={(e) => g.set('tagline.ar', e.target.value)} />
          <Input label={ar ? 'الشعار النصي (إنجليزي)' : 'Tagline (English)'} value={d.tagline?.en || ''} onChange={(e) => g.set('tagline.en', e.target.value)} />
          <Input type="email" label={ar ? 'البريد الإلكتروني' : 'Email'} value={d.email || ''} onChange={(e) => g.set('email', e.target.value)} />
          <Input type="tel" label={ar ? 'الهاتف' : 'Phone'} value={d.phone || ''} onChange={(e) => g.set('phone', e.target.value)} />
          <Input label={ar ? 'العنوان (عربي)' : 'Address (Arabic)'} value={d.address?.ar || ''} onChange={(e) => g.set('address.ar', e.target.value)} />
          <Input label={ar ? 'العنوان (إنجليزي)' : 'Address (English)'} value={d.address?.en || ''} onChange={(e) => g.set('address.en', e.target.value)} />
          <Input type="number" min="0" max="100" step="0.5" label={ar ? 'ضريبة القيمة المضافة %' : 'VAT %'} value={d.tax_rate ?? 0} onChange={(e) => g.set('tax_rate', Number(e.target.value))} helper={ar ? 'تُضاف على كل حجز جديد. 0 = بدون ضريبة.' : 'Added to every new booking. 0 = none.'} />
        </div>
      </Card>
      <SaveBar dirty={g.dirty} loading={g.save.isPending} onSave={() => g.save.mutate()} onReset={g.reset} />
    </>
  );
}

function BookingTab({ settings }) {
  const ar = useLanguageStore((s) => s.lang) === 'ar';
  const g = useGroup('booking', settings);
  if (!g.draft) return null;
  const d = g.draft;
  const num = (path) => (e) => g.set(path, Number(e.target.value));
  const tiers = d.cancellation?.tiers || [];
  const setTier = (i, p) => g.set('cancellation.tiers', tiers.map((t, idx) => (idx === i ? { ...t, ...p } : t)));
  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader title={ar ? 'قواعد الحجز' : 'Booking rules'} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input type="number" min="15" label={ar ? 'أقل مدة (دقيقة)' : 'Min duration (min)'} value={d.min_duration_minutes} onChange={num('min_duration_minutes')} />
            <Input type="number" min="30" label={ar ? 'أطول مدة (دقيقة)' : 'Max duration (min)'} value={d.max_duration_minutes} onChange={num('max_duration_minutes')} />
            <Input type="number" min="15" step="15" label={ar ? 'خطوة الفترات (دقيقة)' : 'Slot step (min)'} value={d.slot_step_minutes} onChange={num('slot_step_minutes')} />
            <Input type="number" min="1" label={ar ? 'ساعات نصف اليوم' : 'Half-day hours'} value={d.half_day_hours} onChange={num('half_day_hours')} />
            <Input type="number" min="1" label={ar ? 'أقصى حجز مسبق (يوم)' : 'Advance booking (days)'} value={d.advance_booking_days} onChange={num('advance_booking_days')} />
            <Input type="number" min="0" label={ar ? 'أقل مهلة قبل البدء (دقيقة)' : 'Min lead time (min)'} value={d.min_lead_minutes} onChange={num('min_lead_minutes')} />
            <Input type="number" min="5" label={ar ? 'مهلة إتمام الدفع (دقيقة)' : 'Payment hold (min)'} value={d.payment_hold_minutes} onChange={num('payment_hold_minutes')} helper={ar ? 'تُحجز المساحة للعميل خلالها.' : 'Slot is held for the customer.'} />
            <Input type="number" min="5" label={ar ? 'مهلة إعادة رفع الإيصال (دقيقة)' : 'Re-upload window (min)'} value={d.reupload_window_minutes} onChange={num('reupload_window_minutes')} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title={ar ? 'سياسة الإلغاء والاسترداد' : 'Cancellation & refund policy'}
            description={ar ? 'تُحسب نسبة الاسترداد حسب الوقت المتبقي قبل بدء الحجز.' : 'Refund % depends on how long before the start the customer cancels.'}
            action={
              <Button variant="outline" size="sm" icon={Plus} onClick={() => g.set('cancellation.tiers', [...tiers, { hours_before: 12, refund_percent: 25 }])}>
                {ar ? 'شريحة' : 'Tier'}
              </Button>
            }
          />
          <div className="space-y-2">
            {[...tiers].map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 rounded-xl bg-sand-50 p-3">
                <Input type="number" min="0" label={ar ? 'قبل البدء بـ (ساعة) أو أكثر' : 'At least (hours before)'} value={t.hours_before} onChange={(e) => setTier(i, { hours_before: Number(e.target.value) })} />
                <Input type="number" min="0" max="100" label={ar ? 'نسبة الاسترداد %' : 'Refund %'} value={t.refund_percent} onChange={(e) => setTier(i, { refund_percent: Number(e.target.value) })} />
                <Button variant="ghost" size="icon" aria-label="remove" disabled={tiers.length <= 1} className="mb-0.5 hover:text-rose-600" onClick={() => g.set('cancellation.tiers', tiers.filter((_, idx) => idx !== i))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input type="number" min="0" label={ar ? 'رسوم إلغاء ثابتة (ج.م)' : 'Fixed fee (EGP)'} value={d.cancellation?.fee_fixed ?? 0} onChange={num('cancellation.fee_fixed')} />
            <Input type="number" min="0" max="100" label={ar ? 'رسوم إلغاء نسبية %' : 'Percent fee %'} value={d.cancellation?.fee_percent ?? 0} onChange={num('cancellation.fee_percent')} />
          </div>
        </Card>
      </div>
      <SaveBar dirty={g.dirty} loading={g.save.isPending} onSave={() => g.save.mutate()} onReset={g.reset} />
    </>
  );
}

function PaymentTab({ settings }) {
  const ar = useLanguageStore((s) => s.lang) === 'ar';
  const qc = useQueryClient();
  const g = useGroup('payment', settings);
  const methods = useQuery({ queryKey: ['admin', 'payment-methods'], queryFn: () => api.get('/admin/payment-methods') });
  const [drafts, setDrafts] = useState({});
  const edit = (code, p) => setDrafts((d) => ({ ...d, [code]: { ...d[code], ...p } }));

  const saveMethod = useMutation({
    mutationFn: ({ code, body }) => api.put(`/admin/payment-methods/${code}`, body),
    onSuccess: (_, v) => {
      toast.success(ar ? 'تم حفظ وسيلة الدفع' : 'Payment method saved');
      setDrafts((d) => { const n = { ...d }; delete n[v.code]; return n; });
      qc.invalidateQueries({ queryKey: ['admin', 'payment-methods'] });
      qc.invalidateQueries({ queryKey: ['payment-methods'] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!g.draft) return null;
  const ICON = { vodafone_cash: Smartphone, instapay: Landmark };
  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-5 lg:grid-cols-2">
          {methods.isLoading ? (
            <><Skeleton className="h-72" /><Skeleton className="h-72" /></>
          ) : (
            methods.data?.items?.map((m) => {
              const v = { ...m, ...drafts[m.code] };
              const dirty = Boolean(drafts[m.code]);
              const Icon = ICON[m.code] || Wallet;
              return (
                <Card key={m.code}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span>
                      <div>
                        <h3 className="font-bold text-ink">{ar ? m.name?.ar : m.name?.en || m.name?.ar}</h3>
                        <p className="text-xs text-stone-500">{ar ? 'تظهر للعملاء عند الدفع' : 'Shown to customers at checkout'}</p>
                      </div>
                    </div>
                    <Toggle checked={v.active} onChange={(a) => edit(m.code, { active: a })} label="active" />
                  </div>
                  <div className="space-y-4">
                    <Input label={m.code === 'instapay' ? (ar ? 'عنوان إنستاباي (IPA)' : 'InstaPay address (IPA)') : ar ? 'رقم المحفظة' : 'Wallet number'} value={v.account_identifier || ''} onChange={(e) => edit(m.code, { account_identifier: e.target.value })} className="font-mono font-bold" />
                    <Input label={ar ? 'اسم صاحب الحساب' : 'Account holder'} value={v.account_name || ''} onChange={(e) => edit(m.code, { account_name: e.target.value })} />
                    <Textarea rows={3} label={ar ? 'تعليمات الدفع (عربي)' : 'Instructions (Arabic)'} value={v.instructions?.ar || ''} onChange={(e) => edit(m.code, { instructions: { ...v.instructions, ar: e.target.value } })} />
                    <Textarea rows={3} label={ar ? 'تعليمات الدفع (إنجليزي)' : 'Instructions (English)'} value={v.instructions?.en || ''} onChange={(e) => edit(m.code, { instructions: { ...v.instructions, en: e.target.value } })} />
                  </div>
                  {dirty && (
                    <div className="mt-4 flex justify-end gap-2 border-t border-sand-100 pt-4">
                      <Button variant="ghost" size="sm" onClick={() => setDrafts((d) => { const n = { ...d }; delete n[m.code]; return n; })}>{ar ? 'تراجع' : 'Discard'}</Button>
                      <Button size="sm" icon={Save} loading={saveMethod.isPending && saveMethod.variables?.code === m.code} onClick={() => saveMethod.mutate({ code: m.code, body: { account_identifier: v.account_identifier, account_name: v.account_name, instructions: v.instructions, active: v.active } })}>{ar ? 'حفظ' : 'Save'}</Button>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>

        <Card>
          <CardHeader title={ar ? 'قواعد الإيصالات' : 'Receipt rules'} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input type="number" min="1" max="20" label={ar ? 'أقصى حجم للإيصال (MB)' : 'Max receipt size (MB)'} value={g.draft.receipt_max_mb} onChange={(e) => g.set('receipt_max_mb', Number(e.target.value))} />
            <label className="flex items-center gap-3 pt-6">
              <Toggle checked={g.draft.receipt_required} onChange={(v) => g.set('receipt_required', v)} label="receipt required" />
              <span className="text-sm font-semibold text-ink">{ar ? 'الإيصال إلزامي' : 'Receipt is required'}</span>
            </label>
            <Textarea wrapperClassName="sm:col-span-2" rows={2} label={ar ? 'تعليمات عامة (عربي)' : 'General instructions (Arabic)'} value={g.draft.general_instructions?.ar || ''} onChange={(e) => g.set('general_instructions.ar', e.target.value)} />
            <Textarea wrapperClassName="sm:col-span-2" rows={2} label={ar ? 'تعليمات عامة (إنجليزي)' : 'General instructions (English)'} value={g.draft.general_instructions?.en || ''} onChange={(e) => g.set('general_instructions.en', e.target.value)} />
          </div>
        </Card>
      </div>
      <SaveBar dirty={g.dirty} loading={g.save.isPending} onSave={() => g.save.mutate()} onReset={g.reset} />
    </>
  );
}

function NotificationsTab({ settings }) {
  const ar = useLanguageStore((s) => s.lang) === 'ar';
  const g = useGroup('notifications', settings);
  if (!g.draft) return null;
  const d = g.draft;
  const rows = [
    { key: 'email_enabled', title: ar ? 'إرسال الرسائل الإلكترونية للعملاء' : 'Send customer emails', hint: ar ? 'تأكيد الحجز، رفض الدفع، التذكيرات…' : 'Confirmations, rejections, reminders…' },
    { key: 'notify_admin_on_proof', title: ar ? 'تنبيه الفريق عند رفع إيصال جديد' : 'Alert staff on new receipts', hint: ar ? 'إشعار داخلي لمن يملك صلاحية المراجعة.' : 'In-app alert for reviewers.' },
  ];
  return (
    <>
      <Card>
        <CardHeader title={ar ? 'الإشعارات' : 'Notifications'} />
        <div className="divide-y divide-sand-100">
          {rows.map((r) => (
            <label key={r.key} className="flex items-center justify-between gap-4 py-4">
              <span><span className="block text-sm font-bold text-ink">{r.title}</span><span className="text-xs text-stone-500">{r.hint}</span></span>
              <Toggle checked={d[r.key]} onChange={(v) => g.set(r.key, v)} label={r.title} />
            </label>
          ))}
        </div>
        <Input wrapperClassName="mt-4 max-w-xs" type="number" min="1" label={ar ? 'تذكير قبل الحجز بـ (ساعة)' : 'Reminder before booking (hours)'} value={d.reminder_hours_before} onChange={(e) => g.set('reminder_hours_before', Number(e.target.value))} />
      </Card>
      <SaveBar dirty={g.dirty} loading={g.save.isPending} onSave={() => g.save.mutate()} onReset={g.reset} />
    </>
  );
}

export function AdminSettings() {
  const ar = useLanguageStore((s) => s.lang) === 'ar';
  const can = useAuthStore((s) => s.can);
  const [tab, setTab] = useState('general');
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api.get('/admin/settings'), enabled: can('settings.manage') });
  const settings = data?.settings;

  return (
    <div className="space-y-6">
      <PageHeader icon={Settings} title={ar ? 'إعدادات المنصة' : 'Platform settings'} description={ar ? 'تُطبَّق التغييرات فوراً على الموقع وعملية الحجز.' : 'Changes apply immediately to the site and the booking flow.'} />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'general', label: <span className="inline-flex items-center gap-1.5"><Store className="size-3.5" />{ar ? 'عام' : 'General'}</span> },
          { value: 'booking', label: <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-3.5" />{ar ? 'الحجز والإلغاء' : 'Booking'}</span> },
          { value: 'payment', label: <span className="inline-flex items-center gap-1.5"><Wallet className="size-3.5" />{ar ? 'الدفع' : 'Payments'}</span> },
          { value: 'notifications', label: <span className="inline-flex items-center gap-1.5"><Bell className="size-3.5" />{ar ? 'الإشعارات' : 'Notifications'}</span> },
        ]}
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div key={tab} className="animate-fade-in">
          {tab === 'general' && <GeneralTab settings={settings} />}
          {tab === 'booking' && <BookingTab settings={settings} />}
          {tab === 'payment' && <PaymentTab settings={settings} />}
          {tab === 'notifications' && <NotificationsTab settings={settings} />}
        </div>
      )}
    </div>
  );
}
