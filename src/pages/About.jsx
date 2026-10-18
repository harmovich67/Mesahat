import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Compass, HeartHandshake, MapPinned, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { useLanguageStore } from '../store/languageStore';
import { useLocations } from '../lib/hooks';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { PageHero } from '../components/layout/PageHero';
import { Button } from '../components/ui/Button';

export function About() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const locations = useLocations().data?.items || [];
  const spaceCount = locations.reduce((n, l) => n + l.space_count, 0);

  const values = [
    { icon: Wallet, title: ar ? 'ادفع بطريقتك المحلية' : 'Pay the local way', text: ar ? 'فودافون كاش وإنستاباي — بدون بطاقات ولا تعقيد. ارفع الإيصال ونؤكد حجزك.' : 'Vodafone Cash and InstaPay — no cards, no friction. Upload the receipt and we confirm.' },
    { icon: Compass, title: ar ? 'عاين قبل أن تحجز' : 'See before you book', text: ar ? 'جولات ثلاثية الأبعاد داخل المساحات لتتأكد أنها مناسبة تماماً.' : '3D walkthroughs so you know the space fits.' },
    { icon: ShieldCheck, title: ar ? 'مراجعة بشرية موثوقة' : 'Human-verified payments', text: ar ? 'كل تحويل يراجعه فريقنا قبل التأكيد، وسجل كامل لكل قرار.' : 'Every transfer is checked by our team, with a full audit trail.' },
    { icon: HeartHandshake, title: ar ? 'مرونة حقيقية' : 'Real flexibility', text: ar ? 'احجز بالساعة أو اليوم، وألغِ وفق سياسة واضحة ومعلنة.' : 'Book by the hour or day, cancel under a clear published policy.' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <Navbar />
      <PageHero eyebrow={ar ? 'من نحن' : 'About us'} title={ar ? 'نبني مساحات تُنجَز فيها الأعمال' : 'We build spaces where work gets done'} description={ar ? 'ووركورا منصة مصرية لحجز مساحات العمل المشتركة وقاعات الاجتماعات والمكاتب الخاصة — بتجربة حجز ودفع تناسب السوق المحلي.' : 'WORKORA is an Egyptian platform for coworking, meeting rooms and private offices — with a booking and payment experience built for the local market.'} />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-20 px-4 py-16 sm:px-6 lg:px-8">
        <section className="grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-5">
            <h2 className="text-3xl font-extrabold tracking-tight text-ink">{ar ? 'لماذا ووركورا؟' : 'Why WORKORA?'}</h2>
            <p className="leading-relaxed text-stone-600">{ar ? 'وجدنا أن حجز قاعة اجتماعات في مصر يعني مكالمات ورسائل وانتظاراً. فبنينا منصة تعرض لك المتاح لحظياً، وتحسب السعر النهائي فوراً، وتؤكد الحجز خلال دقائق من رفع الإيصال.' : 'Booking a meeting room in Egypt used to mean calls, messages and waiting. We built a platform that shows live availability, prices instantly, and confirms within minutes of your receipt.'}</p>
            <div className="grid grid-cols-3 gap-4 pt-2">
              {[{ v: locations.length || '—', l: ar ? 'فروع' : 'branches' }, { v: spaceCount || '—', l: ar ? 'مساحة' : 'spaces' }, { v: '24/7', l: ar ? 'حجز أونلاين' : 'online booking' }].map((s) => (
                <div key={s.l} className="surface p-4 text-center"><p className="num text-2xl font-black text-brand-700">{s.v}</p><p className="text-xs text-stone-500">{s.l}</p></div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-200/50 to-accent-200/50 blur-2xl" />
            <div className="grid grid-cols-2 gap-3">
              <img src="/images/coworking.jpg" alt="" className="aspect-[4/5] w-full rounded-3xl object-cover shadow-lift" loading="lazy" />
              <img src="/images/meeting-room.jpg" alt="" className="mt-8 aspect-[4/5] w-full rounded-3xl object-cover shadow-lift" loading="lazy" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-8 text-3xl font-extrabold tracking-tight text-ink">{ar ? 'ما نؤمن به' : 'What we believe'}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => {
              const Icon = v.icon;
              return (
                <div key={v.title} style={{ '--i': i }} className="surface surface-hover stagger p-6">
                  <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-gradient text-white shadow-soft"><Icon className="size-5" /></span>
                  <h3 className="mb-1.5 font-bold text-ink">{v.title}</h3>
                  <p className="text-sm leading-relaxed text-stone-600">{v.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-brand-gradient relative overflow-hidden rounded-[2.5rem] p-10 text-white shadow-glow sm:p-14">
          <MapPinned className="absolute -bottom-6 -end-6 size-48 text-white/5" />
          <Sparkles className="absolute -start-4 -top-4 size-32 text-white/5" />
          <div className="relative max-w-xl">
            <h2 className="text-3xl font-extrabold">{ar ? 'جرّب مساحتك التالية' : 'Try your next space'}</h2>
            <p className="mt-3 text-brand-100">{ar ? 'تصفح المساحات وعاينها بجولة 3D ثم احجز في دقيقة.' : 'Browse, tour in 3D, and book in a minute.'}</p>
            <Link to="/spaces" className="mt-6 inline-block"><Button variant="accent" size="lg" iconEnd={Arrow}>{ar ? 'تصفح المساحات' : 'Browse spaces'}</Button></Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
