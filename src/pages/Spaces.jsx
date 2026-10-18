import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { CalendarSearch, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { api } from '../lib/api';
import { cn, getLocalized, isoDate } from '../lib/utils';
import { useLanguageStore } from '../store/languageStore';
import { useLocations, useSpaceTypes } from '../lib/hooks';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Pagination, SearchInput, useDebounced } from '../components/ui/Dash';
import { EmptyState, ErrorState } from '../components/ui/Feedback';
import { SpaceCard, SpaceCardSkeleton } from '../components/spaces/SpaceCard';

const LIMIT = 12;
const CAPACITIES = [1, 4, 8, 15, 30];

function Filters({ params, set, types, locations, ar, lang }) {
  const date = params.get('date') || '';
  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-stone-500">{ar ? 'نوع المساحة' : 'Type'}</h4>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => set({ type: '' })} className={cn('rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all', !params.get('type') ? 'border-brand-600 bg-brand-700 text-white' : 'border-sand-300 bg-white text-stone-600 hover:border-brand-300')}>{ar ? 'الكل' : 'All'}</button>
          {types.map((t) => (
            <button key={t.key} onClick={() => set({ type: t.key })} className={cn('rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all', params.get('type') === t.key ? 'border-brand-600 bg-brand-700 text-white' : 'border-sand-300 bg-white text-stone-600 hover:border-brand-300')}>{getLocalized(t.name, lang)}</button>
          ))}
        </div>
      </div>

      <Select label={ar ? 'الفرع' : 'Branch'} value={params.get('location') || ''} onChange={(e) => set({ location: e.target.value })}>
        <option value="">{ar ? 'كل الفروع' : 'All branches'}</option>
        {locations.map((l) => <option key={l.slug} value={l.slug}>{getLocalized(l.name, lang)}</option>)}
      </Select>

      <div>
        <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-stone-500">{ar ? 'السعة (على الأقل)' : 'Min capacity'}</h4>
        <div className="flex flex-wrap gap-2">
          {CAPACITIES.map((c) => (
            <button key={c} onClick={() => set({ capacity: params.get('capacity') === String(c) ? '' : c })} className={cn('num rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all', params.get('capacity') === String(c) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-sand-300 bg-white text-stone-600 hover:border-brand-300')}>{c}+</button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl bg-sand-100/70 p-4">
        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500"><CalendarSearch className="size-3.5" />{ar ? 'المتاحة في وقت محدد' : 'Available at a time'}</h4>
        <Input type="date" min={isoDate()} value={date} onChange={(e) => set({ date: e.target.value, ...(e.target.value ? { start: params.get('start') || '10:00', end: params.get('end') || '12:00' } : { start: '', end: '' }) })} />
        {date && (
          <div className="grid grid-cols-2 gap-2">
            <Input type="time" aria-label="from" value={params.get('start') || ''} onChange={(e) => set({ start: e.target.value })} />
            <Input type="time" aria-label="to" value={params.get('end') || ''} onChange={(e) => set({ end: e.target.value })} />
          </div>
        )}
      </div>
    </div>
  );
}

export function Spaces() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const [params, setParams] = useSearchParams();
  const [sheet, setSheet] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(params.get('q') || '');
  const q = useDebounced(search, 350);

  const types = useSpaceTypes().data?.items || [];
  const locations = useLocations().data?.items || [];

  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v == null ? next.delete(k) : next.set(k, v)));
    setParams(next, { replace: true });
    setPage(1);
  };

  const query = {
    q,
    type: params.get('type'),
    location: params.get('location'),
    capacity: params.get('capacity'),
    sort: params.get('sort') || 'recommended',
    date: params.get('date'),
    start_time: params.get('date') ? params.get('start') : undefined,
    end_time: params.get('date') ? params.get('end') : undefined,
    limit: LIMIT,
    page,
  };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['spaces', query],
    queryFn: () => api.get('/spaces', query),
    placeholderData: (prev) => prev,
  });

  const activeChips = [
    params.get('type') && { key: 'type', label: getLocalized(types.find((t) => t.key === params.get('type'))?.name, lang) || params.get('type') },
    params.get('location') && { key: 'location', label: getLocalized(locations.find((l) => l.slug === params.get('location'))?.city, lang) || params.get('location') },
    params.get('capacity') && { key: 'capacity', label: `${params.get('capacity')}+ ${ar ? 'فرد' : 'ppl'}` },
    params.get('date') && { key: 'date', label: `${params.get('date')} ${params.get('start') || ''}–${params.get('end') || ''}`, clear: { date: '', start: '', end: '' } },
  ].filter(Boolean);

  const clearAll = () => { setSearch(''); setParams({}, { replace: true }); setPage(1); };
  const filtersProps = { params, set, types, locations, ar, lang };

  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <Navbar />
      <header className="bg-mesh border-b border-sand-200">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{ar ? 'اكتشف مساحتك' : 'Find your space'}</h1>
          <p className="mt-2 text-stone-600">{ar ? 'قاعات اجتماعات، مكاتب خاصة ومساحات عمل — فلتر وقارن واحجز.' : 'Meeting rooms, private offices and coworking — filter, compare, book.'}</p>
          <div className="mt-6 flex max-w-2xl gap-3">
            <SearchInput className="flex-1" value={search} onChange={setSearch} placeholder={ar ? 'ابحث بالاسم…' : 'Search by name…'} />
            <Button variant="outline" className="lg:hidden" icon={SlidersHorizontal} onClick={() => setSheet(true)}>{ar ? 'فلاتر' : 'Filters'}{activeChips.length > 0 && <span className="num ms-1 rounded-full bg-brand-700 px-1.5 text-[10px] text-white">{activeChips.length}</span>}</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <div className="surface sticky top-24 p-5"><Filters {...filtersProps} /></div>
          </aside>

          <section aria-live="polite">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-sm font-bold text-ink">{data?.total ?? '…'}</span>
                <span className="text-sm text-stone-500">{ar ? 'نتيجة' : 'results'}</span>
                {activeChips.map((c) => (
                  <button key={c.key} onClick={() => set(c.clear || { [c.key]: '' })} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 hover:bg-brand-100">
                    {c.label}<X className="size-3" />
                  </button>
                ))}
                {(activeChips.length > 0 || search) && <button onClick={clearAll} className="text-xs font-semibold text-stone-500 underline-offset-2 hover:underline">{ar ? 'مسح الكل' : 'Clear all'}</button>}
              </div>
              <Select aria-label="sort" wrapperClassName="w-48" value={query.sort} onChange={(e) => set({ sort: e.target.value })}>
                <option value="recommended">{ar ? 'الأنسب' : 'Recommended'}</option>
                <option value="price_asc">{ar ? 'الأقل سعراً' : 'Price: low to high'}</option>
                <option value="price_desc">{ar ? 'الأعلى سعراً' : 'Price: high to low'}</option>
                <option value="rating">{ar ? 'الأعلى تقييماً' : 'Top rated'}</option>
                <option value="capacity">{ar ? 'الأكبر سعة' : 'Largest capacity'}</option>
              </Select>
            </div>

            {error ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : isLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <SpaceCardSkeleton key={i} />)}</div>
            ) : data.items.length ? (
              <>
                <div className={cn('grid gap-6 transition-opacity sm:grid-cols-2 xl:grid-cols-3', isFetching && 'opacity-60')}>
                  {data.items.map((s, i) => <SpaceCard key={s.id} space={s} index={i} />)}
                </div>
                <div className="surface mt-8 overflow-hidden"><Pagination page={page} total={data.total} limit={LIMIT} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="border-t-0" /></div>
              </>
            ) : (
              <div className="surface">
                <EmptyState icon={SearchX} title={ar ? 'لا توجد مساحات مطابقة' : 'No spaces match'} description={ar ? 'جرّب تقليل الفلاتر أو تغيير الوقت.' : 'Try fewer filters or a different time.'} actionLabel={ar ? 'مسح الفلاتر' : 'Clear filters'} onAction={clearAll} />
              </div>
            )}
          </section>
        </div>
      </main>

      <Dialog.Root open={sheet} onOpenChange={setSheet}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-brand-950/50 backdrop-blur-sm lg:hidden" />
          <Dialog.Content dir={ar ? 'rtl' : 'ltr'} className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] animate-fade-up overflow-y-auto rounded-t-3xl bg-white p-6 shadow-glow outline-none lg:hidden">
            <div className="mb-5 flex items-center justify-between">
              <Dialog.Title className="text-lg font-bold">{ar ? 'الفلاتر' : 'Filters'}</Dialog.Title>
              <Dialog.Description className="sr-only">Filter spaces</Dialog.Description>
              <Dialog.Close className="rounded-lg p-1.5 text-stone-400 hover:bg-sand-100" aria-label="close"><X className="size-5" /></Dialog.Close>
            </div>
            <Filters {...filtersProps} />
            <Button className="mt-6 w-full" size="lg" onClick={() => setSheet(false)}>{ar ? `عرض ${data?.total ?? ''} نتيجة` : `Show ${data?.total ?? ''} results`}</Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Footer />
    </div>
  );
}
