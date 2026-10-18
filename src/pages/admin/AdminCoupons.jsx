import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { api, fieldErrors } from '../../lib/api';
import { formatDate, formatEGP, getLocalized } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { Button } from '../../components/ui/Button';
import { Card, ConfirmDialog, DataTable, PageHeader, Toggle } from '../../components/ui/Dash';
import { EmptyState, ErrorState } from '../../components/ui/Feedback';
import { Input, Textarea } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/StatusBadge';

const blank = { code: '', description_ar: '', description_en: '', discount_type: 'percentage', value: 10, max_discount: '', min_amount: 0, starts_at: '', ends_at: '', usage_limit: '', per_user_limit: '', active: true };
const dateInput = (v) => (v ? String(v).slice(0, 10) : '');

function CouponForm({ coupon, onClose }) {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const qc = useQueryClient();
  const [form, setForm] = useState(() =>
    coupon
      ? {
          code: coupon.code, description_ar: coupon.description?.ar || '', description_en: coupon.description?.en || '', discount_type: coupon.discount_type,
          value: Number(coupon.value), max_discount: coupon.max_discount ?? '', min_amount: Number(coupon.min_amount || 0), starts_at: dateInput(coupon.starts_at),
          ends_at: dateInput(coupon.ends_at), usage_limit: coupon.usage_limit ?? '', per_user_limit: coupon.per_user_limit ?? '', active: coupon.active,
        }
      : blank,
  );
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        code: form.code,
        description: { ar: form.description_ar, en: form.description_en },
        discount_type: form.discount_type,
        value: Number(form.value),
        max_discount: form.discount_type === 'percentage' ? form.max_discount : '',
        min_amount: Number(form.min_amount || 0),
        starts_at: form.starts_at,
        ends_at: form.ends_at ? `${form.ends_at}T23:59:59` : '',
        usage_limit: form.usage_limit,
        per_user_limit: form.per_user_limit,
        active: form.active,
      };
      return coupon ? api.put(`/admin/coupons/${coupon.id}`, body) : api.post('/admin/coupons', body);
    },
    onSuccess: () => {
      toast.success(coupon ? (ar ? 'تم تحديث الكوبون' : 'Coupon updated') : ar ? 'تم إنشاء الكوبون' : 'Coupon created');
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      onClose();
    },
    onError: (e) => {
      setErrors(fieldErrors(e));
      toast.error(e.message);
    },
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={coupon ? (ar ? 'تعديل الكوبون' : 'Edit coupon') : ar ? 'كوبون جديد' : 'New coupon'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{ar ? 'إلغاء' : 'Cancel'}</Button>
          <Button loading={save.isPending} onClick={() => save.mutate()} disabled={!form.code || !form.value}>{ar ? 'حفظ' : 'Save'}</Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={ar ? 'الكود' : 'Code'} required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} error={errors.code} className="font-mono font-bold uppercase" placeholder="WELCOME10" />
        <Select label={ar ? 'نوع الخصم' : 'Discount type'} value={form.discount_type} onChange={set('discount_type')}>
          <option value="percentage">{ar ? 'نسبة مئوية %' : 'Percentage %'}</option>
          <option value="fixed">{ar ? 'مبلغ ثابت (ج.م)' : 'Fixed amount (EGP)'}</option>
        </Select>
        <Input type="number" min="0" label={form.discount_type === 'percentage' ? (ar ? 'نسبة الخصم %' : 'Percent off') : ar ? 'قيمة الخصم' : 'Amount off'} required value={form.value} onChange={set('value')} error={errors.value} />
        {form.discount_type === 'percentage' ? (
          <Input type="number" min="0" label={ar ? 'أقصى خصم (ج.م)' : 'Max discount (EGP)'} value={form.max_discount} onChange={set('max_discount')} helper={ar ? 'اختياري' : 'optional'} />
        ) : (
          <div />
        )}
        <Input type="number" min="0" label={ar ? 'الحد الأدنى للحجز' : 'Minimum booking'} value={form.min_amount} onChange={set('min_amount')} />
        <Input type="number" min="1" label={ar ? 'حد الاستخدام الكلي' : 'Total usage limit'} value={form.usage_limit} onChange={set('usage_limit')} helper={ar ? 'فارغ = بلا حد' : 'empty = unlimited'} />
        <Input type="number" min="1" label={ar ? 'حد الاستخدام للعميل' : 'Per-customer limit'} value={form.per_user_limit} onChange={set('per_user_limit')} helper={ar ? 'فارغ = بلا حد' : 'empty = unlimited'} />
        <div />
        <Input type="date" label={ar ? 'يبدأ في' : 'Starts'} value={form.starts_at} onChange={set('starts_at')} />
        <Input type="date" label={ar ? 'ينتهي في' : 'Ends'} value={form.ends_at} onChange={set('ends_at')} />
        <Textarea rows={2} label={ar ? 'الوصف (عربي)' : 'Description (Arabic)'} value={form.description_ar} onChange={set('description_ar')} />
        <Textarea rows={2} label={ar ? 'الوصف (إنجليزي)' : 'Description (English)'} value={form.description_en} onChange={set('description_en')} />
        <label className="flex items-center gap-3 sm:col-span-2">
          <Toggle checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="active" />
          <span className="text-sm font-semibold text-ink">{ar ? 'الكوبون مفعّل' : 'Coupon is active'}</span>
        </label>
      </div>
    </Modal>
  );
}

