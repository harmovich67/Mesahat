import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useLanguageStore } from '../store/languageStore';
import { AuthShell, safeRedirect } from '../components/layout/AuthShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { FullScreenLoader } from '../components/ui/Feedback';

const DEMOS = [
  { icon: UserRound, label: { ar: 'عميل', en: 'Customer' }, email: 'omar@example.com', password: 'User@123456' },
  { icon: ShieldCheck, label: { ar: 'مدير', en: 'Admin' }, email: 'admin@workora.com', password: 'Admin@123456' },
];

export function Login() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const { login, isAuthenticated, isStaff, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const target = (staff) => safeRedirect(params.get('redirect'), staff ? '/admin' : '/dashboard');

  if (isLoading) return <FullScreenLoader />;
  if (isAuthenticated) return <Navigate to={target(isStaff)} replace />;

  const submit = async (creds = form) => {
    setBusy(true);
    setError('');
    try {
      const res = await login(creds);
      const staff = Boolean(res.user?.is_staff);
      toast.success(ar ? `أهلاً ${res.user.name.split(' ')[0]}` : `Welcome back, ${res.user.name.split(' ')[0]}`);
      navigate(target(staff), { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={ar ? 'مرحباً بعودتك' : 'Welcome back'}
      subtitle={ar ? 'سجّل الدخول لإدارة حجوزاتك.' : 'Sign in to manage your bookings.'}
      footer={<>{ar ? 'ليس لديك حساب؟' : 'New here?'} <Link to={`/register${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect'))}` : ''}`} className="font-bold text-brand-700 hover:underline">{ar ? 'أنشئ حساباً' : 'Create an account'}</Link></>}
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-5" noValidate>
        <Input icon={Mail} type="email" autoComplete="email" label={ar ? 'البريد الإلكتروني' : 'Email'} required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@company.com" />
        <div className="relative">
          <Input icon={LockKeyhole} type={show ? 'text' : 'password'} autoComplete="current-password" label={ar ? 'كلمة المرور' : 'Password'} required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <button type="button" onClick={() => setShow((v) => !v)} className="absolute end-3 top-[30px] rounded-md p-1.5 text-stone-400 hover:text-ink" aria-label={ar ? 'إظهار كلمة المرور' : 'Toggle password'}>{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
        </div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!form.email || !form.password}>{ar ? 'تسجيل الدخول' : 'Sign in'}</Button>
      </form>

      {import.meta.env.DEV && (
        <div className="mt-8 rounded-2xl border border-dashed border-sand-300 bg-sand-50 p-4">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-wider text-stone-400">{ar ? 'حسابات تجريبية (بيئة التطوير فقط)' : 'Demo accounts (dev only)'}</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMOS.map((d) => {
              const Icon = d.icon;
              return <Button key={d.email} variant="outline" size="sm" icon={Icon} disabled={busy} onClick={() => submit({ email: d.email, password: d.password })}>{d.label[lang]}</Button>;
            })}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
