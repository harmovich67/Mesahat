import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, Mail, MapPin, Navigation, Phone } from 'lucide-react';
import { getLocalized, ltr } from '../lib/utils';
import { useLanguageStore } from '../store/languageStore';
import { useLocations } from '../lib/hooks';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { PageHero } from '../components/layout/PageHero';
import { Button } from '../components/ui/Button';
import { ErrorState, Skeleton } from '../components/ui/Feedback';

export function Locations() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const { data, isLoading, error, refetch } = useLocations();

  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <Navbar />
      <PageHero eyebrow={ar ? 'الفروع' : 'Branches'} title={ar ? 'فروعنا في قلب المدن' : 'Branches in the heart of the city'} description={ar ? 'مواقع مميزة في القاهرة والإسكندرية، قريبة من المواصلات والخدمات.' : 'Prime locations in Cairo and Alexandria, close to transport and services.'} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-14 sm:px-6 lg:px-8">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid gap-8 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-96" />)}</div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {data.items.map((l, i) => {
              const maps = l.latitude ? `https://www.google.com/maps?q=${l.latitude},${l.longitude}` : null;
              return (
                <article key={l.id} style={{ '--i': i }} className="surface stagger group overflow-hidden">
                  <div className="relative aspect-[16/8] overflow-hidden bg-sand-100">
                    <img src={l.images?.[0] || '/images/hero.jpg'} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                      <span className="num mb-2 inline-block rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold backdrop-blur">{l.space_count} {ar ? 'مساحات' : 'spaces'}</span>
                      <h2 className="text-2xl font-extrabold">{getLocalized(l.name, lang)}</h2>
                    </div>
                  </div>
                  <div className="space-y-4 p-6">
                    {l.description && <p className="leading-relaxed text-stone-600">{getLocalized(l.description, lang)}</p>}
                    <ul className="space-y-2.5 text-sm text-stone-700">
                      <li className="flex items-start gap-3"><MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" />{getLocalized(l.address, lang)}</li>
                      {l.working_hours?.opens && <li className="flex items-center gap-3"><Clock className="size-4 shrink-0 text-brand-600" /><span className="num" dir="ltr">{l.working_hours.opens} – {l.working_hours.closes}</span></li>}
                      {l.phone && <li className="flex items-center gap-3"><Phone className="size-4 shrink-0 text-brand-600" /><a href={`tel:${l.phone}`} {...ltr}>{l.phone}</a></li>}
                      {l.email && <li className="flex items-center gap-3"><Mail className="size-4 shrink-0 text-brand-600" /><a href={`mailto:${l.email}`} {...ltr}>{l.email}</a></li>}
                    </ul>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Link to={`/spaces?location=${l.slug}`}><Button iconEnd={Arrow}>{ar ? 'تصفح مساحات الفرع' : 'Browse spaces'}</Button></Link>
                      {maps && <a href={maps} target="_blank" rel="noreferrer"><Button variant="outline" icon={Navigation}>{ar ? 'الاتجاهات' : 'Directions'}</Button></a>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
