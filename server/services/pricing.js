import { Op } from 'sequelize';
import { DateTime } from 'luxon';
import { models } from '../models/index.js';
import { fail } from '../utils/errors.js';
import { weekdayOf } from '../utils/time.js';
import { evaluateCoupon } from './coupons.js';

const r2 = (n) => Math.round(n * 100) / 100;

function hourlyRate(rules, slotStart, settings) {
  const hhmm = slotStart.toFormat('HH:mm');
  const hourly = rules.filter((p) => p.unit === 'hourly' && p.active);
  const peak = hourly.find((p) => p.kind === 'peak' && p.peak_start && p.peak_end && hhmm >= p.peak_start && hhmm < p.peak_end);
  if (peak) return { rate: Number(peak.amount), kind: 'peak' };
  const weekend = hourly.find((p) => p.kind === 'weekend');
  if (weekend && settings.general.weekend_days.includes(weekdayOf(slotStart))) return { rate: Number(weekend.amount), kind: 'weekend' };
  return { rate: Number(hourly.find((p) => p.kind === 'base').amount), kind: 'base' };
}

/** Base price for a resolved range. Pure function — no I/O. */
export function priceBase({ pricing, unit, start, end, settings }) {
  const step = settings.booking.slot_step_minutes;
  if (unit === 'hourly') {
    let total = 0;
    const kinds = {};
    for (let t = start; t < end; t = t.plus({ minutes: step })) {
      const { rate, kind } = hourlyRate(pricing, t, settings);
      total += (rate * step) / 60;
      kinds[kind] = (kinds[kind] || 0) + step;
    }
    const minutes = end.diff(start, 'minutes').minutes;
    return { amount: r2(total), unit_price: r2((total / minutes) * 60), quantity: minutes / 60, kinds };
  }
  const rules = pricing.filter((p) => p.unit === unit && p.active);
  const weekend = rules.find((p) => p.kind === 'weekend');
  const useWeekend = weekend && settings.general.weekend_days.includes(weekdayOf(start));
  const rule = useWeekend ? weekend : rules.find((p) => p.kind === 'base');
  if (!rule) fail('UNIT_NOT_SUPPORTED');
  return { amount: r2(Number(rule.amount)), unit_price: r2(Number(rule.amount)), quantity: 1, kinds: { [rule.kind]: 1 } };
}

async function priceAddOns({ space, items, durationMinutes, unit, guestCount, transaction }) {
  if (!items?.length) return { lines: [], total: 0 };
  const ids = items.map((i) => i.add_on_id);
  const rows = await models.AddOn.findAll({ where: { id: { [Op.in]: ids }, active: true }, transaction });
  const lines = [];
  for (const item of items) {
    const row = rows.find((r) => r.id === item.add_on_id);
    const qty = Number(item.quantity || 1);
    if (!row || !Number.isInteger(qty) || qty < 1 || qty > row.max_quantity) fail('ADDON_UNAVAILABLE');
    if (row.applicable_types?.length && !row.applicable_types.includes(space.type?.key)) fail('ADDON_UNAVAILABLE');
    let multiplier = 1;
    if (row.pricing_mode === 'per_hour' && ['hourly', 'half_day'].includes(unit)) multiplier = Math.ceil(durationMinutes / 60);
    if (row.pricing_mode === 'per_person') multiplier = guestCount;
    const total = r2(Number(row.price) * qty * multiplier);
    lines.push({ add_on_id: row.id, name: row.name, quantity: qty, multiplier, unit_price: Number(row.price), pricing_mode: row.pricing_mode, total });
  }
  return { lines, total: r2(lines.reduce((s, l) => s + l.total, 0)) };
}

/**
 * The single source of truth for what a booking costs. The client NEVER supplies prices;
 * it may only supply an `expected_total` so we can warn when the price moved.
 */
export async function buildQuote({ space, pricing, range, unit, guestCount, addons, couponCode, userId, settings, transaction, lockCoupon = false }) {
  const base = priceBase({ pricing, unit, start: range.start, end: range.end, settings });
  const addonResult = await priceAddOns({ space, items: addons, durationMinutes: range.durationMinutes, unit, guestCount, transaction });
  const subtotal = r2(base.amount + addonResult.total);

  let discount = { amount: 0, code: null, coupon: null };
  if (couponCode) {
    const res = await evaluateCoupon({ code: couponCode, userId, space, subtotal, transaction, lock: lockCoupon });
    discount = { amount: res.discount, code: res.coupon.code, coupon: res.coupon };
  }
  const taxable = r2(subtotal - discount.amount);
  const taxRate = Number(settings.general.tax_rate || 0);
  const tax = r2(taxable * (taxRate / 100));
  const final = r2(taxable + tax);

  return {
    unit,
    start_at: range.start.toUTC().toISO(),
    end_at: range.end.toUTC().toISO(),
    duration_minutes: range.durationMinutes,
    base: { amount: base.amount, unit_price: base.unit_price, quantity: base.quantity, kinds: base.kinds },
    addons: addonResult.lines,
    base_amount: base.amount,
    addon_amount: addonResult.total,
    subtotal,
    discount_amount: discount.amount,
    coupon_code: discount.code,
    coupon_id: discount.coupon?.id || null,
    tax_rate: taxRate,
    tax_amount: tax,
    final_amount: final,
    currency: space.currency || settings.general.currency,
  };
}

export const publicQuote = ({ coupon_id, ...rest }) => rest;
export { DateTime };
