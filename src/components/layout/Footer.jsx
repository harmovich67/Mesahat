import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, ShieldCheck, Smartphone, Landmark } from 'lucide-react';
import { getLocalized } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { useLocations, usePublicSettings } from '../../lib/hooks';
import { Brand } from './Navbar';

export function Footer() {
  const lang = useLanguageStore((s) => s.lang);
  const ar = lang === 'ar';
  const settings = usePublicSettings().data?.settings?.general;
  const locations = useLocations().data?.items || [];

  const cols = [
    {
      title: ar ? 'استكشف' : 'Explore',
      links: [
        { to: '/spaces', label: ar ? 'كل المساحات' : 'All spaces' },
        { to: '/spaces?type=meeting_room', label: ar ? 'قاعات الاجتماعات' : 'Meeting rooms' },
        { to: '/spaces?type=private_office', label: ar ? 'المكاتب الخاصة' : 'Private offices' },
        { to: '/spaces?type=event_space', label: ar ? 'مساحات الفعاليات' : 'Event spaces' },
        { to: '/pricing', label: ar ? 'الأسعار' : 'Pricing' },
      ],
    },
    {
      title: ar ? 'ووركورا' : 'WORKORA',
      links: [
        { to: '/about', label: ar ? 'من نحن' : 'About us' },
        { to: '/locations', label: ar ? 'فروعنا' : 'Locations' },
        { to: '/contact', label: ar ? 'تواصل معنا' : 'Contact' },
        { to: '/dashboard', label: ar ? 'حسابي' : 'My account' },
      ],
    },
  ];

  return (
    <footer className="relative mt-auto overflow-hidden bg-brand-950 text-brand-100">
      <div className="pointer-events-none absolute -top-24 start-1/4 size-80 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 end-1/4 size-80 rounded-full bg-accent-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="space-y-5">
            <Brand light />
            <p className="max-w-xs text-sm leading-relaxed text-brand-200/80">
              {ar ? 'مساحات عمل مشتركة وقاعات اجتماعات ومكاتب خاصة في مصر. احجز بالساعة أو اليوم وادفع محلياً بسهولة.' : 'Coworking, meeting rooms and private offices in Egypt. Book by the hour or day and pay locally with ease.'}
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Smartphone className="size-3.5 text-red-300" />{ar ? 'فودافون كاش' : 'Vodafone Cash'}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Landmark className="size-3.5 text-violet-300" />{ar ? 'إنستاباي' : 'InstaPay'}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><ShieldCheck className="size-3.5 text-emerald-300" />{ar ? 'مراجعة آمنة' : 'Verified'}</span>
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="mb-4 text-sm font-bold text-white">{c.title}</h4>
              <ul className="space-y-2.5 text-sm">
                {c.links.map((l) => (
                  <li key={l.to}><Link to={l.to} className="text-brand-200/80 transition-colors hover:text-white">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="mb-4 text-sm font-bold text-white">{ar ? 'تواصل' : 'Get in touch'}</h4>
            <ul className="space-y-3 text-sm text-brand-200/80">
              {settings?.address && <li className="flex items-start gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-accent-300" />{getLocalized(settings.address, lang)}</li>}
              {settings?.phone && <li className="flex items-center gap-2.5"><Phone className="size-4 shrink-0 text-accent-300" /><a href={`tel:${settings.phone}`} dir="ltr" className="hover:text-white">{settings.phone}</a></li>}
              {settings?.email && <li className="flex items-center gap-2.5"><Mail className="size-4 shrink-0 text-accent-300" /><a href={`mailto:${settings.email}`} dir="ltr" className="hover:text-white">{settings.email}</a></li>}
            </ul>
            {locations.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {locations.map((l) => (
                  <Link key={l.id} to={`/spaces?location=${l.slug}`} className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-brand-100 transition-colors hover:bg-white/10">{getLocalized(l.city, lang)}</Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-brand-300/70 sm:flex-row">
          <p>© {new Date().getFullYear()} WORKORA. {ar ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}</p>
          <p>{ar ? 'صُنع بحب في مصر 🇪🇬' : 'Made with care in Egypt 🇪🇬'}</p>
        </div>
      </div>
    </footer>
  );
}
