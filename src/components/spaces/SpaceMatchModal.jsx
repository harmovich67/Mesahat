import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Briefcase, CalendarCheck, Mic2, PartyPopper, RotateCcw, Sparkles, UserRound, Users, UsersRound } from 'lucide-react';
import { api } from '../../lib/api';
import { cn, formatEGP, getLocalized, normalizeSpace } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/StatusBadge';

const PURPOSES = [
  { id: 'focus', icon: UserRound, ar: 'عمل وتركيز فردي', en: 'Focused solo work' },
  { id: 'meeting', icon: Briefcase, ar: 'اجتماع مع عملاء', en: 'Client meeting' },
  { id: 'team', icon: Users, ar: 'اجتماع فريق', en: 'Team session' },
  { id: 'interview', icon: CalendarCheck, ar: 'مقابلات توظيف', en: 'Interviews' },
  { id: 'workshop', icon: Mic2, ar: 'تدريب أو ورشة عمل', en: 'Training / workshop' },
  { id: 'event', icon: PartyPopper, ar: 'فعالية أو مؤتمر', en: 'Event / conference' },
];
const PEOPLE = [
  { id: '1-2', icon: UserRound, ar: '1 – 2 أفراد', en: '1 – 2 people' },
  { id: '3-6', icon: Users, ar: '3 – 6 أفراد', en: '3 – 6 people' },
  { id: '7-15', icon: UsersRound, ar: '7 – 15 فرداً', en: '7 – 15 people' },
  { id: '15+', icon: PartyPopper, ar: 'أكثر من 15', en: '15+ people' },
];
const HOURS = [1, 2, 3, 4, 6, 8];
const REASONS = {
  type: { ar: 'النوع مناسب لغرضك', en: 'Right type for your purpose' },
  capacity: { ar: 'السعة مثالية', en: 'Ideal capacity' },
  capacity_ok: { ar: 'السعة كافية', en: 'Enough capacity' },
  equipment: { ar: 'تجهيزات مناسبة', en: 'Suitable equipment' },
  focus: { ar: 'هدوء وتركيز', en: 'Quiet & focused' },
};

function Option({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('flex items-center gap-3 rounded-2xl border-2 p-4 text-start transition-all', active ? 'border-brand-600 bg-brand-50 shadow-soft' : 'border-sand-200 bg-white hover:border-brand-300')}
    >
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl transition-colors', active ? 'bg-brand-700 text-white' : 'bg-sand-100 text-stone-500')}><Icon className="size-5" /></span>
      <span className="text-sm font-bold text-ink">{label}</span>
    </button>
  );
}

