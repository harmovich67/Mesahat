export function cn(...classes) {
  return classes.flat(Infinity).filter(Boolean).join(' ');
}

const TZ = 'Africa/Cairo';
const locale = (lang) => (lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');

export function formatNumber(n, lang = 'ar') {
  return Number(n || 0).toLocaleString(locale(lang), { maximumFractionDigits: 2 });
}

export function formatEGP(amount, lang = 'ar') {
  const num = formatNumber(amount, lang);
  return lang === 'ar' ? `${num} ج.م` : `EGP ${num}`;
}

export function formatCompact(n, lang = 'ar') {
  return Intl.NumberFormat(locale(lang), { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0));
}

export function formatDate(dateStr, lang = 'ar', opts) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(locale(lang), {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: TZ, ...opts,
  });
}

export function formatTime(dateStr, lang = 'ar') {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString(locale(lang), {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TZ,
  });
}

export function formatDateTime(dateStr, lang = 'ar') {
  if (!dateStr) return '';
  return `${formatDate(dateStr, lang)} · ${formatTime(dateStr, lang)}`;
}

export function formatRange(startAt, endAt, lang = 'ar') {
  if (!startAt || !endAt) return '';
  const sameDay = formatDate(startAt, lang) === formatDate(endAt, lang);
  return sameDay
    ? `${formatDate(startAt, lang)} · ${formatTime(startAt, lang)} – ${formatTime(endAt, lang)}`
    : `${formatDateTime(startAt, lang)} → ${formatDateTime(endAt, lang)}`;
}

export function timeAgo(dateStr, lang = 'ar') {
  if (!dateStr) return '';
  const diff = (new Date(dateStr).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' });
  const steps = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, secs] of steps) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return rtf.format(Math.round(diff), 'second');
}

