import { CheckCircle2, Circle, FileUp, Hourglass, PlayCircle, RefreshCcw, Undo2, XCircle, CalendarPlus, Pencil, Wallet } from 'lucide-react';
import { BOOKING_EVENT_LABELS, cn, formatDateTime } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';

const EVENT_STYLE = {
  created: { icon: CalendarPlus, tone: 'text-stone-500 bg-sand-100' },
  receipt_uploaded: { icon: FileUp, tone: 'text-sky-700 bg-sky-50' },
  receipt_replaced: { icon: RefreshCcw, tone: 'text-sky-700 bg-sky-50' },
  payment_submitted: { icon: Wallet, tone: 'text-blue-700 bg-blue-50' },
  under_review: { icon: Hourglass, tone: 'text-blue-700 bg-blue-50' },
  payment_approved: { icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
  confirmed: { icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
  payment_rejected: { icon: XCircle, tone: 'text-rose-700 bg-rose-50' },
  new_receipt_requested: { icon: RefreshCcw, tone: 'text-amber-700 bg-amber-50' },
  started: { icon: PlayCircle, tone: 'text-teal-700 bg-teal-50' },
  active: { icon: PlayCircle, tone: 'text-teal-700 bg-teal-50' },
  completed: { icon: CheckCircle2, tone: 'text-stone-600 bg-stone-100' },
  cancelled: { icon: XCircle, tone: 'text-rose-700 bg-rose-50' },
  refunded: { icon: Undo2, tone: 'text-orange-700 bg-orange-50' },
  edited: { icon: Pencil, tone: 'text-stone-600 bg-sand-100' },
};

export function BookingTimeline({ events = [], showActor = false, className }) {
  const lang = useLanguageStore((s) => s.lang);
  if (!events.length) return null;
  return (
    <ol className={cn('relative space-y-4', className)}>
      {events.map((e, i) => {
        const style = EVENT_STYLE[e.type] || { icon: Circle, tone: 'text-stone-500 bg-sand-100' };
        const Icon = style.icon;
        const reason = e.meta?.reason || e.meta?.note;
        return (
          <li key={e.id} className="relative flex gap-3">
            {i < events.length - 1 && <span className="absolute start-[15px] top-8 h-[calc(100%-8px)] w-px bg-sand-200" />}
            <span className={cn('z-10 grid size-8 shrink-0 place-items-center rounded-full', style.tone)}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 pb-1">
              <p className="text-sm font-semibold text-ink">{BOOKING_EVENT_LABELS[e.type]?.[lang] || e.type}</p>
              <p className="text-[11px] text-stone-400">
                {formatDateTime(e.at, lang)}
                {showActor && e.actor ? ` · ${e.actor}` : ''}
              </p>
              {reason && <p className="mt-1 rounded-lg bg-sand-50 px-2.5 py-1.5 text-xs text-stone-600">{reason}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
