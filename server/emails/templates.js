import { formatMoney, formatDateTimeAr } from '../utils/time.js';

/**
 * Email + in-app notification templates. Each entry returns bilingual copy.
 * `ctx` = { booking, space, amount, reason, ... } — plain values only.
 */
const bn = (c) => c.booking_number;
const spaceName = (c, l) => c.space_name?.[l] || c.space_name?.ar || '';

export const TEMPLATES = {
  booking_created: {
    title: (c) => ({ ar: `تم إنشاء حجزك ${bn(c)}`, en: `Booking ${bn(c)} created` }),
    body: (c) => ({
      ar: `تم حجز ${spaceName(c, 'ar')} مؤقتًا. أكمل الدفع خلال ${c.hold_minutes} دقيقة لتأكيد الحجز.`,
      en: `${spaceName(c, 'en')} is held for you. Complete payment within ${c.hold_minutes} minutes to confirm.`,
    }),
  },
  payment_submitted: {
    title: (c) => ({ ar: `تم استلام إثبات الدفع ${bn(c)}`, en: `Payment proof received for ${bn(c)}` }),
    body: (c) => ({
      ar: `استلمنا إيصال التحويل بقيمة ${formatMoney(c.amount)} وهو الآن قيد المراجعة. سنخبرك بمجرد التأكيد.`,
      en: `We received your ${formatMoney(c.amount)} transfer receipt. It is now under review.`,
    }),
  },
  payment_approved: {
    title: (c) => ({ ar: `تم قبول الدفع ${bn(c)}`, en: `Payment approved for ${bn(c)}` }),
    body: (c) => ({
      ar: `تم التحقق من تحويلك بقيمة ${formatMoney(c.amount)} بنجاح.`,
      en: `Your ${formatMoney(c.amount)} transfer has been verified.`,
    }),
  },
  payment_rejected: {
    title: (c) => ({ ar: `تم رفض إثبات الدفع ${bn(c)}`, en: `Payment rejected for ${bn(c)}` }),
    body: (c) => ({ ar: `السبب: ${c.reason}`, en: `Reason: ${c.reason}` }),
  },
  new_receipt_requested: {
    title: (c) => ({ ar: `مطلوب إيصال جديد ${bn(c)}`, en: `New receipt needed for ${bn(c)}` }),
    body: (c) => ({
      ar: `${c.reason}. برجاء رفع إيصال جديد خلال ${c.window_minutes} دقيقة للحفاظ على الحجز.`,
      en: `${c.reason}. Please upload a new receipt within ${c.window_minutes} minutes to keep your booking.`,
    }),
  },
  booking_confirmed: {
    title: (c) => ({ ar: `تم تأكيد حجزك ${bn(c)}`, en: `Booking ${bn(c)} confirmed` }),
    body: (c) => ({
      ar: `${spaceName(c, 'ar')} — ${formatDateTimeAr(c.start_at)}. نراك قريبًا!`,
      en: `${spaceName(c, 'en')} — see you soon!`,
    }),
  },
  booking_cancelled: {
    title: (c) => ({ ar: `تم إلغاء الحجز ${bn(c)}`, en: `Booking ${bn(c)} cancelled` }),
    body: (c) => ({
      ar: c.refund_amount > 0 ? `سيتم استرداد ${formatMoney(c.refund_amount)} بعد المراجعة.` : 'تم الإلغاء. لا يوجد مبلغ مسترد وفقًا لسياسة الإلغاء.',
      en: c.refund_amount > 0 ? `A refund of ${formatMoney(c.refund_amount)} will be processed.` : 'Cancelled. No refund applies under the policy.',
    }),
  },
  booking_expired: {
    title: (c) => ({ ar: `انتهت مهلة الحجز ${bn(c)}`, en: `Booking ${bn(c)} expired` }),
    body: () => ({ ar: 'لم يتم إرسال إثبات الدفع في الوقت المحدد، وأصبحت المساحة متاحة للآخرين.', en: 'Payment proof was not submitted in time and the space was released.' }),
  },
  booking_reminder: {
    title: (c) => ({ ar: `تذكير: حجزك غدًا ${bn(c)}`, en: `Reminder: upcoming booking ${bn(c)}` }),
    body: (c) => ({ ar: `${spaceName(c, 'ar')} — ${formatDateTimeAr(c.start_at)}`, en: `${spaceName(c, 'en')} — starts soon` }),
  },
  review_request: {
    title: () => ({ ar: 'كيف كانت تجربتك؟', en: 'How was your experience?' }),
    body: (c) => ({ ar: `شاركنا تقييمك لـ ${spaceName(c, 'ar')}.`, en: `Rate your time at ${spaceName(c, 'en')}.` }),
  },
  proof_uploaded: {
    title: (c) => ({ ar: `إثبات دفع جديد ${bn(c)}`, en: `New payment proof ${bn(c)}` }),
    body: (c) => ({ ar: `${c.customer_name} — ${formatMoney(c.amount)} عبر ${c.method_name}`, en: `${c.customer_name} — ${formatMoney(c.amount)}` }),
  },
  contact_message: {
    title: (c) => ({ ar: `رسالة تواصل جديدة من ${c.name}`, en: `New contact message from ${c.name}` }),
    body: (c) => ({ ar: String(c.message).slice(0, 160), en: String(c.message).slice(0, 160) }),
  },
  admin_message: {
    title: (c) => ({ ar: c.title || 'رسالة من الإدارة', en: c.title || 'Message from WORKORA' }),
    body: (c) => ({ ar: c.message, en: c.message }),
  },
};

const wrap = (title, bodyHtml, lang) => `<!doctype html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><body style="margin:0;background:#F5F1EA;font-family:Tahoma,Arial,sans-serif;color:#1c1f1d">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6dfd2">
<div style="background:#1F4D3F;color:#fff;padding:20px 28px;font-size:20px;font-weight:700;letter-spacing:.5px">WORKORA · ووركورا</div>
<div style="padding:28px"><h2 style="margin:0 0 12px;font-size:20px">${title}</h2><div style="font-size:15px;line-height:1.8">${bodyHtml}</div></div>
<div style="padding:16px 28px;background:#faf7f1;color:#7a7568;font-size:12px">مساحتك للعمل. بطريقتك. — Your space. Your way.</div></div></body></html>`;

export function renderEmail(type, ctx, lang = 'ar') {
  const tpl = TEMPLATES[type];
  if (!tpl) return null;
  const title = tpl.title(ctx)[lang] || tpl.title(ctx).ar;
  const body = tpl.body(ctx)[lang] || tpl.body(ctx).ar;
  return { subject: title, text: `${title}\n\n${body}`, html: wrap(title, `<p>${body}</p>`, lang) };
}