export function formatDuration(minutes, lang = 'ar') {
  const m = Number(minutes || 0);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (lang === 'ar') {
    if (h && rest) return `${h} س ${rest} د`;
    if (h) return h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : `${h} ساعات`;
    return `${m} دقيقة`;
  }
  if (h && rest) return `${h}h ${rest}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** YYYY-MM-DD in the business timezone (not UTC — avoids off-by-one near midnight). */
export function isoDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function getLocalized(val, lang = 'ar') {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val[lang] || val.ar || val.en || Object.values(val)[0] || '';
  return String(val);
}

/** Phone numbers and similar tokens stay LTR inside RTL layouts. */
export const ltr = { dir: 'ltr', style: { unicodeBidi: 'isolate' } };

export function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'W';
}

/**
 * Flatten a space (card or detail payload) into the shape the UI components expect.
 * Pricing comes from the real `prices` / `pricing` arrays — nothing is invented.
 */
export function normalizeSpace(space, lang = 'ar') {
  if (!space) return null;
  const rules = (space.pricing || space.prices || []).filter((p) => (p.kind ? p.kind === 'base' : true) && p.active !== false);
  const price = (...units) => rules.find((p) => units.includes(p.unit))?.amount ?? null;
  const hourly = price('hourly');
  const daily = price('daily', 'full_day');

  return {
    ...space,
    name: getLocalized(space.name, lang),
    name_i18n: space.name,
    description: getLocalized(space.description, lang),
    type_key: space.type?.key || null,
    type_name: getLocalized(space.type?.name, lang),
    hourly_rate: hourly,
    daily_rate: daily,
    from_price: rules.length ? Math.min(...rules.map((p) => Number(p.amount))) : null,
    from_unit: rules.length ? rules.reduce((a, b) => (Number(b.amount) < Number(a.amount) ? b : a)).unit : null,
    image_url: space.cover || space.images?.[0]?.url || '/images/hero.jpg',
    location_name: getLocalized(space.location?.name, lang),
    city_name: getLocalized(space.location?.city, lang),
    address_text: getLocalized(space.location?.address, lang),
  };
}

export const UNIT_LABELS = {
  hourly: { ar: 'ساعة', en: 'hour' },
  half_day: { ar: 'نصف يوم', en: 'half day' },
  full_day: { ar: 'يوم كامل', en: 'full day' },
  daily: { ar: 'يوم', en: 'day' },
  weekly: { ar: 'أسبوع', en: 'week' },
  monthly: { ar: 'شهر', en: 'month' },
};

export const unitLabel = (unit, lang = 'ar') => UNIT_LABELS[unit]?.[lang] || unit || '';

/* ------------------------------------------------------------------ */
/* Status vocabularies — match the server state machine exactly.      */
/* tone → used by <StatusBadge/> to pick colours.                     */
/* ------------------------------------------------------------------ */
export const BOOKING_STATUS_CONFIG = {
  pending_payment: { label: { ar: 'بانتظار الدفع', en: 'Pending payment' }, tone: 'amber' },
  payment_under_review: { label: { ar: 'قيد مراجعة الدفع', en: 'Payment under review' }, tone: 'blue' },
  confirmed: { label: { ar: 'مؤكد', en: 'Confirmed' }, tone: 'green' },
  active: { label: { ar: 'نشط الآن', en: 'In progress' }, tone: 'teal' },
  completed: { label: { ar: 'مكتمل', en: 'Completed' }, tone: 'stone' },
  cancelled: { label: { ar: 'ملغي', en: 'Cancelled' }, tone: 'rose' },
  expired: { label: { ar: 'منتهي المهلة', en: 'Expired' }, tone: 'stone' },
  rejected: { label: { ar: 'مرفوض', en: 'Rejected' }, tone: 'red' },
};

export const PAYMENT_STATUS_CONFIG = {
  unpaid: { label: { ar: 'غير مدفوع', en: 'Unpaid' }, tone: 'amber' },
  proof_uploaded: { label: { ar: 'تم رفع الإيصال', en: 'Receipt uploaded' }, tone: 'sky' },
  under_review: { label: { ar: 'قيد المراجعة', en: 'Under review' }, tone: 'blue' },
  approved: { label: { ar: 'مقبول', en: 'Approved' }, tone: 'green' },
  rejected: { label: { ar: 'مرفوض', en: 'Rejected' }, tone: 'red' },
  refund_pending: { label: { ar: 'بانتظار الاسترداد', en: 'Refund pending' }, tone: 'orange' },
  refunded: { label: { ar: 'تم الاسترداد', en: 'Refunded' }, tone: 'stone' },
};

export const PAYMENT_METHOD_LABELS = {
  vodafone_cash: { ar: 'فودافون كاش', en: 'Vodafone Cash' },
  instapay: { ar: 'إنستاباي', en: 'InstaPay' },
  cash: { ar: 'نقدي', en: 'Cash' },
  bank_transfer: { ar: 'تحويل بنكي', en: 'Bank transfer' },
  corporate: { ar: 'حساب شركات', en: 'Corporate' },
};
export const methodLabel = (code, lang = 'ar') => PAYMENT_METHOD_LABELS[code]?.[lang] || code || '—';

export const BOOKING_EVENT_LABELS = {
  created: { ar: 'تم إنشاء الحجز', en: 'Booking created' },
  receipt_uploaded: { ar: 'تم رفع إيصال التحويل', en: 'Receipt uploaded' },
  receipt_replaced: { ar: 'تم استبدال الإيصال', en: 'Receipt replaced' },
  payment_submitted: { ar: 'تم إرسال بيانات الدفع', en: 'Payment submitted' },
  under_review: { ar: 'قيد المراجعة', en: 'Under review' },
  payment_approved: { ar: 'تم قبول الدفع', en: 'Payment approved' },
  payment_rejected: { ar: 'تم رفض الدفع', en: 'Payment rejected' },
  new_receipt_requested: { ar: 'طُلب إيصال جديد', en: 'New receipt requested' },
  confirmed: { ar: 'تم تأكيد الحجز', en: 'Booking confirmed' },
  started: { ar: 'بدأ الحجز', en: 'Booking started' },
  active: { ar: 'الحجز نشط', en: 'Booking active' },
  completed: { ar: 'اكتمل الحجز', en: 'Booking completed' },
  cancelled: { ar: 'تم إلغاء الحجز', en: 'Booking cancelled' },
  refunded: { ar: 'تم الاسترداد', en: 'Refund issued' },
  edited: { ar: 'تم تعديل الحجز', en: 'Booking edited' },
};

export const WEEKDAYS = {
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
