import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { Building2, Compass, MapPin, Search, Sparkles, Users, X } from 'lucide-react';
import { api } from '../../lib/api';
import { getLocalized } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { useDebounced } from '../ui/Dash';
import { Spinner } from '../ui/Feedback';

export function CommandPalette({ isOpen, onClose }) {
  const { lang, dir } = useLanguageStore();
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 250);

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  const { data, isFetching } = useQuery({
    queryKey: ['space-search', q],
    queryFn: () => api.get('/spaces', { q, limit: 6 }),
    enabled: isOpen && q.length >= 2,
  });

  const shortcuts = [
    { id: 'all', icon: Compass, title: ar ? 'تصفح كل المساحات' : 'Browse all spaces', path: '/spaces' },
    { id: 'meeting', icon: Users, title: ar ? 'قاعات الاجتماعات' : 'Meeting rooms', path: '/spaces?type=meeting_room' },
    { id: 'office', icon: Building2, title: ar ? 'المكاتب الخاصة' : 'Private offices', path: '/spaces?type=private_office' },
    { id: 'loc', icon: MapPin, title: ar ? 'الفروع' : 'Branches', path: '/locations' },
  ];
  const items = q.length >= 2
    ? (data?.items || []).map((s) => ({
        id: s.id,
        icon: Building2,
        title: getLocalized(s.name, lang),
        subtitle: `${getLocalized(s.location?.name, lang)} · ${getLocalized(s.type?.name, lang)}`,
        capacity: s.capacity,
        path: `/spaces/${s.slug}`,
      }))
    : shortcuts;

  const go = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-brand-950/50 backdrop-blur-sm" />
        <Dialog.Content
          dir={dir}
          className="fixed start-1/2 top-[12vh] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-glow outline-none animate-pop rtl:translate-x-1/2"
        >
          <Dialog.Title className="sr-only">{ar ? 'بحث' : 'Search'}</Dialog.Title>
          <Dialog.Description className="sr-only">{ar ? 'ابحث عن مساحة' : 'Search spaces'}</Dialog.Description>
          <div className="flex items-center gap-3 border-b border-sand-100 px-5">
            <Search className="size-5 shrink-0 text-stone-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && items[0] && go(items[0].path)}
              placeholder={ar ? 'ابحث عن مساحة، نوع، أو فرع…' : 'Search spaces, types or branches…'}
              className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
            />
            {isFetching ? <Spinner className="size-4" /> : query && <button onClick={() => setQuery('')} className="rounded-md p-1 text-stone-400 hover:text-ink" aria-label="clear"><X className="size-4" /></button>}
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {q.length >= 2 && !isFetching && items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-stone-400">{ar ? 'لا توجد نتائج مطابقة' : 'No matching spaces'}</p>
            ) : (
              items.map((it) => {
                const Icon = it.icon;
                return (
                  <button key={it.id} onClick={() => go(it.path)} className="group flex w-full items-center justify-between gap-3 rounded-xl p-3 text-start transition-colors hover:bg-brand-50">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sand-100 text-stone-600 transition-colors group-hover:bg-brand-700 group-hover:text-white"><Icon className="size-4" /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{it.title}</span>
                        {it.subtitle && <span className="block truncate text-xs text-stone-500">{it.subtitle}</span>}
                      </span>
                    </span>
                    {it.capacity && <span className="num inline-flex items-center gap-1 text-xs text-stone-400"><Users className="size-3.5" />{it.capacity}</span>}
                  </button>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between border-t border-sand-100 bg-sand-50 px-4 py-2 text-[11px] text-stone-500">
            <span className="inline-flex items-center gap-1"><Sparkles className="size-3 text-accent-500" />{ar ? 'اضغط Enter لفتح أول نتيجة' : 'Press Enter to open the first result'}</span>
            <kbd className="rounded border border-sand-200 bg-white px-1.5 font-mono">ESC</kbd>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
