import { Link } from 'react-router-dom';
import { Check, Globe } from 'lucide-react';
import { useLanguageStore } from '../../store/languageStore';
import { Brand } from './Navbar';

/** Split-screen frame shared by Login and Register. */
export function AuthShell({ title, subtitle, children, footer }) {
  const { lang, toggleLang } = useLanguageStore();
  const ar = lang === 'ar';
  const points = ar
    ? ['احجز بالساعة أو اليوم بأسعار واضحة', 'ادفع بفودافون كاش أو إنستاباي', 'تأكيد خلال دقائق بعد رفع الإيصال', 'جولة 3D قبل الحجز']
    : ['Book by the hour or day, clear prices', 'Pay with Vodafone Cash or InstaPay', 'Confirmed within minutes of your receipt', '3D tour before you book'];

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Brand />
          <button onClick={toggleLang} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-stone-600 hover:bg-sand-100"><Globe className="size-4" />{ar ? 'English' : 'العربية'}</button>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
          <p className="mb-8 mt-2 text-stone-600">{subtitle}</p>
          {children}
          {footer && <p className="mt-8 text-center text-sm text-stone-600">{footer}</p>}
        </div>
        <Link to="/" className="text-center text-xs font-semibold text-stone-400 hover:text-brand-700">{ar ? '← العودة للموقع' : '← Back to site'}</Link>
      </div>

      <div className="relative hidden overflow-hidden lg:block">
        <img src="/images/coworking.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950/90 via-brand-900/80 to-brand-700/70" />
        <div className="bg-grid-subtle absolute inset-0 opacity-20 invert" />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <h2 className="mb-6 max-w-md text-4xl font-black leading-tight">{ar ? 'مساحتك للعمل، بطريقتك.' : 'Your workspace, your way.'}</h2>
          <ul className="space-y-3.5">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-brand-50"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-500 text-white"><Check className="size-3.5" /></span>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Only allow same-site relative redirects. */
export const safeRedirect = (value, fallback) => (value && value.startsWith('/') && !value.startsWith('//') ? value : fallback);
