import { z } from 'zod';

const uuid = z.string().uuid();
const i18n = z.object({ ar: z.string().trim().min(1, 'مطلوب'), en: z.string().trim().default('') });
const i18nOptional = z.object({ ar: z.string().trim().default(''), en: z.string().trim().default('') }).partial();
const hhmm = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/, 'وقت غير صحيح');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ غير صحيح');
const money = z.coerce.number().min(0).max(10_000_000);
const unitEnum = z.enum(['hourly', 'half_day', 'full_day', 'daily', 'weekly', 'monthly']);
const emptyToUndef = (v) => (v === '' || v === null ? undefined : v);
const optStr = (max = 300) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());

/* ---------------- auth ---------------- */
const password = z.string().min(8, 'كلمة المرور 8 أحرف على الأقل').max(100);
const phone = z.preprocess(emptyToUndef, z.string().trim().regex(/^(\+?20|0)?1[0125]\d{8}$/, 'رقم الهاتف غير صحيح').optional());
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'الاسم مطلوب').max(120),
  email: z.string().trim().toLowerCase().email('بريد إلكتروني غير صحيح'),
  phone,
  password,
  locale: z.enum(['ar', 'en']).optional(),
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone,
  company: optStr(160),
  locale: z.enum(['ar', 'en']).optional(),
  avatar_url: optStr(500),
});
export const changePasswordSchema = z.object({ current_password: z.string().min(1), new_password: password });

/* ---------------- booking ---------------- */
const addonItem = z.object({ add_on_id: uuid, quantity: z.coerce.number().int().min(1).max(50).default(1) });
export const bookingInputSchema = z.object({
  space_id: uuid,
  unit: unitEnum,
  date: isoDate,
  start_time: hhmm.optional(),
  duration_minutes: z.coerce.number().int().min(30).max(24 * 60).optional(),
  guest_count: z.coerce.number().int().min(1).max(1000).default(1),
  addons: z.array(addonItem).max(20).default([]),
  coupon_code: optStr(40),
  expected_total: z.coerce.number().optional(),
  notes: optStr(1000),
  guests: z.array(z.object({ name: z.string().trim().min(1).max(120), email: optStr(190), phone: optStr(30) })).max(50).optional(),
});
export const adminBookingSchema = bookingInputSchema.extend({
  customer_id: uuid.optional(),
  customer: z.object({ name: z.string().trim().min(2), email: z.string().trim().toLowerCase().email().optional(), phone }).optional(),
  mark_paid: z.object({ method: z.enum(['cash', 'vodafone_cash', 'instapay', 'bank_transfer', 'corporate']), reference: optStr(120) }).optional(),
});
export const bookingPatchSchema = z.object({
  date: isoDate.optional(),
  start_time: hhmm.optional(),
  duration_minutes: z.coerce.number().int().min(30).max(24 * 60).optional(),
  guest_count: z.coerce.number().int().min(1).max(1000).optional(),
  notes: optStr(1000),
});
export const selectMethodSchema = z.object({ method: z.string().min(2).max(30) });
export const submitPaymentSchema = z.object({
  transfer_reference: optStr(120),
  transfer_time: z.coerce.date({ message: 'وقت التحويل مطلوب' }),
  sender_info: optStr(200),
});
export const cancelSchema = z.object({ reason: optStr(300), refund_percent: z.coerce.number().min(0).max(100).optional() });
export const reviewSchema = z.object({
  booking_id: uuid,
  rating: z.coerce.number().int().min(1).max(5),
  comment: optStr(2000),
  images: z.array(z.string().max(500)).max(4).default([]),
});
export const reasonSchema = z.object({ reason: z.string().trim().min(3, 'برجاء كتابة السبب').max(500) });
export const noteSchema = z.object({ note: optStr(500) });
export const refundSchema = z.object({});

