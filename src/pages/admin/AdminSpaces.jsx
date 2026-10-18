import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Archive, Box, Copy, ExternalLink, Eye, Pencil, Plus, RotateCcw, Star, Trash2, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { formatEGP, getLocalized, normalizeSpace, unitLabel } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Card, ConfirmDialog, PageHeader, SearchInput, Tabs } from '../../components/ui/Dash';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { Badge } from '../../components/ui/StatusBadge';
import { SpaceEditor } from '../../components/spaces/SpaceEditor';

const SpaceVirtualTourModal = lazy(() => import('../../components/spaces/SpaceVirtualTourModal').then((m) => ({ default: m.SpaceVirtualTourModal })));

const STATUS_TONE = { active: 'success', draft: 'warning', archived: 'neutral' };

export function AdminSpaces() {
  const { lang } = useLanguageStore();
  const can = useAuthStore((s) => s.can);
  const qc = useQueryClient();
  const ar = lang === 'ar';
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null); // space | 'new'
  const [tour, setTour] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'spaces'], queryFn: () => api.get('/admin/spaces') });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'spaces'] });
  const onError = (e) => toast.error(e.message);

  const setStatusM = useMutation({
    mutationFn: ({ id, status: s }) => api.post(`/admin/spaces/${id}/status`, { status: s }),
    onSuccess: (_, v) => { toast.success(v.status === 'archived' ? (ar ? 'تمت الأرشفة' : 'Archived') : ar ? 'تم التفعيل' : 'Activated'); invalidate(); },
    onError,
  });
  const duplicate = useMutation({
    mutationFn: (id) => api.post(`/admin/spaces/${id}/duplicate`),
    onSuccess: () => { toast.success(ar ? 'تم إنشاء نسخة (مسودة)' : 'Duplicated as draft'); invalidate(); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/admin/spaces/${id}`),
    onSuccess: () => { toast.success(ar ? 'تم حذف المساحة' : 'Space deleted'); setDeleting(null); invalidate(); },
    onError: (e) => { toast.error(e.message); setDeleting(null); },
  });

  const all = (data?.items || []).map((s) => normalizeSpace(s, lang));
  const needle = search.trim().toLowerCase();
  const list = all.filter((s) => (status === 'all' || s.status === status) && (!needle || `${s.name} ${s.name_i18n?.en || ''} ${s.slug}`.toLowerCase().includes(needle)));
  const count = (s) => all.filter((x) => s === 'all' || x.status === s).length;
  const canEdit = can('spaces.edit');

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Box}
        title={ar ? 'المساحات' : 'Spaces'}
        description={ar ? 'أدِر قاعات الاجتماعات والمكاتب: الأسعار، السعة، الساعات، الصور، والحالة.' : 'Manage rooms and offices: pricing, capacity, hours, photos and visibility.'}
        actions={can('spaces.create') && <Button icon={Plus} onClick={() => setEditing('new')}>{ar ? 'مساحة جديدة' : 'New space'}</Button>}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: ar ? 'الكل' : 'All', count: count('all') },
            { value: 'active', label: ar ? 'نشطة' : 'Active', count: count('active') },
            { value: 'draft', label: ar ? 'مسودات' : 'Drafts', count: count('draft') },
            { value: 'archived', label: ar ? 'مؤرشفة' : 'Archived', count: count('archived') },
          ]}
        />
        <SearchInput className="w-full lg:w-72" value={search} onChange={setSearch} placeholder={ar ? 'ابحث بالاسم…' : 'Search by name…'} />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-80" />)}</div>
      ) : list.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s, i) => (
            <Card key={s.id} padded={false} style={{ '--i': i }} className="stagger group overflow-hidden">
              <div className="relative aspect-[16/9] overflow-hidden bg-sand-100">
                <img src={s.image_url} alt={s.name} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
                  <Badge variant={STATUS_TONE[s.status]} className="bg-white/90 backdrop-blur">{{ active: ar ? 'نشطة' : 'Active', draft: ar ? 'مسودة' : 'Draft', archived: ar ? 'مؤرشفة' : 'Archived' }[s.status]}</Badge>
                  {s.featured && <span className="grid size-7 place-items-center rounded-full bg-accent-500 text-white shadow"><Star className="size-3.5 fill-current" /></span>}
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <h3 className="line-clamp-1 font-bold text-ink">{s.name}</h3>
                  <p className="line-clamp-1 text-xs text-stone-500">{s.type_name} · {s.location_name}</p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 text-stone-600"><Users className="size-4" /><span className="num font-semibold">{s.capacity}</span></span>
                  {s.from_price != null ? (
                    <span className="num font-extrabold text-brand-700">
                      <span className="text-[11px] font-medium text-stone-400">{ar ? 'من ' : 'from '}</span>
                      {formatEGP(s.from_price, lang)}
                      <span className="text-[11px] font-medium text-stone-400"> / {unitLabel(s.from_unit, lang)}</span>
                    </span>
                  ) : <span className="text-xs text-rose-600">{ar ? 'بدون سعر' : 'no price'}</span>}
                </div>
                <div className="flex items-center gap-1.5 border-t border-sand-100 pt-3">
                  {canEdit && <Button size="sm" variant="outline" icon={Pencil} className="flex-1" onClick={() => setEditing(s)}>{ar ? 'تعديل' : 'Edit'}</Button>}
                  <Button size="icon" variant="ghost" className="p-2!" aria-label="3D tour" title={ar ? 'معاينة الجولة 3D' : '3D tour'} onClick={() => setTour(s)}><Eye className="size-4" /></Button>
                  {s.status === 'active' && (
                    <a href={`/spaces/${s.slug}`} target="_blank" rel="noreferrer" aria-label="view" title={ar ? 'عرض في الموقع' : 'View on site'} className="grid size-9 place-items-center rounded-xl text-stone-600 hover:bg-sand-100">
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                  {can('spaces.create') && <Button size="icon" variant="ghost" className="p-2!" aria-label="duplicate" title={ar ? 'نسخ' : 'Duplicate'} loading={duplicate.isPending && duplicate.variables === s.id} onClick={() => duplicate.mutate(s.id)}><Copy className="size-4" /></Button>}
                  {canEdit && (
                    <Button size="icon" variant="ghost" className="p-2!" aria-label="toggle" title={s.status === 'archived' ? (ar ? 'إعادة تفعيل' : 'Restore') : ar ? 'أرشفة' : 'Archive'} onClick={() => setStatusM.mutate({ id: s.id, status: s.status === 'archived' ? 'active' : 'archived' })}>
                      {s.status === 'archived' ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}
                    </Button>
                  )}
                  {can('spaces.delete') && <Button size="icon" variant="ghost" className="p-2! hover:text-rose-600!" aria-label="delete" onClick={() => setDeleting(s)}><Trash2 className="size-4" /></Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card><EmptyState icon={Box} title={ar ? 'لا توجد مساحات مطابقة' : 'No spaces found'} actionLabel={can('spaces.create') ? (ar ? 'إضافة مساحة' : 'Add a space') : undefined} onAction={() => setEditing('new')} /></Card>
      )}

      {editing && <SpaceEditor space={editing === 'new' ? null : data.items.find((x) => x.id === editing.id)} onClose={() => setEditing(null)} />}
      {tour && (
        <Suspense fallback={null}>
          <SpaceVirtualTourModal isOpen onClose={() => setTour(null)} space={tour} />
        </Suspense>
      )}
      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.id)}
        loading={remove.isPending}
        danger
        title={ar ? 'حذف المساحة' : 'Delete space'}
        description={deleting ? (ar ? `سيتم حذف "${deleting.name}" نهائياً. إن كانت لها حجوزات فاستخدم الأرشفة بدلاً من الحذف.` : `"${deleting.name}" will be permanently deleted. If it has bookings, archive it instead.`) : ''}
        confirmLabel={ar ? 'حذف' : 'Delete'}
      />
    </div>
  );
}
