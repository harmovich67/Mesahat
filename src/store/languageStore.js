import { create } from 'zustand';

const read = () => {
  try { return localStorage.getItem('workora_lang') || 'ar'; } catch { return 'ar'; }
};

const apply = (lang) => {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  return dir;
};

const initialLang = read();
apply(initialLang);

export const useLanguageStore = create((set, get) => ({
  lang: initialLang,
  dir: initialLang === 'ar' ? 'rtl' : 'ltr',

  setLang: (lang) => {
    try { localStorage.setItem('workora_lang', lang); } catch { /* storage blocked */ }
    set({ lang, dir: apply(lang) });
  },

  toggleLang: () => get().setLang(get().lang === 'ar' ? 'en' : 'ar'),
  // Several components historically call this name — keep both.
  toggleLanguage: () => get().setLang(get().lang === 'ar' ? 'en' : 'ar'),

  /** Pick the current-language string out of { ar, en } (or pass strings through). */
  t: (obj) => {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    const current = get().lang;
    return obj[current] || obj.ar || obj.en || '';
  },
}));