export function AdminCoupons() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // coupon | 'new'
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => api.get('/admin/coupons') });

  const toggle = useMutation({
    mutationFn: (c) =>
      api.put(`/admin/coupons/${c.id}`, {
        code: c.code, description: c.description, discount_type: c.discount_type, value: Number(c.value), max_discount: c.max_discount ?? '', min_amount: Number(c.min_amount || 0),
        starts_at: c.starts_at || '', ends_at: c.ends_at || '', usage_limit: c.usage_limit ?? '', per_user_limit: c.per_user_limit ?? '', active: !c.active,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (c) => api.delete(`/admin/coupons/${c.id}`),
    onSuccess: () => {
      toast.success(ar ? 'تم حذف الكوبون' : 'Coupon deleted');
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
    onError: (e) => {
      toast.error(e.message);
      setDeleting(null);
    },
  });

  const columns = [
    {
      key: 'code',
      header: ar ? 'الكود' : 'Code',
      render: (c) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(c.code); toast.success(ar ? 'تم نسخ الكود' : 'Code copied'); }}
          className="group inline-flex items-center gap-2 rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-sm font-extrabold text-brand-700"
          title={ar ? 'نسخ' : 'Copy'}
        >
          {c.code}
          <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      ),
    },
    {
      key: 'discount',
      header: ar ? 'الخصم' : 'Discount',
      render: (c) => (
        <div>
          <p className="num font-bold text-ink">{c.discount_type === 'percentage' ? `${Number(c.value)}%` : formatEGP(c.value, lang)}</p>
          {c.max_discount && <p className="text-[11px] text-stone-400">{ar ? 'حتى' : 'max'} {formatEGP(c.max_discount, lang)}</p>}
        </div>
      ),
    },
    { key: 'desc', header: ar ? 'الوصف' : 'Description', render: (c) => <span className="line-clamp-2 max-w-[220px] text-xs text-stone-600">{getLocalized(c.description, lang) || '—'}</span> },
    {
      key: 'usage',
      header: ar ? 'الاستخدام' : 'Usage',
      render: (c) => (
        <div className="num text-xs">
          <p className="font-bold text-ink">{c.used}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</p>
          <p className="text-stone-400">{formatEGP(c.total_discount, lang)} {ar ? 'خصم' : 'given'}</p>
        </div>
      ),
    },
    {
      key: 'validity',
      header: ar ? 'الصلاحية' : 'Validity',
      render: (c) => (
        <span className="whitespace-nowrap text-xs text-stone-500">
          {c.starts_at || c.ends_at ? `${c.starts_at ? formatDate(c.starts_at, lang) : '…'} → ${c.ends_at ? formatDate(c.ends_at, lang) : '…'}` : ar ? 'مفتوحة' : 'Always'}
        </span>
      ),
    },
    {
      key: 'status',
      header: ar ? 'الحالة' : 'Status',
      render: (c) => {
        const expired = c.ends_at && new Date(c.ends_at) < new Date();
        const spent = c.usage_limit && c.used >= c.usage_limit;
        return expired || spent ? <Badge variant="neutral">{expired ? (ar ? 'منتهي' : 'Expired') : ar ? 'استُنفد' : 'Used up'}</Badge> : <Toggle checked={c.active} onChange={() => toggle.mutate(c)} label="active" />;
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="p-2!" aria-label="edit" onClick={(e) => { e.stopPropagation(); setEditing(c); }}><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="p-2! hover:text-rose-600!" aria-label="delete" onClick={(e) => { e.stopPropagation(); setDeleting(c); }}><Trash2 className="size-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Tag}
        title={ar ? 'الكوبونات والعروض' : 'Coupons & promotions'}
        description={ar ? 'أنشئ أكواد خصم، حدّد حدود الاستخدام والصلاحية، وتابع كم خصماً مُنح فعلاً.' : 'Create promo codes, set limits and validity, and track the discount actually given.'}
        actions={<Button icon={Plus} onClick={() => setEditing('new')}>{ar ? 'كوبون جديد' : 'New coupon'}</Button>}
      />
      <Card padded={false}>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            columns={columns}
            rows={data?.items || []}
            loading={isLoading}
            onRowClick={(c) => setEditing(c)}
            empty={<EmptyState icon={Tag} title={ar ? 'لا توجد كوبونات بعد' : 'No coupons yet'} actionLabel={ar ? 'إنشاء أول كوبون' : 'Create your first coupon'} onAction={() => setEditing('new')} />}
          />
        )}
      </Card>

      {editing && <CouponForm coupon={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting)}
        loading={remove.isPending}
        danger
        title={ar ? 'حذف الكوبون' : 'Delete coupon'}
        description={deleting ? (ar ? `هل تريد حذف الكوبون ${deleting.code}؟ لا يمكن التراجع.` : `Delete ${deleting.code}? This cannot be undone.`) : ''}
        confirmLabel={ar ? 'حذف' : 'Delete'}
      />
    </div>
  );
}
