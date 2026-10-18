import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building, KeyRound, Mail, Phone, Save, User } from 'lucide-react';
import { api, fieldErrors } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import { Button } from '../../components/ui/Button';
import { Avatar, Card, CardHeader, PageHeader } from '../../components/ui/Dash';
import { Input } from '../../components/ui/Input';

export function Profile() {
  const { user, updateUser } = useAuthStore();
  const { lang, setLang } = useLanguageStore();
  const ar = lang === 'ar';
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', company: user?.company || '' });
  const [errors, setErrors] = useState({});
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});

  const save = useMutation({
    mutationFn: () => api.patch('/auth/me', { name: form.name, phone: form.phone, company: form.company, locale: lang }),
    onSuccess: (res) => { updateUser(res.user); setErrors({}); toast.success(ar ? 'تم حفظ بياناتك' : 'Profile saved'); },
    onError: (e) => { setErrors(fieldErrors(e)); toast.error(e.message); },
  });
  const changePw = useMutation({
    mutationFn: () => api.post('/auth/change-password', { current_password: pw.current_password, new_password: pw.new_password }),
    onSuccess: () => { setPw({ current_password: '', new_password: '', confirm: '' }); setPwErrors({}); toast.success(ar ? 'تم تغيير كلمة المرور' : 'Password changed'); },
    onError: (e) => { setPwErrors(fieldErrors(e)); toast.error(e.message); },
  });

  const mismatch = pw.confirm && pw.new_password !== pw.confirm;
  const dirty = form.name !== (user?.name || '') || form.phone !== (user?.phone || '') || form.company !== (user?.company || '');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <PageHeader title={ar ? 'ملفي الشخصي' : 'My profile'} description={ar ? 'حدّث بياناتك وأمان حسابك.' : 'Keep your details and account security up to date.'} />

      <Card>
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={user?.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-ink">{user?.name}</p>
            <p className="truncate text-sm text-stone-500" dir="ltr">{user?.email}</p>
          </div>
        </div>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Input icon={User} label={ar ? 'الاسم الكامل' : 'Full name'} required value={form.name} onChange={set('name')} error={errors.name} />
          <Input icon={Mail} type="email" label={ar ? 'البريد الإلكتروني' : 'Email'} value={user?.email || ''} disabled helper={ar ? 'لا يمكن تغيير البريد من هنا.' : 'Email cannot be changed here.'} />
          <Input icon={Phone} type="tel" label={ar ? 'رقم الهاتف' : 'Phone'} value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="01012345678" />
          <Input icon={Building} label={ar ? 'الشركة' : 'Company'} value={form.company} onChange={set('company')} error={errors.company} />
          <div className="flex items-center justify-between gap-3 sm:col-span-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-stone-500">{ar ? 'لغة الواجهة:' : 'Language:'}</span>
              {['ar', 'en'].map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${lang === l ? 'bg-brand-700 text-white' : 'bg-sand-100 text-stone-600 hover:bg-sand-200'}`}>
                  {l === 'ar' ? 'العربية' : 'English'}
                </button>
              ))}
            </div>
            <Button type="submit" icon={Save} loading={save.isPending} disabled={!dirty}>{ar ? 'حفظ' : 'Save'}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={ar ? 'تغيير كلمة المرور' : 'Change password'} description={ar ? '8 أحرف على الأقل.' : 'At least 8 characters.'} />
        <form className="grid gap-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); if (!mismatch) changePw.mutate(); }}>
          <Input icon={KeyRound} type="password" autoComplete="current-password" label={ar ? 'كلمة المرور الحالية' : 'Current password'} required value={pw.current_password} onChange={(e) => setPw((p) => ({ ...p, current_password: e.target.value }))} error={pwErrors.current_password} />
          <Input icon={KeyRound} type="password" autoComplete="new-password" minLength={8} label={ar ? 'الجديدة' : 'New password'} required value={pw.new_password} onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))} error={pwErrors.new_password} />
          <Input icon={KeyRound} type="password" autoComplete="new-password" label={ar ? 'تأكيد الجديدة' : 'Confirm'} required value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} error={mismatch ? (ar ? 'غير متطابقة' : 'Does not match') : undefined} />
          <div className="sm:col-span-3"><Button type="submit" variant="outline" loading={changePw.isPending} disabled={!pw.current_password || pw.new_password.length < 8 || mismatch}>{ar ? 'تحديث كلمة المرور' : 'Update password'}</Button></div>
        </form>
      </Card>
    </div>
  );
}
