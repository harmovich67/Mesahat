import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarRange, Compass, LayoutDashboard, LogOut, User } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import { Avatar } from '../ui/Dash';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function CustomerLayout() {
  const { user, logout } = useAuthStore();
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const navigate = useNavigate();

  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/notifications'), refetchInterval: 45_000 });
  const unread = data?.unread || 0;

  const items = [
    { href: '/dashboard', end: true, icon: LayoutDashboard, label: ar ? 'نظرة عامة' : 'Overview' },
    { href: '/dashboard/bookings', icon: CalendarRange, label: ar ? 'حجوزاتي' : 'Bookings' },
    { href: '/dashboard/notifications', icon: Bell, label: ar ? 'الإشعارات' : 'Notifications', badge: unread },
    { href: '/dashboard/profile', icon: User, label: ar ? 'ملفي' : 'Profile' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-mesh">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-12">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:gap-8">
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="surface p-5 text-center">
                <Avatar name={user?.name} size="lg" className="mx-auto shadow-lift" />
                <h3 className="mt-3 truncate font-bold text-ink">{user?.name}</h3>
                <p className="truncate text-xs text-stone-500" dir="ltr">{user?.email}</p>
                {user?.company && <p className="mt-1 truncate text-xs font-semibold text-brand-700">{user.company}</p>}
              </div>
              <nav className="surface space-y-1 p-2" aria-label="account">
                {items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <NavLink
                      key={it.href}
                      to={it.href}
                      end={it.end}
                      className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all', isActive ? 'bg-brand-700 text-white shadow-soft' : 'text-stone-600 hover:bg-sand-100 hover:text-ink')}
                    >
                      <Icon className="size-[18px]" />
                      <span className="flex-1">{it.label}</span>
                      {it.badge > 0 && <span className="num grid min-w-5 place-items-center rounded-full bg-accent-500 px-1.5 text-[10px] font-extrabold text-white">{it.badge}</span>}
                    </NavLink>
                  );
                })}
                <button
                  onClick={async () => { await logout(); navigate('/'); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-start text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <LogOut className="size-[18px]" />
                  {ar ? 'تسجيل الخروج' : 'Sign out'}
                </button>
              </nav>
              <NavLink to="/spaces" className="flex items-center justify-center gap-2 rounded-2xl bg-brand-gradient px-4 py-3.5 text-sm font-bold text-white shadow-lift transition-transform hover:-translate-y-0.5">
                <Compass className="size-4" />
                {ar ? 'احجز مساحة جديدة' : 'Book a new space'}
              </NavLink>
            </div>
          </aside>

          <div className="min-w-0 animate-fade-in">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="glass-panel fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-sand-200 px-2 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="account">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <NavLink key={it.href} to={it.href} end={it.end} className={({ isActive }) => cn('relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition-colors', isActive ? 'text-brand-700' : 'text-stone-500')}>
              <Icon className="size-5" />
              {it.label}
              {it.badge > 0 && <span className="num absolute end-1/4 top-1.5 grid size-4 place-items-center rounded-full bg-accent-500 text-[9px] font-extrabold text-white">{it.badge}</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className="hidden lg:block"><Footer /></div>
    </div>
  );
}
