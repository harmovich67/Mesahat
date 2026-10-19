import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import {
  AlertCircle, BarChart3, Bell, Building2, CalendarRange, CheckCheck, ChevronsLeft, ChevronsRight, Compass, ExternalLink, FileClock, Globe,
  LayoutDashboard, LogOut, Menu, Search, Settings, ShieldCheck, Tag, TrendingUp, Users, X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn, getLocalized, timeAgo } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import { Avatar, useDebounced } from '../ui/Dash';
import { StatusBadge } from '../ui/StatusBadge';
import { Spinner } from '../ui/Feedback';

const NAV = [
  {
    group: { ar: 'العمليات', en: 'Operations' },
    items: [
      { href: '/admin', end: true, icon: LayoutDashboard, label: { ar: 'نظرة عامة', en: 'Overview' } },
      { href: '/admin/payments', icon: ShieldCheck, label: { ar: 'مراجعة المدفوعات', en: 'Payments' }, perm: 'payments.view', badge: 'pending' },
      { href: '/admin/bookings', icon: CalendarRange, label: { ar: 'الحجوزات والتقويم', en: 'Bookings' }, perm: 'bookings.view' },
      { href: '/admin/customers', icon: Users, label: { ar: 'العملاء', en: 'Customers' }, perm: 'customers.view' },
    ],
  },
  {
    group: { ar: 'الكتالوج', en: 'Catalog' },
    items: [
      { href: '/admin/spaces', icon: Building2, label: { ar: 'المساحات', en: 'Spaces' }, perm: 'spaces.view' },
      { href: '/admin/coupons', icon: Tag, label: { ar: 'الكوبونات', en: 'Coupons' }, perm: 'coupons.manage' },
    ],
  },
  {
    group: { ar: 'التحليلات', en: 'Insights' },
    items: [
      { href: '/admin/occupancy', icon: BarChart3, label: { ar: 'خريطة الإشغال', en: 'Occupancy' }, perm: 'reports.view' },
      { href: '/admin/reports', icon: TrendingUp, label: { ar: 'التقارير والإيرادات', en: 'Reports' }, perm: 'reports.view' },
    ],
  },
  {
    group: { ar: 'النظام', en: 'System' },
    items: [
      { href: '/admin/audit', icon: FileClock, label: { ar: 'سجل المراجعة', en: 'Audit log' }, perm: 'audit.view' },
      { href: '/admin/settings', icon: Settings, label: { ar: 'الإعدادات', en: 'Settings' }, perm: 'settings.manage' },
    ],
  },
];

function Brand({ collapsed }) {
  return (
    <Link to="/admin" className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-lg font-black text-white shadow-lg shadow-brand-950/40 ring-1 ring-white/20">
        W
      </span>
      {!collapsed && (
        <span className="leading-tight">
          <span className="flex items-center gap-1.5 text-base font-extrabold tracking-tight text-white">
            WORKORA
            <span className="rounded bg-accent-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-accent-300">ADMIN</span>
          </span>
        </span>
      )}
    </Link>
  );
}

