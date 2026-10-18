import { useEffect, useRef, useState } from 'react';
import { FileText, ImagePlus, Trash2, UploadCloud } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function ReceiptUploader({ file, onChange, maxMb = 8 }) {
  const ar = useLanguageStore((s) => s.lang) === 'ar';
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (file?.type?.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
    return undefined;
  }, [file]);

  const accept = (f) => {
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError(ar ? 'الصيغ المسموحة: JPG, PNG, WEBP, PDF' : 'Allowed: JPG, PNG, WEBP, PDF');
    if (f.size > maxMb * 1024 * 1024) return setError(ar ? `الحد الأقصى ${maxMb} ميجابايت` : `Max ${maxMb}MB`);
    setError(null);
    onChange(f);
  };

  if (file) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
          {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <FileText className="size-8 text-stone-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink" dir="ltr">{file.name}</p>
          <p className="num text-xs text-stone-500">{(file.size / 1024).toFixed(0)} KB</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="rounded-lg p-2 text-stone-400 hover:bg-white hover:text-rose-600" aria-label="remove">
          <Trash2 className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files?.[0]); }}
        className={cn('flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all', drag ? 'border-brand-500 bg-brand-50' : 'border-sand-300 bg-sand-50/50 hover:border-brand-400 hover:bg-brand-50/40', error && 'border-rose-300')}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-600 shadow-soft">{drag ? <ImagePlus className="size-6" /> : <UploadCloud className="size-6" />}</span>
        <span className="text-sm font-bold text-ink">{ar ? 'اسحب صورة الإيصال هنا أو اضغط للاختيار' : 'Drop your receipt here or click to browse'}</span>
        <span className="text-xs text-stone-500">JPG · PNG · WEBP · PDF — {ar ? `حتى ${maxMb} ميجابايت` : `up to ${maxMb}MB`}</span>
      </button>
      <input ref={inputRef} type="file" accept={TYPES.join(',')} hidden onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ''; }} />
      {error && <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
