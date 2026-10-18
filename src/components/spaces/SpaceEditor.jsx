import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ImagePlus, Plus, Trash2, Star } from 'lucide-react';
import { api, fieldErrors } from '../../lib/api';
import { UNIT_LABELS, WEEKDAYS, cn, getLocalized } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Dash';

const UNITS = Object.keys(UNIT_LABELS);
const defaultHours = () => Array.from({ length: 7 }, (_, weekday) => ({ weekday, opens: '08:00', closes: '23:00', is_closed: false }));
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function Section({ title, hint, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-sm font-bold text-ink">{title}</h4>
        {hint && <p className="text-xs text-stone-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function toForm(space) {
  if (!space) {
    return {
      slug: '', name: { ar: '', en: '' }, description: { ar: '', en: '' }, type_id: '', location_id: '', capacity: 4, units: 1, area_sqm: '', floor: '',
      status: 'active', featured: false, images: [], amenity_ids: [], rules: [],
      pricing: [{ unit: 'hourly', kind: 'base', amount: 100, active: true }], hours: defaultHours(),
    };
  }
  const hours = defaultHours().map((d) => space.hours?.find((h) => h.weekday === d.weekday) || d);
  return {
    slug: space.slug, name: { ar: space.name?.ar || '', en: space.name?.en || '' }, description: { ar: space.description?.ar || '', en: space.description?.en || '' },
    type_id: space.type?.id || '', location_id: space.location?.id || '', capacity: space.capacity, units: space.units, area_sqm: space.area_sqm ?? '', floor: space.floor || '',
    status: space.status, featured: space.featured, images: (space.images || []).map((i) => ({ url: i.url, alt: i.alt || undefined })),
    amenity_ids: (space.amenities || []).map((a) => a.id), rules: (space.rules || []).map((r) => ({ ar: r.ar || '', en: r.en || '' })),
    pricing: (space.pricing || []).map((p) => ({ unit: p.unit, kind: p.kind, amount: p.amount, peak_start: p.peak_start || undefined, peak_end: p.peak_end || undefined, active: p.active })),
    hours,
  };
}

export function SpaceEditor({ space, onClose }) {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [form, setForm] = useState(() => toForm(space));
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(space));
  const isEdit = Boolean(space);

  const types = useQuery({ queryKey: ['admin', 'space-types'], queryFn: () => api.get('/admin/space-types') });
  const locations = useQuery({ queryKey: ['admin', 'locations'], queryFn: () => api.get('/admin/locations') });
  const amenities = useQuery({ queryKey: ['admin', 'amenities'], queryFn: () => api.get('/admin/amenities') });

  const patch = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const patchName = (k, v) =>
    setForm((f) => ({
      ...f,
      name: { ...f.name, [k]: v },
      slug: !slugTouched && k === 'en' ? slugify(v) : f.slug,
    }));
  const rowPatch = (key, i, p) => setForm((f) => ({ ...f, [key]: f[key].map((r, idx) => (idx === i ? { ...r, ...p } : r)) }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        capacity: Number(form.capacity),
        units: Number(form.units),
        area_sqm: form.area_sqm === '' ? undefined : Number(form.area_sqm),
        floor: form.floor || undefined,
        pricing: form.pricing.map((p) => ({ ...p, amount: Number(p.amount), ...(p.kind === 'peak' ? {} : { peak_start: undefined, peak_end: undefined }) })),
        rules: form.rules.filter((r) => r.ar.trim() || r.en.trim()),
        hours: form.hours.map((h) => ({ ...h })),
      };
      return isEdit ? api.put(`/admin/spaces/${space.id}`, body) : api.post('/admin/spaces', body);
    },
    onSuccess: () => {
      toast.success(isEdit ? (ar ? 'تم حفظ التعديلات' : 'Space saved') : ar ? 'تمت إضافة المساحة' : 'Space created');
      qc.invalidateQueries({ queryKey: ['admin', 'spaces'] });
      onClose();
    },
    onError: (e) => {
      setErrors(fieldErrors(e));
      toast.error(e.fields ? (ar ? 'راجع الحقول المعلّمة بالأحمر' : 'Please fix the highlighted fields') : e.message);
    },
  });

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { url } = await api.upload('/admin/uploads/image', file, 'image');
        setForm((f) => ({ ...f, images: [...f.images, { url }] }));
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const err = (k) => errors[k];
  const days = WEEKDAYS[lang];

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      title={isEdit ? (ar ? 'تعديل المساحة' : 'Edit space') : ar ? 'مساحة جديدة' : 'New space'}
      description={isEdit ? getLocalized(space.name, lang) : undefined}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-stone-400">{Object.keys(errors).length ? (ar ? 'توجد حقول تحتاج مراجعة' : 'Some fields need attention') : ''}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>{ar ? 'إلغاء' : 'Cancel'}</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>{ar ? 'حفظ' : 'Save'}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        <Section title={ar ? 'المعلومات الأساسية' : 'Basics'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={ar ? 'الاسم (عربي)' : 'Name (Arabic)'} required value={form.name.ar} onChange={(e) => patchName('ar', e.target.value)} error={err('name.ar')} />
            <Input label={ar ? 'الاسم (إنجليزي)' : 'Name (English)'} value={form.name.en} onChange={(e) => patchName('en', e.target.value)} />
            <Input label={ar ? 'الرابط (slug)' : 'URL slug'} required value={form.slug} onChange={(e) => { setSlugTouched(true); patch('slug', e.target.value); }} error={err('slug')} helper="nile-meeting-room" className="font-mono" />
            <Select label={ar ? 'الحالة' : 'Status'} value={form.status} onChange={(e) => patch('status', e.target.value)}>
              <option value="active">{ar ? 'نشطة (ظاهرة للعملاء)' : 'Active (visible)'}</option>
              <option value="draft">{ar ? 'مسودة' : 'Draft'}</option>
              <option value="archived">{ar ? 'مؤرشفة' : 'Archived'}</option>
            </Select>
            <Select label={ar ? 'النوع' : 'Type'} required value={form.type_id} onChange={(e) => patch('type_id', e.target.value)} error={err('type_id')}>
              <option value="">{ar ? 'اختر…' : 'Select…'}</option>
              {types.data?.items?.map((t) => <option key={t.id} value={t.id}>{getLocalized(t.name, lang)}</option>)}
            </Select>
            <Select label={ar ? 'الفرع' : 'Branch'} required value={form.location_id} onChange={(e) => patch('location_id', e.target.value)} error={err('location_id')}>
              <option value="">{ar ? 'اختر…' : 'Select…'}</option>
              {locations.data?.items?.map((l) => <option key={l.id} value={l.id}>{getLocalized(l.name, lang)}</option>)}
            </Select>
            <Textarea label={ar ? 'الوصف (عربي)' : 'Description (Arabic)'} value={form.description.ar} onChange={(e) => patch('description', { ...form.description, ar: e.target.value })} />
            <Textarea label={ar ? 'الوصف (إنجليزي)' : 'Description (English)'} value={form.description.en} onChange={(e) => patch('description', { ...form.description, en: e.target.value })} />
            <label className="flex items-center gap-3 sm:col-span-2">
              <Toggle checked={form.featured} onChange={(v) => patch('featured', v)} label="featured" />
              <span className="text-sm font-semibold text-ink">{ar ? 'مساحة مميّزة (تظهر في الصفحة الرئيسية)' : 'Featured (shown on the homepage)'}</span>
            </label>
          </div>
        </Section>

        <Section title={ar ? 'السعة والتفاصيل' : 'Capacity & details'}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Input type="number" min="1" label={ar ? 'السعة (أفراد)' : 'Capacity'} required value={form.capacity} onChange={(e) => patch('capacity', e.target.value)} error={err('capacity')} />
            <Input type="number" min="1" label={ar ? 'عدد الوحدات' : 'Units'} value={form.units} onChange={(e) => patch('units', e.target.value)} helper={ar ? 'قاعات متطابقة' : 'identical rooms'} />
            <Input type="number" min="0" label={ar ? 'المساحة م²' : 'Area m²'} value={form.area_sqm} onChange={(e) => patch('area_sqm', e.target.value)} />
            <Input label={ar ? 'الطابق' : 'Floor'} value={form.floor} onChange={(e) => patch('floor', e.target.value)} />
          </div>
        </Section>

        <Section title={ar ? 'التسعير' : 'Pricing'} hint={ar ? 'أضف سعراً أساسياً لكل وحدة حجز متاحة. سعر "الذروة" يُطبَّق في نافذة زمنية.' : 'One base price per bookable unit. A "peak" price applies within a time window.'}>
          {err('pricing') && <p className="text-xs font-medium text-rose-600">{err('pricing')}</p>}
          <div className="space-y-2">
            {form.pricing.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 rounded-xl border border-sand-200 p-3 sm:grid-cols-[1.2fr_1fr_1fr_auto_auto]">
                <Select label={ar ? 'الوحدة' : 'Unit'} value={p.unit} onChange={(e) => rowPatch('pricing', i, { unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u][lang]}</option>)}
                </Select>
                <Select label={ar ? 'النوع' : 'Kind'} value={p.kind} onChange={(e) => rowPatch('pricing', i, { kind: e.target.value })}>
                  <option value="base">{ar ? 'أساسي' : 'Base'}</option>
                  <option value="weekend">{ar ? 'عطلة' : 'Weekend'}</option>
                  <option value="peak">{ar ? 'ذروة' : 'Peak'}</option>
                </Select>
                <Input type="number" min="0" label={ar ? 'السعر (ج.م)' : 'Price (EGP)'} value={p.amount} onChange={(e) => rowPatch('pricing', i, { amount: e.target.value })} />
                <div className="pb-2.5"><Toggle checked={p.active} onChange={(v) => rowPatch('pricing', i, { active: v })} label="active" /></div>
                <Button variant="ghost" size="icon" aria-label="remove" className="mb-0.5 hover:text-rose-600" onClick={() => setForm((f) => ({ ...f, pricing: f.pricing.filter((_, idx) => idx !== i) }))}>
                  <Trash2 className="size-4" />
                </Button>
                {p.kind === 'peak' && (
                  <div className="col-span-full grid grid-cols-2 gap-2">
                    <Input type="time" label={ar ? 'بداية الذروة' : 'Peak start'} value={p.peak_start || ''} onChange={(e) => rowPatch('pricing', i, { peak_start: e.target.value })} />
                    <Input type="time" label={ar ? 'نهاية الذروة' : 'Peak end'} value={p.peak_end || ''} onChange={(e) => rowPatch('pricing', i, { peak_end: e.target.value })} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" icon={Plus} onClick={() => patch('pricing', [...form.pricing, { unit: 'daily', kind: 'base', amount: 0, active: true }])}>
            {ar ? 'إضافة سعر' : 'Add price'}
          </Button>
        </Section>

        <Section title={ar ? 'ساعات العمل' : 'Opening hours'}>
          <div className="space-y-1.5">
            {[6, 0, 1, 2, 3, 4, 5].map((wd) => {
              const h = form.hours.find((x) => x.weekday === wd);
              const idx = form.hours.indexOf(h);
              return (
                <div key={wd} className="flex flex-wrap items-center gap-3 rounded-xl bg-sand-50 px-3 py-2">
                  <span className="w-20 text-sm font-semibold text-ink">{days[wd]}</span>
                  <Toggle checked={!h.is_closed} onChange={(open) => rowPatch('hours', idx, { is_closed: !open })} label={days[wd]} />
                  {h.is_closed ? (
                    <span className="text-xs text-stone-400">{ar ? 'مغلق' : 'Closed'}</span>
                  ) : (
                    <div className="flex items-center gap-2" dir="ltr">
                      <input type="time" value={h.opens} onChange={(e) => rowPatch('hours', idx, { opens: e.target.value })} className="rounded-lg border border-sand-300 bg-white px-2 py-1 text-sm" />
                      <span className="text-stone-400">–</span>
                      <input type="time" value={h.closes === '24:00' ? '23:59' : h.closes} onChange={(e) => rowPatch('hours', idx, { closes: e.target.value })} className="rounded-lg border border-sand-300 bg-white px-2 py-1 text-sm" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <Section title={ar ? 'المرافق' : 'Amenities'}>
          <div className="flex flex-wrap gap-2">
            {amenities.data?.items?.map((a) => {
              const on = form.amenity_ids.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => patch('amenity_ids', on ? form.amenity_ids.filter((x) => x !== a.id) : [...form.amenity_ids, a.id])}
                  className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-all', on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-sand-300 bg-white text-stone-600 hover:border-brand-300')}
                  aria-pressed={on}
                >
                  {getLocalized(a.name, lang)}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title={ar ? 'الصور' : 'Images'} hint={ar ? 'الصورة الأولى هي الغلاف.' : 'The first image is the cover.'}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {form.images.map((img, i) => (
              <div key={`${img.url}-${i}`} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-sand-200 bg-sand-100">
                <img src={img.url} alt="" className="size-full object-cover" />
                {i === 0 && <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-bold text-white"><Star className="size-3 fill-current" />{ar ? 'الغلاف' : 'Cover'}</span>}
                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {i > 0 ? (
                    <button type="button" onClick={() => patch('images', [img, ...form.images.filter((_, idx) => idx !== i)])} className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold text-ink">{ar ? 'اجعلها الغلاف' : 'Make cover'}</button>
                  ) : <span />}
                  <button type="button" aria-label="remove" onClick={() => patch('images', form.images.filter((_, idx) => idx !== i))} className="rounded-md bg-rose-600 p-1 text-white"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="grid aspect-[4/3] place-items-center rounded-xl border-2 border-dashed border-sand-300 text-stone-400 transition-colors hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-600 disabled:opacity-50"
            >
              <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                <ImagePlus className="size-6" />
                {uploading ? (ar ? 'جارٍ الرفع…' : 'Uploading…') : ar ? 'رفع صور' : 'Upload'}
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload([...e.target.files])} />
          </div>
        </Section>

        <Section title={ar ? 'قواعد المساحة' : 'House rules'}>
          <div className="space-y-2">
            {form.rules.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <Input aria-label="ar" placeholder={ar ? 'القاعدة (عربي)' : 'Rule (Arabic)'} value={r.ar} onChange={(e) => rowPatch('rules', i, { ar: e.target.value })} />
                <Input aria-label="en" placeholder={ar ? 'القاعدة (إنجليزي)' : 'Rule (English)'} value={r.en} onChange={(e) => rowPatch('rules', i, { en: e.target.value })} />
                <Button variant="ghost" size="icon" aria-label="remove" onClick={() => setForm((f) => ({ ...f, rules: f.rules.filter((_, idx) => idx !== i) }))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" icon={Plus} onClick={() => patch('rules', [...form.rules, { ar: '', en: '' }])}>{ar ? 'إضافة قاعدة' : 'Add rule'}</Button>
        </Section>
      </div>
    </Modal>
  );
}
