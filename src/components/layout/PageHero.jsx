/** Page header band used by the marketing pages. */
export function PageHero({ eyebrow, title, description, children }) {
  return (
    <header className="bg-mesh relative -mt-[72px] overflow-hidden border-b border-sand-200 pt-[72px]">
      <div className="bg-grid-subtle pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:px-8">
        {eyebrow && <span className="mb-3 inline-block text-xs font-bold uppercase tracking-widest text-accent-600">{eyebrow}</span>}
        <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-ink sm:text-5xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-stone-600">{description}</p>}
        {children}
      </div>
    </header>
  );
}
