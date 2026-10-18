import { Link } from 'react-router-dom';
import { Heart, MapPin, Star, Users } from 'lucide-react';
import { cn, formatEGP, normalizeSpace, unitLabel } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { useFavorites } from '../../lib/hooks';
import { Badge } from '../ui/StatusBadge';

const AVAIL = {
  available: { ar: 'متاحة', en: 'Available', variant: 'success' },
  limited: { ar: 'عدد محدود', en: 'Limited', variant: 'warning' },
};

export function SpaceCard({ space: raw, index = 0, className }) {
  const lang = useLanguageStore((s) => s.lang);
  const ar = lang === 'ar';
  const fav = useFavorites();
  const s = normalizeSpace(raw, lang);
  const isFav = fav.has(s.id);
  const avail = AVAIL[raw.availability];

  return (
    <article style={{ '--i': index }} className={cn('surface surface-hover stagger group relative flex flex-col overflow-hidden', className)}>
      <Link to={`/spaces/${s.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-sand-100" aria-label={s.name}>
        <img src={s.image_url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950/60 via-transparent to-transparent opacity-80" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-brand-800 backdrop-blur">{s.type_name}</span>
          {s.rating_count > 0 && (
            <span className="num inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
              <Star className="size-3 fill-accent-300 text-accent-300" />
              {Number(s.rating_avg).toFixed(1)} <span className="font-medium opacity-70">({s.rating_count})</span>
            </span>
          )}
        </div>
      </Link>

      <button
        type="button"
        onClick={() => fav.toggle(s.id)}
        aria-pressed={isFav}
        aria-label={ar ? 'إضافة للمفضلة' : 'Favourite'}
        className="absolute end-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 text-stone-500 shadow backdrop-blur transition-all hover:scale-110 hover:text-rose-500"
      >
        <Heart className={cn('size-4 transition-colors', isFav && 'fill-rose-500 text-rose-500')} />
      </button>
      {(s.featured || avail) && (
        <div className="absolute start-3 top-3 flex gap-1.5">
          {s.featured && <Badge variant="accent" className="bg-white/90 backdrop-blur">{ar ? 'مميّزة' : 'Featured'}</Badge>}
          {avail && <Badge variant={avail.variant} className="bg-white/90 backdrop-blur" dot>{avail[lang]}</Badge>}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1.5">
          <h3 className="line-clamp-1 text-base font-bold text-ink transition-colors group-hover:text-brand-700">
            <Link to={`/spaces/${s.slug}`}>{s.name}</Link>
          </h3>
          <p className="flex items-center gap-1.5 text-xs text-stone-500">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{s.location_name}</span>
          </p>
        </div>

        {s.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {s.amenities.slice(0, 3).map((a) => (
              <span key={a.id} className="rounded-lg bg-sand-100 px-2 py-1 text-[10px] font-semibold text-stone-600">
                {typeof a.name === 'object' ? a.name[lang]?.replace(/\s*\(.*\)$/, '') : a.name}
              </span>
            ))}
            {s.amenities.length > 3 && <span className="rounded-lg bg-sand-100 px-2 py-1 text-[10px] font-semibold text-stone-500">+{s.amenities.length - 3}</span>}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between border-t border-sand-100 pt-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600">
            <Users className="size-4 text-brand-600" />
            <span className="num">{s.capacity}</span> {ar ? 'فرد' : 'ppl'}
          </span>
          {s.from_price != null && (
            <span className="text-end leading-tight">
              <span className="block text-[10px] font-semibold text-stone-400">{ar ? 'تبدأ من' : 'from'}</span>
              <span className="num text-lg font-extrabold tracking-tight text-brand-700">{formatEGP(s.from_price, lang)}</span>
              <span className="text-[11px] font-medium text-stone-400"> / {unitLabel(s.from_unit, lang)}</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function SpaceCardSkeleton() {
  return (
    <div className="surface overflow-hidden">
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-5 w-2/3" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton mt-4 h-8 w-full" />
      </div>
    </div>
  );
}