export function SpaceMatchModal({ isOpen, onClose }) {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const Next = ar ? ArrowLeft : ArrowRight;
  const [step, setStep] = useState(1);
  const [purpose, setPurpose] = useState('meeting');
  const [people, setPeople] = useState('3-6');
  const [hours, setHours] = useState(2);
  const [location, setLocation] = useState('');

  const locations = useQuery({ queryKey: ['locations'], queryFn: () => api.get('/locations'), staleTime: 5 * 60_000, enabled: isOpen });
  const match = useMutation({ mutationFn: () => api.get('/spaces/match', { purpose, people, hours, location }) });

  const reset = () => { setStep(1); match.reset(); };
  const close = () => { onClose(); setTimeout(reset, 250); };
  const results = match.data?.items?.map((s) => ({ ...normalizeSpace(s, lang), match_score: s.match_score, match_reasons: s.match_reasons, estimated_total: s.estimated_total, best: s.best }));

  return (
    <Modal isOpen={isOpen} onClose={close} size="lg" title={ar ? 'مساعد اختيار المساحة' : 'Space matcher'} description={ar ? 'أجب عن 3 أسئلة سريعة ونرشّح لك الأنسب.' : 'Three quick questions and we will suggest the best fit.'}>
      {!results ? (
        <div className="space-y-6">
          <div className="flex items-center gap-1.5" aria-label={`${step}/3`}>
            {[1, 2, 3].map((s) => <span key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors', s <= step ? 'bg-brand-600' : 'bg-sand-200')} />)}
          </div>

          {step === 1 && (
            <div className="animate-fade-up space-y-3">
              <h4 className="text-base font-bold text-ink">{ar ? 'ما الغرض من الحجز؟' : 'What is it for?'}</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {PURPOSES.map((p) => <Option key={p.id} icon={p.icon} label={p[lang]} active={purpose === p.id} onClick={() => setPurpose(p.id)} />)}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="animate-fade-up space-y-3">
              <h4 className="text-base font-bold text-ink">{ar ? 'كم شخصاً سيحضر؟' : 'How many people?'}</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {PEOPLE.map((p) => <Option key={p.id} icon={p.icon} label={p[lang]} active={people === p.id} onClick={() => setPeople(p.id)} />)}
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="animate-fade-up space-y-5">
              <div>
                <h4 className="mb-3 text-base font-bold text-ink">{ar ? 'كم ساعة تقريباً؟' : 'For how long?'}</h4>
                <div className="flex flex-wrap gap-2">
                  {HOURS.map((h) => (
                    <button key={h} onClick={() => setHours(h)} className={cn('num rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all', hours === h ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-sand-200 hover:border-brand-300')}>
                      {h} {ar ? 'س' : 'h'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-3 text-base font-bold text-ink">{ar ? 'الفرع المفضّل' : 'Preferred branch'}</h4>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setLocation('')} className={cn('rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all', !location ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-sand-200 hover:border-brand-300')}>{ar ? 'أي فرع' : 'Any'}</button>
                  {locations.data?.items?.map((l) => (
                    <button key={l.id} onClick={() => setLocation(l.slug)} className={cn('rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all', location === l.slug ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-sand-200 hover:border-brand-300')}>
                      {getLocalized(l.city, lang)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-sand-100 pt-4">
            <Button variant="ghost" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>{ar ? 'السابق' : 'Back'}</Button>
            {step < 3 ? (
              <Button iconEnd={Next} onClick={() => setStep((s) => s + 1)}>{ar ? 'التالي' : 'Next'}</Button>
            ) : (
              <Button icon={Sparkles} variant="accent" loading={match.isPending} onClick={() => match.mutate()}>{ar ? 'رشّح لي' : 'Find my space'}</Button>
            )}
          </div>
          {match.isError && <p className="text-sm text-rose-600">{match.error.message}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {results.length ? (
            results.map((s) => (
              <Link key={s.id} to={`/spaces/${s.slug}`} onClick={close} className="surface surface-hover group flex gap-4 overflow-hidden p-3">
                <img src={s.image_url} alt="" className="size-28 shrink-0 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1 py-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {s.best && <Badge variant="accent">{ar ? 'الأنسب لك' : 'Best match'}</Badge>}
                    <span className="num text-xs font-bold text-emerald-700">{s.match_score}% {ar ? 'توافق' : 'match'}</span>
                  </div>
                  <h5 className="truncate font-bold text-ink">{s.name}</h5>
                  <p className="truncate text-xs text-stone-500">{s.location_name} · {s.capacity} {ar ? 'فرد' : 'ppl'}</p>
                  <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-stone-500">{s.match_reasons?.map((r) => <span key={r}>✓ {REASONS[r]?.[lang]}</span>)}</p>
                  {s.estimated_total != null && (
                    <p className="num mt-1.5 text-sm font-extrabold text-brand-700">
                      ≈ {formatEGP(s.estimated_total, lang)} <span className="text-[11px] font-medium text-stone-400">{ar ? `لـ ${hours} ساعات` : `for ${hours}h`}</span>
                    </p>
                  )}
                </div>
              </Link>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-stone-500">{ar ? 'لم نجد مساحة مطابقة. جرّب تغيير الإجابات.' : 'No close match. Try different answers.'}</p>
          )}
          <Button variant="outline" icon={RotateCcw} onClick={reset}>{ar ? 'ابدأ من جديد' : 'Start over'}</Button>
        </div>
      )}
    </Modal>
  );
}
