import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { CalendarRange, Globe, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Dash';

const CommandPalette = lazy(() => import('./CommandPalette').then((m) => ({ default: m.CommandPalette })));
const SpaceMatchModal = lazy(() => import('../spaces/SpaceMatchModal').then((m) => ({ default: m.SpaceMatchModal })));

export function Brand({ light = false }) {
  const lang = useLanguageStore((s) => s.lang);
  return (
    <Link to="/" className="group flex items-center gap-1.5 sm:gap-2.5 shrink-0">
      <span className="grid size-8 sm:size-10 place-items-center rounded-xl bg-brand-gradient text-base sm:text-xl font-black text-white shadow-md sm:shadow-lg shadow-brand-700/25 transition-transform group-hover:scale-105 group-hover:-rotate-3">W</span>
      <span className="leading-tight">
        <span className={cn('block text-sm sm:text-lg font-extrabold tracking-tight', light ? 'text-white' : 'text-ink')}>WORKORA</span>
        <span className={cn('hidden whitespace-nowrap text-[11px] font-medium xl:block', light ? 'text-brand-200' : 'text-stone-500')}>{lang === 'ar' ? 'مساحتك للعمل. بطريقتك.' : 'Your space. Your way.'}</span>
      </span>
    </Link>
  );
}

export function Navbar() {
  const { user, isAuthenticated, logout, isStaff } = useAuthStore();
  const { lang, toggleLang } = useLanguageStore();
  const ar = lang === 'ar';
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    setMenu(false);
    setUserMenu(false);
  }, [location.pathname]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    const onDown = (e) => userRef.current && !userRef.current.contains(e.target) && setUserMenu(false);
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  const links = [
    { label: ar ? 'المساحات' : 'Spaces', href: '/spaces' },
    { label: ar ? 'الفروع' : 'Locations', href: '/locations' },
    { label: ar ? 'الأسعار' : 'Pricing', href: '/pricing' },
    { label: ar ? 'من نحن' : 'About', href: '/about' },
    { label: ar ? 'تواصل' : 'Contact', href: '/contact' },
  ];

  const doLogout = async () => {
    setUserMenu(false);
    await logout();
    navigate('/');
  };

  return (
    <>
      <header className={cn('sticky top-0 z-40 w-full transition-all duration-300', scrolled ? 'glass-panel border-b border-sand-200/80 py-2 sm:py-2.5 shadow-soft' : 'border-b border-transparent bg-transparent py-2 sm:py-4')}>
        <div className="mx-auto flex max-w-7xl w-full items-center justify-between gap-1.5 sm:gap-4 px-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 lg:gap-8 min-w-0 shrink-0">
            <Brand />
            <nav className="hidden items-center gap-1 lg:flex" aria-label="main">
              {links.map((l) => (
                <NavLink
                  key={l.href}
                  to={l.href}
                  className={({ isActive }) => cn('whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors', isActive ? 'bg-brand-50 text-brand-700' : 'text-stone-600 hover:bg-sand-100 hover:text-ink')}
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button onClick={() => setSearchOpen(true)} className="hidden items-center gap-2.5 whitespace-nowrap rounded-xl border border-sand-200 bg-white/80 px-3.5 py-2 text-xs text-stone-500 transition-all hover:border-brand-300 hover:text-ink 2xl:flex" aria-label="search">
              <Search className="size-4" />
              <span className="w-32 text-start">{ar ? 'ابحث عن مساحة…' : 'Search spaces…'}</span>
              <kbd className="whitespace-nowrap rounded border border-sand-200 bg-sand-50 px-1.5 font-mono text-[10px]">Ctrl K</kbd>
            </button>
            <button onClick={() => setSearchOpen(true)} className="grid size-8 sm:size-10 place-items-center rounded-xl text-stone-600 hover:bg-sand-100 2xl:hidden" aria-label="search"><Search className="size-4 sm:size-[18px]" /></button>

            <button onClick={() => setMatchOpen(true)} className="hidden items-center gap-1.5 whitespace-nowrap rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-xs font-bold text-accent-700 transition-colors hover:bg-accent-100 md:flex">
              <Sparkles className="size-3.5" />
              {ar ? 'ساعدني أختار' : 'Match me'}
            </button>

            <button onClick={toggleLang} className="inline-flex items-center gap-1 rounded-xl px-2 sm:px-2.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-stone-600 transition-colors hover:bg-sand-100" title={ar ? 'Switch to English' : 'التحويل للعربية'}>
              <Globe className="size-3.5 sm:size-4" />
              {ar ? 'EN' : 'ع'}
            </button>

            {isAuthenticated ? (
              <div className="relative" ref={userRef}>
                <button onClick={() => setUserMenu((v) => !v)} className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-sand-200 bg-white p-0.5 sm:p-1 sm:pe-3 transition-colors hover:border-brand-300" aria-expanded={userMenu} aria-haspopup="menu">
                  <Avatar name={user?.name} size="sm" className="size-7 sm:size-8 text-[11px] sm:text-xs rounded-lg sm:rounded-xl" />
                  <span className="hidden max-w-[110px] truncate text-xs font-bold text-ink sm:block">{user?.name?.split(' ')[0]}</span>
                </button>
                {userMenu && (
                  <div role="menu" className="absolute end-0 top-12 z-50 w-64 animate-pop overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-glow">
                    <div className="border-b border-sand-100 px-4 py-3">
                      <p className="truncate text-sm font-bold text-ink">{user?.name}</p>
                      <p className="truncate text-xs text-stone-500" dir="ltr">{user?.email}</p>
                    </div>
                    <div className="p-1.5">
                      {isStaff && (
                        <Link role="menuitem" to="/admin" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-brand-50"><ShieldCheck className="size-4 text-brand-600" />{ar ? 'لوحة الإدارة' : 'Admin dashboard'}</Link>
                      )}
                      <Link role="menuitem" to="/dashboard" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-brand-50"><LayoutDashboard className="size-4 text-brand-600" />{ar ? 'حسابي' : 'My account'}</Link>
                      <Link role="menuitem" to="/dashboard/bookings" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-brand-50"><CalendarRange className="size-4 text-brand-600" />{ar ? 'حجوزاتي' : 'My bookings'}</Link>
                      <button role="menuitem" onClick={doLogout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-semibold text-rose-600 hover:bg-rose-50"><LogOut className="size-4" />{ar ? 'تسجيل الخروج' : 'Sign out'}</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-1.5 sm:flex">
                <Link to="/login"><Button variant="ghost" size="sm">{ar ? 'دخول' : 'Sign in'}</Button></Link>
                <Link to="/register"><Button size="sm">{ar ? 'ابدأ الآن' : 'Get started'}</Button></Link>
              </div>
            )}

            <button onClick={() => setMenu(true)} className="grid size-8 sm:size-10 place-items-center rounded-xl text-stone-600 hover:bg-sand-100 lg:hidden" aria-label="menu"><Menu className="size-[18px] sm:size-5" /></button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <Dialog.Root open={menu} onOpenChange={setMenu}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-brand-950/50 backdrop-blur-sm lg:hidden" />
          <Dialog.Content dir={ar ? 'rtl' : 'ltr'} className="fixed inset-y-0 end-0 z-50 flex w-[300px] max-w-[88vw] flex-col bg-white shadow-glow outline-none animate-fade-in lg:hidden">
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
            <div className="flex items-center justify-between border-b border-sand-100 p-4">
              <Brand />
              <Dialog.Close className="rounded-lg p-2 text-stone-500 hover:bg-sand-100" aria-label="close"><X className="size-5" /></Dialog.Close>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {links.map((l) => (
                <NavLink key={l.href} to={l.href} className={({ isActive }) => cn('block rounded-xl px-4 py-3 text-base font-semibold', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink hover:bg-sand-50')}>{l.label}</NavLink>
              ))}
              <button onClick={() => { setMenu(false); setMatchOpen(true); }} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-accent-50 px-4 py-3 text-base font-bold text-accent-700"><Sparkles className="size-4" />{ar ? 'ساعدني أختار المساحة' : 'Match me with a space'}</button>
            </nav>
            {isAuthenticated ? (
              <div className="border-t border-sand-100 p-4 space-y-2">
                <div className="flex items-center gap-3 px-2 py-1">
                  <Avatar name={user?.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{user?.name}</p>
                    <p className="truncate text-xs text-stone-500" dir="ltr">{user?.email}</p>
                  </div>
                </div>
                <div className="pt-2 space-y-1">
                  {isStaff && (
                    <Link to="/admin" onClick={() => setMenu(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-ink hover:bg-brand-50">
                      <ShieldCheck className="size-4 text-brand-600" />{ar ? 'لوحة الإدارة' : 'Admin dashboard'}
                    </Link>
                  )}
                  <Link to="/dashboard" onClick={() => setMenu(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-ink hover:bg-brand-50">
                    <LayoutDashboard className="size-4 text-brand-600" />{ar ? 'حسابي' : 'My account'}
                  </Link>
                  <button onClick={() => { setMenu(false); doLogout(); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-sm font-semibold text-rose-600 hover:bg-rose-50">
                    <LogOut className="size-4" />{ar ? 'تسجيل الخروج' : 'Sign out'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 border-t border-sand-100 p-4">
                <Link to="/login"><Button variant="outline" className="w-full">{ar ? 'دخول' : 'Sign in'}</Button></Link>
                <Link to="/register"><Button className="w-full">{ar ? 'حساب جديد' : 'Register'}</Button></Link>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Suspense fallback={null}>
        {searchOpen && <CommandPalette isOpen onClose={() => setSearchOpen(false)} />}
        {matchOpen && <SpaceMatchModal isOpen onClose={() => setMatchOpen(false)} />}
      </Suspense>
    </>
  );
}
