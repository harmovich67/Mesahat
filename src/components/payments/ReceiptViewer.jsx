import { useEffect, useState } from 'react';
import { ExternalLink, FileText, ImageOff, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';

// One download per receipt version: thumbnails, the review modal and re-renders all share it
// (every server fetch of a receipt by staff is written to the audit log).
const cache = new Map();
function loadReceipt(key, endpoint) {
  if (!cache.has(key)) cache.set(key, api.blob(endpoint).catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key);
}

/**
 * Receipts are private (never statically served) so the browser can't fetch them with a plain <img src>.
 * We download them with the bearer token and show them through an object URL.
 */
export function ReceiptViewer({ paymentId, version = '', admin = false, className, imgClassName, compact = false }) {
  const lang = useLanguageStore((s) => s.lang);
  const [state, setState] = useState({ status: 'loading', url: null, isPdf: false });

  useEffect(() => {
    if (!paymentId) return undefined;
    let revoked = false;
    let objectUrl = null;
    setState({ status: 'loading', url: null, isPdf: false });
    loadReceipt(`${admin}:${paymentId}:${version}`, `${admin ? '/admin' : ''}/payments/${paymentId}/receipt`)
      .then(({ blob, type }) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ status: 'ready', url: objectUrl, isPdf: type.includes('pdf') });
      })
      .catch(() => !revoked && setState({ status: 'error', url: null, isPdf: false }));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [paymentId, admin, version]);

  if (state.status === 'loading') {
    return (
      <div className={cn('grid place-items-center text-stone-400', compact ? 'size-full' : 'h-64', className)}>
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-2 text-stone-400', compact ? 'size-full' : 'h-64', className)}>
        <ImageOff className={compact ? 'size-5' : 'size-8'} />
        {!compact && <span className="text-xs">{lang === 'ar' ? 'تعذر تحميل الإيصال' : 'Receipt unavailable'}</span>}
      </div>
    );
  }
  if (state.isPdf) {
    return (
      <a
        href={state.url}
        target="_blank"
        rel="noreferrer"
        className={cn('flex flex-col items-center justify-center gap-2 text-brand-700 hover:underline', compact ? 'size-full' : 'h-64', className)}
      >
        <FileText className={compact ? 'size-5' : 'size-10'} />
        {!compact && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            {lang === 'ar' ? 'فتح ملف PDF' : 'Open PDF'} <ExternalLink className="size-3" />
          </span>
        )}
      </a>
    );
  }
  return compact ? (
    <img src={state.url} alt="receipt" className={cn('size-full object-cover', imgClassName)} />
  ) : (
    <a href={state.url} target="_blank" rel="noreferrer" className={cn('block', className)} title={lang === 'ar' ? 'فتح بالحجم الكامل' : 'Open full size'}>
      <img src={state.url} alt="receipt" className={cn('mx-auto max-h-[420px] w-auto rounded-xl border border-sand-200 bg-white object-contain shadow-soft', imgClassName)} />
    </a>
  );
}
