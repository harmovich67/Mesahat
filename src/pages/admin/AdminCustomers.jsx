import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building, Mail, Phone, Star, UserCheck, UserX, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate, formatEGP, getLocalized, ltr } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Avatar, Card, DataTable, PageHeader, Pagination, SearchInput, useDebounced } from '../../components/ui/Dash';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { Drawer } from '../../components/ui/Modal';

const LIMIT = 15;

function CustomerDrawer({ id, onClose, onBooking }) {
  const { lang } = useLanguageStore();
  const can = useAuthStore((s) => s.can);
  const qc = useQueryClient();
  const ar = lang === 'ar';
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'customer', id],
    queryFn: () => api.get(`/admin/customers/${id}`),
    enabled: Boolean(id),
  });
  const c = data?.customer;

  const toggle = useMutation({
    mutationFn: (status) => api.post(`/admin/customers/${id}/status`, { status }),
    onSuccess: (_, status) => {
      toast.success(status === 'suspended' ? (ar ? 'تم إيقاف الحساب' : 'Account suspended') : ar ? 'تم تفعيل الحساب' : 'Account activated');
      qc.invalidateQueries({ queryKey: ['admin', 'customer', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Drawer isOpen={Boolean(id)} onClose={onClose} title={c?.name || (ar ? 'العميل' : 'Customer')} description={c?.company}>
      {isLoading ? (
        <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : c ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar name={c.name} size="lg" />
            <div className="min-w-0 space-y-1 text-sm text-stone-600">
              <Badge variant={c.status === 'active' ? 'success' : 'danger'} dot>{c.status === 'active' ? (ar ? 'نشط' : 'Active') : ar ? 'موقوف' : 'Suspended'}</Badge>
              <p {...ltr} className="flex items-center gap-1.5"><Mail className="size-3.5" />{c.email}</p>
              {c.phone && <p {...ltr} className="flex items-center gap-1.5"><Phone className="size-3.5" />{c.phone}</p>}
              {c.company && <p className="flex items-center gap-1.5"><Building className="size-3.5" />{c.company}</p>}
              <p className="text-xs text-stone-400">{ar ? 'انضم' : 'Joined'} {formatDate(c.created_at, lang)}</p>
            </div>
          </div>

          {can('users.manage') && (
            <Button
              variant={c.status === 'active' ? 'dangerOutline' : 'success'}
              size="sm"
              icon={c.status === 'active' ? UserX : UserCheck}
              loading={toggle.isPending}
              onClick={() => toggle.mutate(c.status === 'active' ? 'suspended' : 'active')}
            >
              {c.status === 'active' ? (ar ? 'إيقاف الحساب' : 'Suspend account') : ar ? 'إعادة التفعيل' : 'Reactivate'}
            </Button>
          )}

          <section>
            <h4 className="mb-3 text-sm font-bold text-ink">{ar ? 'الحجوزات' : 'Bookings'} <span className="num text-stone-400">({data.bookings.length})</span></h4>
            {data.bookings.length ? (
              <ul className="space-y-2">
                {data.bookings.map((b) => (
                  <li key={b.id}>
                    <button onClick={() => onBooking(b.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-sand-200 p-3 text-start transition-colors hover:border-brand-300 hover:bg-brand-50/40">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{getLocalized(b.space?.name, lang)}</p>
                        <p className="num text-xs text-stone-500">{b.booking_number} · {formatDate(b.start_at, lang)}</p>
                      </div>
                      <div className="shrink-0 text-end">
                        <p className="num text-sm font-extrabold text-brand-700">{formatEGP(b.final_amount, lang)}</p>
                        <StatusBadge status={b.status} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-400">{ar ? 'لا توجد حجوزات.' : 'No bookings.'}</p>
            )}
          </section>

          {data.reviews.length > 0 && (
            <section>
              <h4 className="mb-3 text-sm font-bold text-ink">{ar ? 'التقييمات' : 'Reviews'}</h4>
              <ul className="space-y-2">
                {data.reviews.map((r) => (
                  <li key={r.id} className="rounded-xl bg-sand-50 p-3 text-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold text-stone-500">{getLocalized(r.space?.name, lang)}</span>
                      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-accent-600"><Star className="size-3.5 fill-current" />{r.rating}</span>
                    </div>
                    {r.comment && <p className="text-stone-700">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}

export function AdminCustomers() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const openId = params.get('open');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'customers', page, q],
    queryFn: () => api.get('/admin/customers', { page, limit: LIMIT, q }),
    placeholderData: (prev) => prev,
  });
  useEffect(() => setPage(1), [q]);

  const setOpen = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('open', id);
    else next.delete('open');
    setParams(next, { replace: true });
  };

  const columns = [
    {
      key: 'name',
      header: ar ? 'العميل' : 'Customer',
      render: (c) => (
        <div className="flex min-w-[180px] items-center gap-3">
          <Avatar name={c.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">{c.name}</p>
            <p className="truncate text-[11px] text-stone-400" {...ltr}>{c.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: ar ? 'الهاتف' : 'Phone', render: (c) => <span {...ltr} className="text-stone-600">{c.phone || '—'}</span> },
    { key: 'company', header: ar ? 'الشركة' : 'Company', render: (c) => <span className="text-stone-600">{c.company || '—'}</span> },
    { key: 'bookings_count', header: ar ? 'الحجوزات' : 'Bookings', render: (c) => <span className="num font-bold">{c.bookings_count}</span> },
    { key: 'total_spend', header: ar ? 'إجمالي الإنفاق' : 'Total spend', render: (c) => <span className="num whitespace-nowrap font-extrabold text-brand-700">{formatEGP(c.total_spend, lang)}</span> },
    { key: 'last', header: ar ? 'آخر حجز' : 'Last booking', render: (c) => <span className="whitespace-nowrap text-xs text-stone-500">{c.last_booking_at ? formatDate(c.last_booking_at, lang) : '—'}</span> },
    { key: 'status', header: ar ? 'الحالة' : 'Status', render: (c) => <Badge variant={c.status === 'active' ? 'success' : 'danger'} dot>{c.status === 'active' ? (ar ? 'نشط' : 'Active') : ar ? 'موقوف' : 'Suspended'}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title={ar ? 'العملاء' : 'Customers'}
        description={ar ? 'قاعدة عملاء ووركورا مع سجل الحجوزات والإنفاق.' : 'Your customer base with booking history and lifetime spend.'}
        actions={<SearchInput className="w-full sm:w-72" value={search} onChange={setSearch} placeholder={ar ? 'الاسم، البريد، الهاتف…' : 'Name, email, phone…'} />}
      />
      <Card padded={false}>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data?.items || []}
              loading={isLoading}
              onRowClick={(c) => setOpen(c.id)}
              empty={<EmptyState icon={Users} title={ar ? 'لا يوجد عملاء مطابقون' : 'No customers found'} />}
            />
            <Pagination page={page} total={data?.total || 0} limit={LIMIT} onChange={setPage} />
          </>
        )}
      </Card>
      <CustomerDrawer
        id={openId}
        onClose={() => setOpen(null)}
        onBooking={(bid) => navigate(`/admin/bookings?open=${bid}`)}
      />
    </div>
  );
}
