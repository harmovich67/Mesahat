import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Clock, Mail, MapPin, Phone, Send } from 'lucide-react';
import { api, fieldErrors } from '../lib/api';
import { getLocalized, ltr } from '../lib/utils';
import { useLanguageStore } from '../store/languageStore';
import { useAuthStore } from '../store/authStore';
import { usePublicSettings } from '../lib/hooks';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { PageHero } from '../components/layout/PageHero';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';

export function Contact() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const user = useAuthStore((s) => s.user);
  const general = usePublicSettings().data?.settings?.general;
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', message: '' });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const send = useMutation({
    mutationFn: () => api.post('/contact', { ...form, phone: form.phone || undefined }),
    onSuccess: () => setSent(true),
    onError: (e) => setErrors({ ...fieldErrors(e), _: e.message }),
  });

  const info = [
    general?.address && { icon: MapPin, label: ar ? 'العنوان' : 'Address', value: getLocalized(general.address, lang) },
    general?.phone && { icon: Phone, label: ar ? 'الهاتف' : 'Phone', value: general.phone, href: `tel:${general.phone}`, ltr: true },
    general?.email && { icon: Mail, label: ar ? 'البريد' : 'Email', value: general.email, href: `mailto:${general.email}`, ltr: true },
    { icon: Clock, label: ar ? 'ساعات الدعم' : 'Support hours', value: ar ? 'يومياً 9 ص – 9 م' : 'Daily 9am – 9pm' },
  ].filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <Navbar />
      <PageHero eyebrow={ar ? 'تواصل' : 'Contact'} title={ar ? 'يسعدنا سماعك' : 'We would love to hear from you'} description={ar ? 'سؤال عن مساحة، حجز جماعي، أو شراكة؟ اكتب لنا وسنرد خلال يوم عمل.' : 'A question, a group booking or a partnership? Write to us — we reply within a business day.'} />
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:px-8">
        <div className="space-y-4">
          {info.map((i) => {
            const Icon = i.icon;
            const Tag = i.href ? 'a' : 'div';
            return (
              <Tag key={i.label} href={i.href} className="surface surface-hover flex items-center gap-4 p-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white shadow-soft"><Icon className="size-5" /></span>
                <span className="min-w-0"><span className="block text-xs font-semibold text-stone-500">{i.label}</span><span className="block font-bold text-ink" {...(i.ltr ? ltr : {})}>{i.value}</span></span>
              </Tag>
            );
          })}
        </div>

        <div className="surface p-6 sm:p-8">
          {sent ? (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center">
              <span className="grid size-16 place-items-center rounded-3xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-8" /></span>
              <h2 className="text-xl font-extrabold text-ink">{ar ? 'وصلتنا رسالتك' : 'Message received'}</h2>
              <p className="max-w-sm text-stone-600">{ar ? 'شكراً لتواصلك. سنرد على بريدك قريباً.' : 'Thanks for reaching out. We will reply to your email soon.'}</p>
              <Button variant="outline" onClick={() => { setSent(false); setForm((f) => ({ ...f, message: '' })); }}>{ar ? 'إرسال رسالة أخرى' : 'Send another'}</Button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setErrors({}); send.mutate(); }} className="space-y-4" noValidate>
              <h2 className="text-xl font-extrabold text-ink">{ar ? 'أرسل لنا رسالة' : 'Send us a message'}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={ar ? 'الاسم' : 'Name'} required value={form.name} onChange={set('name')} error={errors.name} />
                <Input type="email" label={ar ? 'البريد الإلكتروني' : 'Email'} required value={form.email} onChange={set('email')} error={errors.email} />
              </div>
              <Input type="tel" label={ar ? 'الهاتف (اختياري)' : 'Phone (optional)'} value={form.phone} onChange={set('phone')} error={errors.phone} />
              <Textarea rows={6} label={ar ? 'رسالتك' : 'Message'} required value={form.message} onChange={set('message')} error={errors.message} helper={`${form.message.length}/2000`} maxLength={2000} />
              {errors._ && !errors.name && !errors.email && !errors.message && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errors._}</p>}
              <Button type="submit" size="lg" icon={Send} loading={send.isPending} disabled={!form.name || !form.email || form.message.trim().length < 10}>{ar ? 'إرسال' : 'Send message'}</Button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
