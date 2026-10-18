import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Boxes, CalendarCheck, CreditCard, Compass, MapPin, Quote, Search, ShieldCheck, Sparkles, Star, Users, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { cn, getLocalized } from '../lib/utils';
import { useLanguageStore } from '../store/languageStore';
import { useLocations, useSpaceTypes } from '../lib/hooks';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { SpaceCard, SpaceCardSkeleton } from '../components/spaces/SpaceCard';
import { normalizeSpace } from '../lib/utils';

const SpaceVirtualTourModal = lazy(() => import('../components/spaces/SpaceVirtualTourModal').then((m) => ({ default: m.SpaceVirtualTourModal })));

const TYPE_IMAGES = {
  meeting_room: '/images/meeting-room.jpg',
  coworking_desk: '/images/coworking.jpg',
  private_office: '/images/private-office.jpg',
  conference_room: '/images/conference.jpg',
  training_room: '/images/training.jpg',
  event_space: '/images/event.jpg',
};

function SectionHead({ eyebrow, title, description, action }) {
  return (
    <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <span className="mb-2 inline-block text-xs font-bold uppercase tracking-widest text-accent-600">{eyebrow}</span>}
        <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h2>
        {description && <p className="mt-3 text-base leading-relaxed text-stone-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Home() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const navigate = useNavigate();
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [tourOpen, setTourOpen] = useState(false);

  const types = useSpaceTypes().data?.items || [];
  const locations = useLocations().data?.items || [];
  const spaces = useQuery({ queryKey: ['spaces', 'featured'], queryFn: () => api.get('/spaces', { limit: 6 }) });
  const reviews = useQuery({ queryKey: ['featured-reviews'], queryFn: () => api.get('/featured-reviews'), staleTime: 5 * 60_000 });

  const featured = spaces.data?.items || [];
  const totalSpaces = spaces.data?.total ?? 0;
  const tourSpace = featured[0] ? normalizeSpace(featured[0], lang) : null;

  const submit = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (type) p.set('type', type);
    if (location) p.set('location', location);
    navigate(`/spaces${p.toString() ? `?${p}` : ''}`);
  };

  const steps = [
    { icon: Search, title: ar ? 'اختر مساحتك' : 'Pick a space', text: ar ? 'تصفح القاعات والمكاتب وعاين المساحة بجولة ثلاثية الأبعاد.' : 'Browse rooms and offices, and preview them in 3D.' },
    { icon: CalendarCheck, title: ar ? 'حدد الموعد' : 'Choose a time', text: ar ? 'بالساعة أو اليوم، مع السعر النهائي لحظياً قبل أي التزام.' : 'By the hour or day, with the final price shown live.' },
    { icon: CreditCard, title: ar ? 'حوّل وارفع الإيصال' : 'Pay & upload', text: ar ? 'فودافون كاش أو إنستاباي، ثم ارفع صورة التحويل.' : 'Vodafone Cash or InstaPay, then upload your receipt.' },
    { icon: ShieldCheck, title: ar ? 'تأكيد خلال دقائق' : 'Get confirmed', text: ar ? 'فريقنا يراجع التحويل ويؤكد حجزك فوراً مع إشعار.' : 'Our team verifies and confirms right away.' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <Navbar />

      {/* Hero */}
      <section className="bg-mesh relative -mt-[72px] overflow-hidden pt-[72px]">
        <div className="bg-grid-subtle pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:pb-28">
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-1.5 text-xs font-bold text-brand-700 shadow-soft backdrop-blur">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span>
              {ar ? 'احجز وادفع محلياً — وتأكيد خلال دقائق' : 'Book & pay locally — confirmed in minutes'}
            </span>
            <h1 className="text-[2.6rem] font-black leading-[1.15] tracking-tight text-ink sm:text-6xl lg:text-[4rem]">
              {ar ? (<>مساحتك للعمل،<br /><span className="text-gradient-brand">بطريقتك أنت.</span></>) : (<>Your workspace,<br /><span className="text-gradient-brand">your way.</span></>)}
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-stone-600">
              {ar ? 'قاعات اجتماعات، مكاتب خاصة ومساحات عمل مشتركة في القاهرة والإسكندرية. عاين المساحة بجولة 3D ثم احجزها بالساعة أو اليوم.' : 'Meeting rooms, private offices and coworking in Cairo and Alexandria. Preview in 3D, then book by the hour or day.'}
            </p>

            <form onSubmit={submit} className="surface glass-panel grid gap-3 p-3 shadow-lift sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Select label={ar ? 'نوع المساحة' : 'Space type'} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">{ar ? 'كل الأنواع' : 'All types'}</option>
                {types.map((t) => <option key={t.key} value={t.key}>{getLocalized(t.name, lang)}</option>)}
              </Select>
              <Select label={ar ? 'الفرع' : 'Branch'} value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="">{ar ? 'كل الفروع' : 'All branches'}</option>
                {locations.map((l) => <option key={l.slug} value={l.slug}>{getLocalized(l.city, lang)}</option>)}
              </Select>
              <Button type="submit" size="lg" icon={Search} className="w-full sm:w-auto">{ar ? 'ابحث' : 'Search'}</Button>
            </form>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-1 text-sm">
              {[
                { v: totalSpaces || '—', l: ar ? 'مساحة جاهزة' : 'spaces' },
                { v: locations.length || '—', l: ar ? 'فروع' : 'branches' },
                { v: '3D', l: ar ? 'جولات تفاعلية' : 'tours' },
              ].map((s) => (
                <div key={s.l} className="flex items-baseline gap-2"><span className="num text-2xl font-black text-brand-700">{s.v}</span><span className="text-stone-500">{s.l}</span></div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-brand-200/50 via-transparent to-accent-200/50 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white shadow-glow">
              <img src="/images/hero.jpg" alt="" className="aspect-[4/5] w-full object-cover sm:aspect-[5/4] lg:aspect-[4/5]" fetchPriority="high" />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-transparent to-transparent" />
              <button
                onClick={() => tourSpace && setTourOpen(true)}
                disabled={!tourSpace}
                className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl bg-white/90 p-4 text-start shadow-lift backdrop-blur transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                <span className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-gradient text-white"><Compass className="size-5 animate-spin-slow" /></span>
                  <span><span className="block text-sm font-extrabold text-ink">{ar ? 'جولة افتراضية 3D' : '3D virtual tour'}</span><span className="block text-xs text-stone-500">{tourSpace?.name || (ar ? 'تجوّل داخل المساحة' : 'Walk through the space')}</span></span>
                </span>
                <Arrow className="size-5 text-brand-700" />
              </button>
            </div>
            <div className="animate-float absolute -top-4 end-4 hidden items-center gap-2 rounded-2xl border border-white bg-white/90 px-4 py-3 shadow-lift backdrop-blur sm:flex">
              <span className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Zap className="size-4" /></span>
              <span className="text-xs"><span className="block font-extrabold text-ink">{ar ? 'تأكيد سريع' : 'Fast confirmation'}</span><span className="text-stone-500">{ar ? 'خلال دقائق' : 'within minutes'}</span></span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow={ar ? 'الأنواع' : 'Browse by type'}
          title={ar ? 'لكل احتياج مساحة' : 'A space for every need'}
          description={ar ? 'من مكتب هادئ لشخص واحد إلى قاعة مؤتمرات تتسع لعشرات.' : 'From a quiet desk for one to a conference hall for dozens.'}
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-5">
          {types.map((t, i) => (
            <Link
              key={t.key}
              to={`/spaces?type=${t.key}`}
              style={{ '--i': i }}
              className={cn('stagger group relative isolate overflow-hidden rounded-3xl bg-brand-900 shadow-soft', i === 0 ? 'aspect-[4/3] md:row-span-2 md:aspect-auto' : 'aspect-[4/3]')}
            >
              <img src={TYPE_IMAGES[t.key] || '/images/hero.jpg'} alt="" loading="lazy" className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-950/85 via-brand-950/25 to-transparent" />
              <div className="flex h-full flex-col justify-end p-5 text-white">
                <h3 className="text-lg font-extrabold leading-tight sm:text-xl">{getLocalized(t.name, lang)}</h3>
                <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-brand-100"><span className="num">{t.space_count}</span> {ar ? 'مساحة' : 'spaces'}<Arrow className="ms-auto size-4 opacity-0 transition-all group-hover:opacity-100" /></p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="border-y border-sand-200 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow={ar ? 'مختارات' : 'Featured'}
            title={ar ? 'مساحات يفضّلها عملاؤنا' : 'Customer favourites'}
            action={<Link to="/spaces"><Button variant="outline" iconEnd={Arrow}>{ar ? 'عرض الكل' : 'View all'}</Button></Link>}
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.isLoading ? Array.from({ length: 3 }).map((_, i) => <SpaceCardSkeleton key={i} />) : featured.map((s, i) => <SpaceCard key={s.id} space={s} index={i} />)}
          </div>
        </div>
      </section>

      {/* 3D spotlight */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative isolate overflow-hidden rounded-[2.5rem] bg-brand-950 px-6 py-14 text-white sm:px-14 sm:py-16">
          <div className="absolute -end-20 -top-20 -z-10 size-96 rounded-full bg-brand-500/25 blur-3xl" />
          <div className="absolute -bottom-24 start-10 -z-10 size-96 rounded-full bg-accent-500/20 blur-3xl" />
          <div className="bg-grid-subtle absolute inset-0 -z-10 opacity-20 invert" />
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-accent-300"><Sparkles className="size-3.5" />{ar ? 'ميزة حصرية' : 'Exclusive'}</span>
              <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">{ar ? 'شاهد المساحة قبل أن تحجزها' : 'See it before you book it'}</h2>
              <p className="max-w-md leading-relaxed text-brand-100/80">{ar ? 'تجوّل داخل القاعة بالماوس أو الأسهم، بدّل بين إضاءة النهار والمساء، وتأكد أنها المناسبة لك تماماً.' : 'Walk through the room, switch day and evening light, and be sure it is the right fit.'}</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button variant="accent" size="lg" icon={Compass} onClick={() => tourSpace && setTourOpen(true)}>{ar ? 'ابدأ الجولة' : 'Start the tour'}</Button>
                <Link to="/spaces"><Button variant="darkOutline" size="lg">{ar ? 'تصفح المساحات' : 'Browse spaces'}</Button></Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['/images/meeting-room.jpg', '/images/conference.jpg', '/images/private-office.jpg', '/images/training.jpg'].map((src, i) => (
                <img key={src} src={src} alt="" loading="lazy" className={cn('aspect-[4/3] w-full rounded-2xl object-cover shadow-lift', i % 2 ? 'translate-y-4' : '')} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow={ar ? 'كيف يعمل' : 'How it works'} title={ar ? 'من الاختيار إلى التأكيد في 4 خطوات' : 'From pick to confirmed in 4 steps'} />
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={s.title} style={{ '--i': i }} className="surface stagger relative p-6">
                  <span className="num absolute end-5 top-4 text-5xl font-black text-sand-200">{i + 1}</span>
                  <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-brand-gradient text-white shadow-soft"><Icon className="size-5" /></span>
                  <h3 className="mb-1.5 text-base font-bold text-ink">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-stone-600">{s.text}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Locations */}
      {locations.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHead eyebrow={ar ? 'الفروع' : 'Branches'} title={ar ? 'قريبون منك' : 'Close to you'} action={<Link to="/locations"><Button variant="outline" iconEnd={Arrow}>{ar ? 'كل الفروع' : 'All branches'}</Button></Link>} />
          <div className="grid gap-5 md:grid-cols-3">
            {locations.map((l, i) => (
              <Link key={l.id} to={`/spaces?location=${l.slug}`} style={{ '--i': i }} className="surface surface-hover stagger group overflow-hidden">
                <div className="relative aspect-[16/10] overflow-hidden bg-sand-100">
                  <img src={l.images?.[0] || '/images/hero.jpg'} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <span className="num absolute start-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-brand-700 backdrop-blur">{l.space_count} {ar ? 'مساحات' : 'spaces'}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-ink">{getLocalized(l.name, lang)}</h3>
                  <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-stone-500"><MapPin className="mt-0.5 size-3.5 shrink-0" />{getLocalized(l.address, lang)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      {reviews.data?.items?.length > 0 && (
        <section className="border-t border-sand-200 bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHead eyebrow={ar ? 'آراء العملاء' : 'Testimonials'} title={ar ? 'ماذا يقول من جرّبوا ووركورا' : 'What customers say'} />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {reviews.data.items.slice(0, 3).map((r, i) => (
                <figure key={r.id} style={{ '--i': i }} className="surface stagger relative flex flex-col p-6">
                  <Quote className="absolute end-5 top-5 size-8 text-brand-100" />
                  <div className="mb-3 flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn('size-4', n <= r.rating ? 'fill-accent-400 text-accent-400' : 'text-sand-300')} />)}</div>
                  <blockquote className="flex-1 text-sm leading-relaxed text-stone-700">{r.comment}</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-sand-100 pt-4">
                    <span className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-sm font-bold text-white">{r.author?.name?.[0]}</span>
                    <span className="text-xs"><span className="block font-bold text-ink">{r.author?.name}</span><span className="text-stone-500">{r.author?.company || getLocalized(r.space?.name, lang)}</span></span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="bg-brand-gradient relative overflow-hidden rounded-[2.5rem] p-10 text-center text-white shadow-glow sm:p-16">
          <Boxes className="absolute -start-6 -top-6 size-40 text-white/5" />
          <Users className="absolute -bottom-8 -end-6 size-44 text-white/5" />
          <h2 className="relative text-3xl font-extrabold sm:text-4xl">{ar ? 'جاهز تبدأ؟' : 'Ready to get started?'}</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-brand-100">{ar ? 'أنشئ حسابك مجاناً واحجز أول مساحة لك اليوم.' : 'Create a free account and book your first space today.'}</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register"><Button variant="accent" size="lg">{ar ? 'أنشئ حساباً مجاناً' : 'Create free account'}</Button></Link>
            <Link to="/spaces"><Button variant="darkOutline" size="lg">{ar ? 'تصفح المساحات' : 'Browse spaces'}</Button></Link>
          </div>
        </div>
      </section>

      <Footer />
      {tourOpen && tourSpace && (
        <Suspense fallback={null}>
          <SpaceVirtualTourModal isOpen onClose={() => setTourOpen(false)} space={tourSpace} onBookNow={() => navigate(`/spaces/${tourSpace.slug}`)} />
        </Suspense>
      )}
    </div>
  );
}