/* ---------------- catalog (admin) ---------------- */
const pricingRule = z.object({
  unit: unitEnum,
  kind: z.enum(['base', 'weekend', 'peak']).default('base'),
  amount: money,
  peak_start: hhmm.optional(),
  peak_end: hhmm.optional(),
  active: z.boolean().default(true),
});
const hoursRule = z.object({ weekday: z.number().int().min(0).max(6), opens: hhmm, closes: hhmm, is_closed: z.boolean().default(false) });
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'رابط غير صحيح (أحرف إنجليزية وشرطات فقط)').max(140);

export const spaceSchema = z.object({
  slug,
  name: i18n,
  description: i18nOptional.optional(),
  rules: z.array(i18nOptional).max(30).default([]),
  type_id: uuid,
  location_id: uuid,
  capacity: z.coerce.number().int().min(1).max(5000),
  units: z.coerce.number().int().min(1).max(500).default(1),
  area_sqm: z.coerce.number().int().min(0).optional(),
  floor: optStr(40),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
  featured: z.boolean().default(false),
  buffer_minutes: z.coerce.number().int().min(0).max(240).default(0),
  images: z.array(z.object({ url: z.string().min(1).max(500), alt: i18nOptional.optional() })).max(20).default([]),
  amenity_ids: z.array(uuid).default([]),
  pricing: z.array(pricingRule).min(1, 'أضف سعرًا واحدًا على الأقل').max(30),
  hours: z.array(hoursRule).max(7).default([]),
});
export const spacePatchSchema = spaceSchema.partial();
export const statusSchema = z.object({ status: z.enum(['draft', 'active', 'archived']) });

export const locationSchema = z.object({
  slug,
  name: i18n,
  address: i18n,
  city: i18n,
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  description: i18nOptional.optional(),
  images: z.array(z.string().max(500)).default([]),
  working_hours: z.record(z.string(), z.any()).default({}),
  phone: optStr(30),
  email: z.preprocess(emptyToUndef, z.string().email().optional()),
  active: z.boolean().default(true),
});
export const spaceTypeSchema = z.object({
  key: z.string().trim().min(2).max(40).regex(/^[a-z_]+$/),
  group: z.string().trim().min(2).max(40),
  name: i18n,
  description: i18nOptional.optional(),
  icon: optStr(40),
  color: optStr(20),
  sort: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});
export const amenitySchema = z.object({
  key: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/),
  name: i18n,
  icon: optStr(40),
  active: z.boolean().default(true),
});
export const addOnSchema = z.object({
  name: i18n,
  description: i18nOptional.optional(),
  price: money,
  pricing_mode: z.enum(['per_booking', 'per_hour', 'per_person']).default('per_booking'),
  max_quantity: z.coerce.number().int().min(1).max(100).default(10),
  image_url: optStr(500),
  applicable_types: z.array(z.string()).nullable().optional(),
  active: z.boolean().default(true),
  sort: z.coerce.number().int().default(0),
});
export const couponSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(40).regex(/^[A-Z0-9_-]+$/, 'أحرف إنجليزية وأرقام فقط'),
  description: i18nOptional.optional(),
  discount_type: z.enum(['percentage', 'fixed']),
  value: z.coerce.number().positive(),
  max_discount: z.preprocess(emptyToUndef, z.coerce.number().positive().optional()),
  min_amount: z.coerce.number().min(0).default(0),
  starts_at: z.preprocess(emptyToUndef, z.coerce.date().optional()),
  ends_at: z.preprocess(emptyToUndef, z.coerce.date().optional()),
  usage_limit: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).optional()),
  per_user_limit: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).optional()),
  space_ids: z.array(uuid).nullable().optional(),
  space_type_keys: z.array(z.string()).nullable().optional(),
  active: z.boolean().default(true),
}).refine((c) => c.discount_type !== 'percentage' || c.value <= 100, { message: 'النسبة لا تزيد عن 100', path: ['value'] });

export const blockSchema = z.object({
  space_id: uuid.optional(),
  location_id: uuid.optional(),
  date: isoDate,
  start_time: hhmm.default('00:00'),
  end_time: hhmm.default('24:00'),
  end_date: isoDate.optional(),
  reason: z.enum(['blocked', 'maintenance', 'blackout', 'holiday']).default('blocked'),
  note: optStr(300),
}).refine((b) => b.space_id || b.location_id, { message: 'حدد مساحة أو فرعًا' });

