import { useState } from 'react';
import { Check, Copy, Landmark, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import { cn, getLocalized, ltr } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';

const ICON = { vodafone_cash: Smartphone, instapay: Landmark };
const TONE = {
  vodafone_cash: { ring: 'border-red-400 bg-red-50/50', icon: 'bg-red-100 text-red-600' },
  instapay: { ring: 'border-violet-400 bg-violet-50/50', icon: 'bg-violet-100 text-violet-600' },
};

export function CopyField({ value, label }) {
  const lang = useLanguageStore((s) => s.lang);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-sand-200 bg-white px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-stone-500">{label}</p>
        <p {...ltr} className="truncate font-mono text-base font-extrabold tracking-wide text-ink">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors', copied ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-50 text-brand-700 hover:bg-brand-100')}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? (lang === 'ar' ? 'تم النسخ' : 'Copied') : lang === 'ar' ? 'نسخ' : 'Copy'}
      </button>
    </div>
  );
}

/** Methods come from GET /payment-methods, so account numbers always match what admins configured. */
export function PaymentMethodSelector({ methods = [], value, onChange }) {
  const lang = useLanguageStore((s) => s.lang);
  const ar = lang === 'ar';
  const selected = methods.find((m) => m.code === value);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink">
          <ShieldCheck className="size-4 text-brand-600" />
          {ar ? 'اختر وسيلة الدفع' : 'Choose a payment method'}
        </span>
        <span className="text-[11px] font-semibold text-accent-600">{ar ? 'إيصال التحويل مطلوب' : 'Receipt required'}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
        {methods.map((m) => {
          const Icon = ICON[m.code] || Wallet;
          const on = value === m.code;
          const tone = TONE[m.code] || { ring: 'border-brand-400 bg-brand-50/50', icon: 'bg-brand-100 text-brand-600' };
          return (
            <button
              key={m.code}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(m.code)}
              className={cn('flex items-center gap-3 rounded-2xl border-2 p-4 text-start transition-all', on ? `${tone.ring} shadow-soft` : 'border-sand-200 bg-white hover:border-sand-300')}
            >
              <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', tone.icon)}><Icon className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">{getLocalized(m.name, lang).replace(/\s*\(.*\)$/, '')}</span>
                <span className="block text-xs text-stone-500">{m.account_name}</span>
              </span>
              <span className={cn('grid size-5 place-items-center rounded-full border-2', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-sand-300')}>
                {on && <Check className="size-3" />}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="animate-fade-up space-y-3 rounded-2xl bg-sand-50 p-4">
          <CopyField value={selected.account_identifier} label={selected.code === 'instapay' ? (ar ? 'عنوان إنستاباي (IPA)' : 'InstaPay address') : ar ? 'رقم المحفظة' : 'Wallet number'} />
          <p className="text-sm leading-relaxed text-stone-600">{getLocalized(selected.instructions, lang)}</p>
        </div>
      )}
    </div>
  );
}
