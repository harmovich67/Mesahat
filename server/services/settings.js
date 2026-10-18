import { models } from '../models/index.js';
import { SETTINGS_DEFAULTS } from '../config/settingsDefaults.js';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) out[k] = isObj(v) && isObj(base?.[k]) ? merge(base[k], v) : v;
  return out;
}

let cache = null;
let cacheAt = 0;
const TTL = 5_000;

export function invalidateSettings() {
  cache = null;
}

/** Full settings tree (defaults overlaid with stored values). Short in-memory cache. */
export async function getSettings({ transaction } = {}) {
  if (!transaction && cache && Date.now() - cacheAt < TTL) return cache;
  const rows = await models.Setting.findAll({ transaction });
  let out = structuredClone(SETTINGS_DEFAULTS);
  for (const r of rows) out[r.key] = merge(out[r.key] || {}, r.value);
  if (!transaction) {
    cache = out;
    cacheAt = Date.now();
  }
  return out;
}

export async function updateSettings(patch, { transaction } = {}) {
  for (const [group, value] of Object.entries(patch)) {
    if (!(group in SETTINGS_DEFAULTS)) continue;
    const row = await models.Setting.findByPk(group, { transaction });
    const next = merge(row?.value || {}, value);
    await models.Setting.upsert({ key: group, value: next }, { transaction });
  }
  invalidateSettings();
  return getSettings({ transaction });
}

/** Settings safe to show to anonymous visitors. */
export async function getPublicSettings() {
  const s = await getSettings();
  return {
    general: {
      business_name: s.general.business_name,
      tagline: s.general.tagline,
      logo_url: s.general.logo_url,
      email: s.general.email,
      phone: s.general.phone,
      address: s.general.address,
      currency: s.general.currency,
      timezone: s.general.timezone,
      tax_rate: s.general.tax_rate,
      weekend_days: s.general.weekend_days,
    },
    booking: {
      min_duration_minutes: s.booking.min_duration_minutes,
      max_duration_minutes: s.booking.max_duration_minutes,
      slot_step_minutes: s.booking.slot_step_minutes,
      half_day_hours: s.booking.half_day_hours,
      payment_hold_minutes: s.booking.payment_hold_minutes,
      advance_booking_days: s.booking.advance_booking_days,
      cancellation: s.booking.cancellation,
    },
    payment: {
      receipt_required: s.payment.receipt_required,
      receipt_max_mb: s.payment.receipt_max_mb,
      receipt_types: s.payment.receipt_types,
      general_instructions: s.payment.general_instructions,
    },
    branding: s.branding,
  };
}