export const paymentMethodSchema = z.object({
  name: i18nOptional.optional(),
  account_identifier: optStr(120),
  account_name: optStr(160),
  instructions: i18nOptional.optional(),
  qr_image_url: optStr(500),
  active: z.boolean().optional(),
  sort: z.coerce.number().int().optional(),
});

export const settingsPatchSchema = z.object({
  general: z.record(z.string(), z.any()).optional(),
  booking: z.record(z.string(), z.any()).optional(),
  payment: z.record(z.string(), z.any()).optional(),
  notifications: z.record(z.string(), z.any()).optional(),
  branding: z.record(z.string(), z.any()).optional(),
});

export const teamMemberSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone,
  password: password.optional(),
  role_ids: z.array(uuid).min(1, 'اختر دورًا واحدًا على الأقل'),
  status: z.enum(['active', 'suspended']).default('active'),
});
export const teamPatchSchema = teamMemberSchema.partial();
export const roleSchema = z.object({
  key: z.string().trim().regex(/^[a-z_]+$/).min(2).max(40),
  name: i18n,
  permission_keys: z.array(z.string()).default([]),
});
export const rolePatchSchema = roleSchema.partial();
export const contactSchema = z.object({
  name: z.string().trim().min(2, 'الاسم مطلوب').max(120),
  email: z.string().trim().toLowerCase().email('بريد إلكتروني غير صحيح'),
  phone,
  subject: optStr(150),
  message: z.string().trim().min(10, 'الرسالة قصيرة جدًا').max(2000),
});
export const messageSchema = z.object({ user_id: uuid, title: optStr(120), message: z.string().trim().min(2).max(1000) });

/* ---------------- query ---------------- */
export const spaceQuerySchema = z.object({
  q: optStr(100),
  location: optStr(80),
  type: optStr(40),
  group: optStr(40),
  capacity: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).optional()),
  min_price: z.preprocess(emptyToUndef, z.coerce.number().min(0).optional()),
  max_price: z.preprocess(emptyToUndef, z.coerce.number().min(0).optional()),
  unit: z.preprocess(emptyToUndef, unitEnum.optional()),
  date: z.preprocess(emptyToUndef, isoDate.optional()),
  start_time: z.preprocess(emptyToUndef, hhmm.optional()),
  end_time: z.preprocess(emptyToUndef, hhmm.optional()),
  featured: z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : undefined), z.boolean().optional()),
  sort: z.enum(['recommended', 'price_asc', 'price_desc', 'rating', 'capacity']).default('recommended'),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  page: z.coerce.number().int().min(1).default(1),
});
export const availabilityQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  date: isoDate.optional(),
  unit: unitEnum.default('hourly'),
  duration: z.coerce.number().int().min(30).max(1440).default(60),
});
export const matchQuerySchema = z.object({
  purpose: z.enum(['meeting', 'focus', 'interview', 'workshop', 'team', 'event']),
  people: z.enum(['1-2', '3-6', '7-15', '15+']),
  hours: z.coerce.number().min(1).max(12).default(2),
  location: optStr(80),
});
export const rangeQuerySchema = z.object({
  range: z.enum(['today', '7d', '30d', '90d', 'custom']).default('30d'),
  from: isoDate.optional(),
  to: isoDate.optional(),
  location: z.preprocess(emptyToUndef, uuid.optional()),
});
export const listQuerySchema = z.object({
  q: optStr(100),
  status: optStr(40),
  payment_status: optStr(40),
  location: z.preprocess(emptyToUndef, uuid.optional()),
  space: z.preprocess(emptyToUndef, uuid.optional()),
  type: optStr(40),
  from: z.preprocess(emptyToUndef, isoDate.optional()),
  to: z.preprocess(emptyToUndef, isoDate.optional()),
  scope: optStr(20),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});
