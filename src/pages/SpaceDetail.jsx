import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Armchair, Car, CheckCircle2, ChevronLeft, ChevronRight, Clock, Coffee, Compass, Edit3, Expand, Heart, Layers, MapPin, Maximize2, Printer, Share2, ShieldCheck,
  Star, Tv, Users, Video, Wifi, Wind,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { WEEKDAYS, cn, formatDate, getLocalized, normalizeSpace } from '../lib/utils';
import { useLanguageStore } from '../store/languageStore';
import { useFavorites } from '../lib/hooks';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { BookingWidget } from '../components/bookings/BookingWidget';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Dash';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';

const SpaceVirtualTourModal = lazy(() => import('../components/spaces/SpaceVirtualTourModal').then((m) => ({ default: m.SpaceVirtualTourModal })));
const ICONS = { Wifi, Tv, Edit3, Coffee, Wind, Video, Armchair, ShieldCheck, Car, Printer };

function Gallery({ images, name, onTour, ar }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const list = images.length ? images : [{ url: '/images/hero.jpg' }];
  const go = (d) => setI((v) => (v + d + list.length) % list.length);
  return (
    <div className="space-y-3">
      <div className="group relative aspect-[16/10] overflow-hidden rounded-3xl bg-sand-100 shadow-lift">
        <img key={list[i].url} src={list[i].url} alt={name} className="size-full animate-fade-in object-cover" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        {list.length > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="prev" className="absolute start-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 opacity-0 shadow transition-opacity group-hover:opacity-100"><ChevronLeft className="size-5 rtl:rotate-180" /></button>
            <button onClick={() => go(1)} aria-label="next" className="absolute end-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 opacity-0 shadow transition-opacity group-hover:opacity-100"><ChevronRight className="size-5 rtl:rotate-180" /></button>
          </>
        )}
        <div className="absolute bottom-4 start-4 flex gap-2">
          <Button size="sm" variant="accent" icon={Compass} onClick={onTour}>{ar ? 'جولة 3D' : '3D tour'}</Button>
          <Button size="sm" variant="secondary" className="bg-white/90 backdrop-blur" icon={Maximize2} onClick={() => setZoom(true)}>{ar ? 'تكبير' : 'Zoom'}</Button>
        </div>
        <span className="num absolute bottom-4 end-4 rounded-full bg-black/50 px-3 py-1 text-xs font-bold text-white backdrop-blur">{i + 1} / {list.length}</span>
      </div>
      {list.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {list.map((img, idx) => (
            <button key={img.url + idx} onClick={() => setI(idx)} aria-label={`${idx + 1}`} className={cn('relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-2xl border-2 transition-all', idx === i ? 'border-brand-600 shadow-soft' : 'border-transparent opacity-70 hover:opacity-100')}>
              <img src={img.url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {zoom && (
        <div className="fixed inset-0 z-50 grid animate-fade-in place-items-center bg-black/90 p-4" onClick={() => setZoom(false)} role="dialog" aria-modal="true">
          <img src={list[i].url} alt={name} className="max-h-full max-w-full rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
}

export function SpaceDetail() {
  const { slug } = useParams();
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const fav = useFavorites();
  const [tour, setTour] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['space', slug], queryFn: () => api.get(`/spaces/${slug}`) });
  const space = useMemo(() => (data?.item ? normalizeSpace(data.item, lang) : null), [data, lang]);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: space.name, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success(ar ? 'تم نسخ الرابط' : 'Link copied');
      }
    } catch { /* cancelled */ }
  };

  const shell = (children) => (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <Navbar />
      {children}
      <Footer />
    </div>
  );

  if (isLoading) {
    return shell(
      <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-6">
        <Skeleton className="aspect-[16/7] w-full rounded-3xl" />
        <div className="grid gap-8 lg:grid-cols-3"><Skeleton className="h-96 lg:col-span-2" /><Skeleton className="h-96" /></div>
      </div>,
    );
  }
  if (error || !space) {
    return shell(
      <div className="flex flex-1 items-center justify-center p-8">
        {error?.status === 404 ? (
          <EmptyState icon={Layers} title={ar ? 'المساحة غير موجودة' : 'Space not found'} description={ar ? 'ربما تم إيقافها أو تغيّر رابطها.' : 'It may have been removed or renamed.'} action={<Link to="/spaces"><Button>{ar ? 'تصفح المساحات' : 'Browse spaces'}</Button></Link>} />
        ) : (
          <ErrorState error={error} onRetry={refetch} />
        )}
      </div>,
    );
  }

  const isFav = fav.has(space.id);
  const dist = data.rating_distribution || {};
  const totalRatings = Object.values(dist).reduce((n, v) => n + v, 0);
  const rules = (space.rules || []).map((r) => getLocalized(r, lang)).filter(Boolean);
  const days = WEEKDAYS[lang];
  const mapsUrl = space.location?.latitude ? `https://www.google.com/maps?q=${space.location.latitude},${space.location.longitude}` : null;
  const facts = [
    { icon: Users, label: ar ? 'السعة' : 'Capacity', value: `${space.capacity} ${ar ? 'فرد' : 'ppl'}` },
    space.area_sqm && { icon: Expand, label: ar ? 'المساحة' : 'Area', value: `${space.area_sqm} m²` },
    space.floor && { icon: Layers, label: ar ? 'الطابق' : 'Floor', value: space.floor },
    { icon: Clock, label: ar ? 'أقل حجز' : 'Min. booking', value: ar ? 'ساعة' : '1 hour' },
  ].filter(Boolean);

  return shell(
    <>
      <div className="border-b border-sand-200 bg-white/70 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-xs text-stone-500 sm:px-6 lg:px-8" aria-label="breadcrumb">
          <Link to="/" className="hover:text-ink">{ar ? 'الرئيسية' : 'Home'}</Link>
          <ChevronRight className="size-3.5 rtl:rotate-180" />
          <Link to="/spaces" className="hover:text-ink">{ar ? 'المساحات' : 'Spaces'}</Link>
          <ChevronRight className="size-3.5 rtl:rotate-180" />
          <span className="truncate font-semibold text-ink">{space.name}</span>
        </nav>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{space.type_name}</span>
              {space.featured && <span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-bold text-accent-700">{ar ? 'مميّزة' : 'Featured'}</span>}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{space.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600">
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-brand-600" />{space.location_name}</span>
              {space.rating_count > 0 && <span className="num inline-flex items-center gap-1.5 font-bold text-ink"><Star className="size-4 fill-accent-400 text-accent-400" />{Number(space.rating_avg).toFixed(1)} <span className="font-medium text-stone-500">({space.rating_count})</span></span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" icon={Share2} onClick={share}>{ar ? 'مشاركة' : 'Share'}</Button>
            <Button variant="outline" icon={Heart} onClick={() => fav.toggle(space.id)} className={cn(isFav && 'border-rose-200 text-rose-600 [&_svg]:fill-rose-500')}>{ar ? 'حفظ' : 'Save'}</Button>
          </div>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_420px]">
          <div className="min-w-0 space-y-8">
            <Gallery images={space.images || []} name={space.name} onTour={() => setTour(true)} ar={ar} />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {facts.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.label} className="surface flex items-center gap-3 p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span>
                    <span className="min-w-0"><span className="block text-[11px] font-semibold text-stone-500">{f.label}</span><span className="num block truncate text-sm font-extrabold text-ink">{f.value}</span></span>
                  </div>
                );
              })}
            </div>

            {space.description && (
              <Card>
                <CardHeader title={ar ? 'عن المساحة' : 'About this space'} />
                <p className="whitespace-pre-line leading-relaxed text-stone-700">{space.description}</p>
              </Card>
            )}

            {space.amenities?.length > 0 && (
              <Card>
                <CardHeader title={ar ? 'المرافق والتجهيزات' : 'Amenities'} />
                <ul className="grid gap-3 sm:grid-cols-2">
                  {space.amenities.map((a) => {
                    const Icon = ICONS[a.icon] || CheckCircle2;
                    return (
                      <li key={a.id} className="flex items-center gap-3 rounded-xl bg-sand-50 px-4 py-3 text-sm font-semibold text-ink">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-brand-600 shadow-soft"><Icon className="size-4" /></span>
                        {getLocalized(a.name, lang)}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {space.hours?.length > 0 && (
                <Card>
                  <CardHeader title={ar ? 'ساعات العمل' : 'Opening hours'} />
                  <ul className="space-y-1.5 text-sm">
                    {[6, 0, 1, 2, 3, 4, 5].map((wd) => {
                      const h = space.hours.find((x) => x.weekday === wd);
                      return (
                        <li key={wd} className="flex items-center justify-between rounded-lg px-3 py-1.5 even:bg-sand-50">
                          <span className="font-semibold text-ink">{days[wd]}</span>
                          <span className="num text-stone-600" dir="ltr">{!h || h.is_closed ? (ar ? 'مغلق' : 'Closed') : `${h.opens} – ${h.closes}`}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
              {rules.length > 0 && (
                <Card>
                  <CardHeader title={ar ? 'قواعد المساحة' : 'House rules'} />
                  <ul className="space-y-3 text-sm text-stone-700">
                    {rules.map((r) => <li key={r} className="flex gap-2.5"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-500" />{r}</li>)}
                  </ul>
                </Card>
              )}
            </div>

            <Card>
              <CardHeader title={ar ? 'الموقع' : 'Location'} />
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-ink">{space.location_name}</p>
                  <p className="mt-1 text-sm text-stone-600">{space.address_text}</p>
                </div>
                {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer"><Button variant="outline" icon={MapPin}>{ar ? 'افتح الخريطة' : 'Open in Maps'}</Button></a>}
              </div>
            </Card>

            <Card>
              <CardHeader title={ar ? 'التقييمات' : 'Reviews'} description={totalRatings ? undefined : ar ? 'لا توجد تقييمات بعد' : 'No reviews yet'} />
              {totalRatings > 0 && (
                <div className="mb-6 grid items-center gap-6 sm:grid-cols-[160px_1fr]">
                  <div className="text-center">
                    <p className="num text-5xl font-black text-ink">{Number(space.rating_avg).toFixed(1)}</p>
                    <div className="mt-1 flex justify-center gap-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn('size-4', n <= Math.round(space.rating_avg) ? 'fill-accent-400 text-accent-400' : 'text-sand-300')} />)}</div>
                    <p className="num mt-1 text-xs text-stone-500">{totalRatings} {ar ? 'تقييم' : 'reviews'}</p>
                  </div>
                  <ul className="space-y-1.5">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <li key={n} className="flex items-center gap-3 text-xs">
                        <span className="num w-3 font-bold text-stone-600">{n}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand-100"><span className="block h-full rounded-full bg-accent-400" style={{ width: `${(dist[n] / totalRatings) * 100}%` }} /></span>
                        <span className="num w-5 text-end text-stone-400">{dist[n]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ul className="space-y-4">
                {data.reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl bg-sand-50 p-5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-sm font-bold text-white">{r.author.name?.[0]}</span><span><span className="block text-sm font-bold text-ink">{r.author.name}</span><span className="text-[11px] text-stone-400">{formatDate(r.created_at, lang)}</span></span></span>
                      <span className="flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn('size-3.5', n <= r.rating ? 'fill-accent-400 text-accent-400' : 'text-sand-300')} />)}</span>
                    </div>
                    {r.comment && <p className="text-sm leading-relaxed text-stone-700">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <aside className="min-w-0 w-full lg:sticky lg:top-24">
            <BookingWidget key={space.id} space={space} />
          </aside>
        </div>
      </main>

      {tour && (
        <Suspense fallback={null}>
          <SpaceVirtualTourModal isOpen onClose={() => setTour(false)} space={space} onBookNow={() => { setTour(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </Suspense>
      )}
    </>,
  );
}
