import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import { fieldErrors } from '../lib/api';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { useLanguageStore } from '../store/languageStore';
import { AuthShell, safeRedirect } from '../components/layout/AuthShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { FullScreenLoader } from '../components/ui/Feedback';

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
  return s;
}

export function Register() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const { register, isAuthenticated, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const redirect = safeRedirect(params.get('redirect'), '/dashboard');
  const s = strength(form.password);

  if (isLoading) return <FullScreenLoader />;
  if (isAuthenticated) return <Navigate to={redirect} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError('');
    try {
      const res = await register({ ...form, phone: form.phone || undefined, locale: lang });
      toast.success(ar ? `أهلاً بك ${res.user.name.split(' ')[0]} 🎉` : `Welcome ${res.user.name.split(' ')[0]} 🎉`);
      navigate(redirect, { replace: true });
    } catch (err) {
      const f = fieldErrors(err);
      setErrors(f);
      if (!Object.keys(f).length) setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const labels = ar ? ['ضعيفة', 'مقبولة', 'جيدة', 'قوية'] : ['Weak', 'Fair', 'Good', 'Strong'];
  return (
    <AuthShell
      title={ar ? 'أنشئ حسابك' : 'Create your account'}
      subtitle={ar ? 'دقيقة واحدة وتبدأ الحجز.' : 'One minute and you are booking.'}
      footer={<>{ar ? 'لديك حساب؟' : 'Already registered?'} <Link to={`/login${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect'))}` : ''}`} className="font-bold text-brand-700 hover:underline">{ar ? 'سجّل الدخول' : 'Sign in'}</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input icon={UserRound} label={ar ? 'الاسم الكامل' : 'Full name'} required autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
        <Input icon={Mail} type="email" label={ar ? 'البريد الإلكتروني' : 'Email'} required autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        <Input icon={Phone} type="tel" label={ar ? 'رقم الهاتف (اختياري)' : 'Phone (optional)'} autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="01012345678" />
        <div>
          <Input icon={LockKeyhole} type="password" label={ar ? 'كلمة المرور' : 'Password'} required autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} helper={ar ? '8 أحرف على الأقل' : 'At least 8 characters'} />
          {form.password && (
            <div className="mt-2 flex items-center gap-3" aria-live="polite">
              <div className="flex flex-1 gap-1">{[1, 2, 3, 4].map((n) => <span key={n} className={cn('h-1.5 flex-1 rounded-full transition-colors', n <= s ? ['', 'bg-rose-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-600'][s] : 'bg-sand-200')} />)}</div>
              <span className="w-12 text-end text-[11px] font-bold text-stone-500">{labels[Math.max(0, s - 1)]}</span>
            </div>
          )}
        </div>
        {formError && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{formError}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!form.name || !form.email || form.password.length < 8}>{ar ? 'إنشاء الحساب' : 'Create account'}</Button>
        <p className="text-center text-[11px] text-stone-400">{ar ? 'بإنشاء حساب فإنك توافق على شروط الاستخدام وسياسة الخصوصية.' : 'By signing up you agree to our terms and privacy policy.'}</p>
      </form>
    </AuthShell>
  );
}
