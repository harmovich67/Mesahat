import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Minus, Search, X } from 'lucide-react';
import { cn, initials } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { Button } from './Button';
import { Modal } from './Modal';
import { Skeleton } from './Feedback';

export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function PageHeader({ title, description, icon: Icon, actions, className }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="flex min-w-0 items-start gap-3 sm:gap-3.5">
        {Icon && (
          <span className="mt-0.5 hidden size-11 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white shadow-soft sm:grid">
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-[1.7rem] font-extrabold tracking-tight text-ink leading-tight">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-xs sm:text-sm leading-relaxed text-stone-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex w-full sm:w-auto shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, padded = true, ...props }) {
  return (
    <div className={cn('surface min-w-0 max-w-full overflow-hidden', padded && 'p-3.5 sm:p-6', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={cn('mb-3.5 sm:mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <h3 className="text-sm sm:text-base font-bold text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-stone-500">{description}</p>}
      </div>
      {action && <div className="shrink-0 w-full sm:w-auto">{action}</div>}
    </div>
  );
}

const STAT_TONES = {
  brand: 'bg-brand-50 text-brand-700',
  accent: 'bg-accent-50 text-accent-600',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
  violet: 'bg-violet-50 text-violet-700',
};

/** delta: percentage change vs previous period (null/undefined hides it). invert: down is good (e.g. cancellations). */
export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', delta, invert = false, loading, onClick, index = 0 }) {
  const up = delta > 0;
  const flat = delta === 0 || delta == null;
  const good = flat ? null : invert ? !up : up;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      style={{ '--i': index }}
      className={cn(
        'surface stagger relative overflow-hidden p-3.5 sm:p-5 text-start transition-all',
        onClick && 'surface-hover w-full cursor-pointer',
      )}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[11px] sm:text-xs font-semibold text-stone-500 leading-tight">{label}</span>
          {loading ? (
            <Skeleton className="mt-1.5 sm:mt-2 h-6 sm:h-8 w-20 sm:w-28" />
          ) : (
            <div className="num mt-1 truncate text-base sm:text-[1.4rem] xl:text-[1.65rem] font-extrabold leading-tight tracking-tight text-ink">{value}</div>
          )}
        </div>
        {Icon && (
          <span className={cn('grid size-8 sm:size-11 shrink-0 place-items-center rounded-xl sm:rounded-2xl', STAT_TONES[tone])}>
            <Icon className="size-4 sm:size-5" />
          </span>
        )}
      </div>
      {(hint || delta != null) && !loading && (
        <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs">
          {delta != null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 sm:px-2 py-0.5 font-bold num text-[10px] sm:text-xs shrink-0',
                flat ? 'bg-stone-100 text-stone-500' : good ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
              )}
            >
              {flat ? <Minus className="size-2.5 sm:size-3" /> : up ? <ArrowUpRight className="size-2.5 sm:size-3" /> : <ArrowDownRight className="size-2.5 sm:size-3" />}
              {Math.abs(Math.round(delta))}%
            </span>
          )}
          {hint && <span className="truncate text-stone-500 text-[10px] sm:text-xs">{hint}</span>}
        </div>
      )}
    </Tag>
  );
}

/** Pill tabs. options: [{ value, label, count? }] */
export function Tabs({ options, value, onChange, className }) {
  return (
    <div
      role="tablist"
      className={cn('scrollbar-none flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-sand-200 bg-sand-100/70 p-1', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 sm:flex-initial justify-center inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-xl px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold transition-all',
              active ? 'bg-white text-brand-700 shadow-soft' : 'text-stone-500 hover:text-ink',
            )}
          >
            {o.label}
            {o.count != null && (
              <span className={cn('num rounded-full px-1.5 text-[10px] font-bold', active ? 'bg-brand-50 text-brand-700' : 'bg-sand-200 text-stone-500')}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, className }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-sand-300 bg-white py-2.5 pe-9 ps-10 text-sm text-ink transition-all placeholder:text-stone-400 hover:border-sand-400 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 hover:text-ink" aria-label="clear">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, total, limit, onChange, className }) {
  const lang = useLanguageStore((s) => s.lang);
  const pages = Math.max(1, Math.ceil((total || 0) / limit));
  if (pages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className={cn('flex items-center justify-between gap-3 border-t border-sand-100 px-4 py-3 text-xs text-stone-500', className)}>
      <span className="num">
        {from}–{to} {lang === 'ar' ? 'من' : 'of'} {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="p-1.5!" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="previous">
          <ChevronRight className="size-4 ltr:hidden" />
          <ChevronLeft className="size-4 rtl:hidden" />
        </Button>
        <span className="num min-w-16 text-center font-semibold text-ink">
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon" className="p-1.5!" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="next">
          <ChevronLeft className="size-4 ltr:hidden" />
          <ChevronRight className="size-4 rtl:hidden" />
        </Button>
      </div>
    </div>
  );
}

/** Shell for tables: handles horizontal scroll, header styling and loading rows. */
export function DataTable({ columns, rows, loading, rowKey = 'id', onRowClick, empty, skeletonRows = 6, className }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] text-start text-sm">
        <thead>
          <tr className="border-b border-sand-200 bg-sand-50/80 text-[11px] font-bold uppercase tracking-wider text-stone-500">
            {columns.map((c) => (
              <th key={c.key} className={cn('whitespace-nowrap px-4 py-3 text-start', c.align === 'end' && 'text-end', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-100">
          {loading
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={row[rowKey]}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn('transition-colors hover:bg-brand-50/40', onRowClick && 'cursor-pointer')}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3.5 align-middle', c.align === 'end' && 'text-end', c.cellClassName)}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && empty}
    </div>
  );
}

export function Avatar({ name, src, size = 'md', className }) {
  const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-xl' };
  return src ? (
    <img src={src} alt={name} className={cn('rounded-xl object-cover', sizes[size], className)} />
  ) : (
    <span className={cn('grid shrink-0 place-items-center rounded-xl bg-brand-gradient font-bold text-white', sizes[size], className)}>
      {initials(name)}
    </span>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-brand-600' : 'bg-sand-300',
      )}
    >
      <span
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow transition-transform',
          checked ? 'ltr:translate-x-[22px] rtl:-translate-x-[22px]' : 'ltr:translate-x-0.5 rtl:-translate-x-0.5',
        )}
      />
    </button>
  );
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, description, confirmLabel, cancelLabel, danger = false, loading, children }) {
  const lang = useLanguageStore((s) => s.lang);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel || (lang === 'ar' ? 'إلغاء' : 'Cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel || (lang === 'ar' ? 'تأكيد' : 'Confirm')}
          </Button>
        </div>
      }
    >
      {children || <div className="text-sm text-stone-600">{description}</div>}
    </Modal>
  );
}

export function InfoRow({ label, children, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2 text-sm', className)}>
      <span className="shrink-0 text-stone-500">{label}</span>
      <span className="min-w-0 text-end font-semibold text-ink">{children}</span>
    </div>
  );
}