function SidebarNav({ collapsed, onNavigate, pending }) {
  const { lang } = useLanguageStore();
  const can = useAuthStore((s) => s.can);
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV.map((section) => {
        const items = section.items.filter((i) => !i.perm || can(i.perm));
        if (!items.length) return null;
        return (
          <div key={section.group.en}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-brand-300/60">{section.group[lang]}</p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const badge = item.badge === 'pending' && pending > 0 ? pending : null;
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.end}
                    onClick={onNavigate}
                    title={collapsed ? item.label[lang] : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-white/10 text-white shadow-inner ring-1 ring-white/10'
                          : 'text-brand-100/70 hover:bg-white/5 hover:text-white',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute inset-y-2 start-0 w-1 rounded-full bg-accent-400" />}
                        <Icon className={cn('size-[18px] shrink-0', isActive ? 'text-accent-300' : 'text-brand-300/70 group-hover:text-brand-200')} />
                        {!collapsed && <span className="flex-1 truncate">{item.label[lang]}</span>}
                        {badge && (
                          <span
                            className={cn(
                              'num grid min-w-5 place-items-center rounded-full bg-accent-500 px-1.5 text-[10px] font-extrabold text-white shadow',
                              collapsed && 'absolute end-1.5 top-1',
                            )}
                          >
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/** Ctrl/Cmd+K global search over bookings, customers, spaces, payments. */
function AdminSearch({ open, onOpenChange }) {
  const { lang, dir } = useLanguageStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q.trim(), 300);
  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'search', debounced],
    queryFn: () => api.get('/admin/search', { q: debounced }),
    enabled: open && debounced.length >= 2,
  });

  const go = (to) => {
    onOpenChange(false);
    setQ('');
    navigate(to);
  };

  const groups = [
    { key: 'bookings', title: { ar: 'الحجوزات', en: 'Bookings' }, to: (r) => `/admin/bookings?open=${r.id}`, badge: (r) => r.status && <StatusBadge status={r.status} /> },
    { key: 'customers', title: { ar: 'العملاء', en: 'Customers' }, to: (r) => `/admin/customers?open=${r.id}` },
    { key: 'spaces', title: { ar: 'المساحات', en: 'Spaces' }, to: (r) => `/admin/spaces?q=${encodeURIComponent(r.label)}` },
    { key: 'payments', title: { ar: 'المدفوعات', en: 'Payments' }, to: () => '/admin/payments', badge: (r) => r.status && <StatusBadge type="payment" status={r.status} /> },
  ];
  const total = data ? groups.reduce((n, g) => n + (data[g.key]?.length || 0), 0) : 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-brand-950/50 backdrop-blur-sm" />
        <Dialog.Content
          dir={dir}
          className="fixed start-1/2 top-[12vh] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-glow outline-none animate-pop rtl:translate-x-1/2"
        >
          <Dialog.Title className="sr-only">{lang === 'ar' ? 'بحث' : 'Search'}</Dialog.Title>
          <Dialog.Description className="sr-only">{lang === 'ar' ? 'ابحث في الحجوزات والعملاء والمساحات' : 'Search bookings, customers and spaces'}</Dialog.Description>
          <div className="flex items-center gap-3 border-b border-sand-100 px-5">
            <Search className="size-5 text-stone-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={lang === 'ar' ? 'ابحث برقم الحجز، اسم العميل، المساحة…' : 'Search booking #, customer, space…'}
              className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
            />
            {isFetching && <Spinner className="size-4" />}
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {debounced.length < 2 ? (
              <p className="px-4 py-10 text-center text-sm text-stone-400">{lang === 'ar' ? 'اكتب حرفين على الأقل للبحث' : 'Type at least 2 characters'}</p>
            ) : data && total === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-stone-400">{lang === 'ar' ? 'لا توجد نتائج' : 'No results'}</p>
            ) : (
              groups.map((g) =>
                data?.[g.key]?.length ? (
                  <div key={g.key} className="mb-1">
                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-400">{g.title[lang]}</p>
                    {data[g.key].map((r) => (
                      <button
                        key={r.id}
                        onClick={() => go(g.to(r))}
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-brand-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">{r.label}</span>
                          {r.sub && <span className="block truncate text-xs text-stone-500">{r.sub}</span>}
                        </span>
                        {g.badge?.(r)}
                      </button>
                    ))}
                  </div>
                ) : null,
              )
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NotificationBell() {
  const { lang } = useLanguageStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications'),
    refetchInterval: 45_000,
  });
  const unread = data?.unread || 0;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const markAll = async () => {
    await api.post('/notifications/read-all');
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const openNote = async (n) => {
    setOpen(false);
    if (!n.read_at) {
      api.post(`/notifications/${n.id}/read`).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
    }
    if (n.link) navigate(n.link.replace(/^\/account/, '/dashboard'));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-10 place-items-center rounded-xl text-stone-600 transition-colors hover:bg-sand-100 hover:text-ink"
        aria-label={lang === 'ar' ? 'الإشعارات' : 'Notifications'}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="num absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-accent-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 top-12 z-50 w-80 animate-pop overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-glow">
          <div className="flex items-center justify-between border-b border-sand-100 px-4 py-3">
            <span className="text-sm font-bold text-ink">{lang === 'ar' ? 'الإشعارات' : 'Notifications'}</span>
            {unread > 0 && (
              <button onClick={markAll} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline">
                <CheckCheck className="size-3.5" />
                {lang === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {data?.items?.length ? (
              data.items.slice(0, 8).map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNote(n)}
                  className={cn('flex w-full gap-3 border-b border-sand-100 px-4 py-3 text-start last:border-0 hover:bg-sand-50', !n.read_at && 'bg-brand-50/50')}
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-sand-300' : 'bg-accent-500')} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-ink">{getLocalized(n.title, lang)}</span>
                    <span className="line-clamp-2 text-xs text-stone-500">{getLocalized(n.body, lang)}</span>
                    <span className="mt-1 block text-[10px] text-stone-400">{timeAgo(n.created_at, lang)}</span>
                  </span>
                </button>
              ))
            ) : (
              <p className="px-4 py-10 text-center text-sm text-stone-400">{lang === 'ar' ? 'لا توجد إشعارات' : 'Nothing yet'}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminLayout() {
  const { user, logout } = useAuthStore();
  const { lang, toggleLang } = useLanguageStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('workora_admin_collapsed') === '1'; } catch { return false; }
  });

  const { data: dash } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api.get('/admin/dashboard'),
    refetchInterval: 30_000,
  });
  const pending = dash?.pending_payments || 0;

  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    try { localStorage.setItem('workora_admin_collapsed', collapsed ? '1' : '0'); } catch { /* storage blocked */ }
  }, [collapsed]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = NAV.flatMap((s) => s.items).find((i) => (i.end ? location.pathname === i.href : location.pathname.startsWith(i.href)));
  const roleName = getLocalized(user?.roles?.[0]?.name, lang);

  const doLogout = async () => {
    await logout();
    navigate('/login');
  };

  const SidebarFooter = ({ compact }) => (
    <div className="space-y-2 border-t border-white/10 p-3">
      <div className={cn('flex items-center gap-2.5 rounded-xl bg-white/5 p-2', compact && 'justify-center')}>
        <Avatar name={user?.name} size="sm" className="ring-1 ring-white/20" />
        {!compact && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{user?.name}</p>
            <p className="truncate text-[10px] text-brand-300">{roleName}</p>
          </div>
        )}
        {!compact && (
          <button onClick={doLogout} className="rounded-lg p-1.5 text-brand-300 hover:bg-white/10 hover:text-rose-300" title={lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}>
            <LogOut className="size-4" />
          </button>
        )}
      </div>
      {!compact && (
        <div className="flex items-center justify-between px-1 text-[11px] text-brand-300/80">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-white">
            {lang === 'ar' ? 'الموقع العام' : 'Public site'} <ExternalLink className="size-3" />
          </Link>
          <button onClick={toggleLang} className="inline-flex items-center gap-1 hover:text-white">
            <Globe className="size-3" /> {lang === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-sand-50">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col bg-gradient-to-b from-brand-900 to-brand-950 transition-[width] duration-300 lg:flex',
          collapsed ? 'w-[76px]' : 'w-[272px]',
        )}
      >
        <div className={cn('flex items-center border-b border-white/10 p-4', collapsed ? 'justify-center' : 'justify-between')}>
          <Brand collapsed={collapsed} />
        </div>
        <SidebarNav collapsed={collapsed} pending={pending} />
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="mx-3 mb-2 hidden items-center justify-center gap-2 rounded-lg py-1.5 text-[11px] text-brand-300/70 hover:bg-white/5 hover:text-white lg:flex"
        >
          {collapsed ? (
            <>
              <ChevronsLeft className="size-4 ltr:hidden" />
              <ChevronsRight className="size-4 rtl:hidden" />
            </>
          ) : (
            <>
              <ChevronsRight className="size-4 ltr:hidden" />
              <ChevronsLeft className="size-4 rtl:hidden" />
              {lang === 'ar' ? 'تصغير' : 'Collapse'}
            </>
          )}
        </button>
        <SidebarFooter compact={collapsed} />
      </aside>

      {/* Mobile drawer */}
      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-brand-950/60 backdrop-blur-sm lg:hidden" />
          <Dialog.Content
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            className="fixed inset-y-0 start-0 z-50 flex w-[290px] max-w-[85vw] flex-col bg-gradient-to-b from-brand-900 to-brand-950 outline-none animate-fade-in lg:hidden"
          >
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <Dialog.Description className="sr-only">Admin navigation</Dialog.Description>
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <Brand />
              <Dialog.Close className="rounded-lg p-1.5 text-brand-200 hover:bg-white/10" aria-label="close">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <SidebarNav pending={pending} onNavigate={() => setDrawer(false)} />
            <SidebarFooter />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Main */}
      <div className="flex min-w-0 w-full flex-1 flex-col overflow-x-hidden">
        <header className="sticky top-0 z-30 flex h-14 sm:h-16 w-full items-center justify-between gap-2.5 sm:gap-3 border-b border-sand-200 bg-white/95 px-3.5 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <button onClick={() => setDrawer(true)} className="grid size-9 sm:size-10 place-items-center rounded-xl text-stone-600 hover:bg-sand-100 lg:hidden" aria-label="menu">
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{current?.label[lang] || (lang === 'ar' ? 'لوحة التحكم' : 'Dashboard')}</p>
              <p className="hidden truncate text-[11px] text-stone-500 sm:block">
                {new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Cairo' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden items-center gap-3 rounded-xl border border-sand-200 bg-white/80 px-3.5 py-2 text-xs text-stone-500 transition-all hover:border-brand-300 hover:text-ink md:flex"
            >
              <Search className="size-4" />
              <span className="w-40 text-start">{lang === 'ar' ? 'بحث سريع…' : 'Quick search…'}</span>
              <kbd className="whitespace-nowrap rounded border border-sand-200 bg-sand-50 px-1.5 font-mono text-[10px]">Ctrl K</kbd>
            </button>
            <button onClick={() => setSearchOpen(true)} className="grid size-9 sm:size-10 place-items-center rounded-xl text-stone-600 hover:bg-sand-100 md:hidden" aria-label="search">
              <Search className="size-[18px]" />
            </button>

            {pending > 0 && (
              <Link
                to="/admin/payments"
                className="hidden items-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-xs font-bold text-accent-700 transition-colors hover:bg-accent-100 sm:flex"
              >
                <AlertCircle className="size-4 animate-pulse" />
                <span className="num">{pending}</span>
                {lang === 'ar' ? 'بانتظار المراجعة' : 'to review'}
              </Link>
            )}
            <Link to="/spaces" className="hidden size-10 place-items-center rounded-xl text-stone-600 hover:bg-sand-100 sm:grid" title={lang === 'ar' ? 'تصفح المساحات' : 'Browse spaces'}>
              <Compass className="size-[18px]" />
            </Link>
            <NotificationBell />
          </div>
        </header>

        <main key={location.pathname} className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 animate-fade-in p-3.5 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <AdminSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
