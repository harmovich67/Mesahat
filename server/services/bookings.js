import { Op } from 'sequelize';
import { DateTime } from 'luxon';
import { models, sequelize } from '../models/index.js';
import { nextBookingNumber } from '../db/migrate.js';
import { fail } from '../utils/errors.js';
import { toJSDate } from '../utils/time.js';
import { getSettings } from './settings.js';
import { lockSpace, reserveSlot, resolveRange } from './availability.js';
import { buildQuote } from './pricing.js';
import { notify } from './notifications.js';
import { audit } from './audit.js';
import { expireStaleHolds } from './holds.js';

const STATE_MACHINE = {
  pending_payment: ['payment_under_review', 'confirmed', 'expired', 'cancelled'],
  payment_under_review: ['confirmed', 'rejected', 'pending_payment', 'cancelled'],
  confirmed: ['active', 'completed', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [], cancelled: [], expired: [], rejected: [],
};
export function assertTransition(from, to) {
  if (!STATE_MACHINE[from]?.includes(to)) fail('BOOKING_STATE');
}

export const bookingIncludes = () => [
  { model: models.Space, as: 'space', include: [{ model: models.SpaceType, as: 'type' }, { model: models.SpaceImage, as: 'images' }] },
  { model: models.Location, as: 'location' },
  { model: models.Payment, as: 'payment', include: [{ model: models.PaymentReceipt, as: 'receipts' }, { model: models.User, as: 'reviewer', attributes: ['id', 'name'] }] },
  { model: models.BookingAddOn, as: 'addons' },
  { model: models.BookingGuest, as: 'guests' },
  { model: models.BookingEvent, as: 'events', include: [{ model: models.User, as: 'actor', attributes: ['id', 'name'] }] },
  { model: models.User, as: 'customer', attributes: ['id', 'name', 'email', 'phone', 'locale'] },
];

export const loadBooking = (id, transaction) => models.Booking.findByPk(id, { include: bookingIncludes(), transaction });

export async function loadSpaceFull(id, transaction) {
  return models.Space.findByPk(id, {
    transaction,
    include: [
      { model: models.SpaceType, as: 'type' },
      { model: models.Location, as: 'location' },
      { model: models.PricingRule, as: 'pricing' },
      { model: models.AvailabilityRule, as: 'hours' },
    ],
  });
}

export const addEvent = (booking, type, { actor, meta, transaction } = {}) =>
  models.BookingEvent.create({ booking_id: booking.id, type, actor_id: actor?.id || null, meta: meta || null }, { transaction });

/** Quote without reserving anything (used by the live price display). */
export async function quoteBooking({ userId, input, relaxed = false }) {
  const settings = await getSettings();
  const space = await loadSpaceFull(input.space_id);
  if (!space || space.status !== 'active') fail('NOT_FOUND');
  if (input.guest_count > space.capacity) fail('CAPACITY_EXCEEDED');
  const range = resolveRange({
    space, rules: space.hours, pricing: space.pricing, unit: input.unit, date: input.date,
    startTime: input.start_time, durationMinutes: input.duration_minutes, settings, relaxed,
  });
  const quote = await buildQuote({
    space, pricing: space.pricing, range, unit: input.unit, guestCount: input.guest_count || 1,
    addons: input.addons, couponCode: input.coupon_code, userId, settings,
  });
  return { quote, space };
}

/**
 * Creates a booking atomically:
 *   lock space row → clear stale holds → validate hours → assign a free unit slot →
 *   price on the server → persist booking/addons/payment/coupon usage → events.
 * Any failure rolls everything back, so the slot is never half-reserved.
 */
export async function createBooking({ customerId, input, source = 'online', actor = null, markPaid = null, ip }) {
  const settings = await getSettings();
  try {
    return await sequelize.transaction(async (t) => {
      const locked = await lockSpace(input.space_id, t);
      const space = await loadSpaceFull(locked.id, t);
      if (space.status !== 'active') fail('SPACE_UNAVAILABLE');
      const guests = input.guest_count || 1;
      if (guests > space.capacity) fail('CAPACITY_EXCEEDED');

      const range = resolveRange({
        space, rules: space.hours, pricing: space.pricing, unit: input.unit, date: input.date,
        startTime: input.start_time, durationMinutes: input.duration_minutes, settings, relaxed: source === 'admin',
      });
      const slot = await reserveSlot({ space, start: range.start, end: range.end, transaction: t });
      const quote = await buildQuote({
        space, pricing: space.pricing, range, unit: input.unit, guestCount: guests,
        addons: input.addons, couponCode: input.coupon_code, userId: customerId, settings, transaction: t, lockCoupon: true,
      });
      if (input.expected_total != null && Math.abs(Number(input.expected_total) - quote.final_amount) > 0.009) fail('PRICE_CHANGED');

      const free = quote.final_amount === 0;
      const confirmNow = !!markPaid || free;
      const holdMinutes = settings.booking.payment_hold_minutes;
      const booking = await models.Booking.create({
        booking_number: await nextBookingNumber(t),
        user_id: customerId,
        space_id: space.id,
        location_id: space.location_id,
        start_at: toJSDate(range.start),
        end_at: toJSDate(range.end),
        duration_minutes: range.durationMinutes,
        unit: input.unit,
        unit_slot: slot,
        guest_count: guests,
        base_amount: quote.base_amount,
        discount_amount: quote.discount_amount,
        addon_amount: quote.addon_amount,
        tax_amount: quote.tax_amount,
        final_amount: quote.final_amount,
        currency: quote.currency,
        status: confirmNow ? 'confirmed' : 'pending_payment',
        hold_expires_at: confirmNow ? null : new Date(Date.now() + holdMinutes * 60_000),
        coupon_id: quote.coupon_id,
        coupon_code: quote.coupon_code,
        notes: input.notes || null,
        source,
        created_by: actor?.id || customerId,
        price_snapshot: quote,
      }, { transaction: t });

      if (quote.addons.length) {
        await models.BookingAddOn.bulkCreate(quote.addons.map((a) => ({
          booking_id: booking.id, add_on_id: a.add_on_id, name: a.name, quantity: a.quantity, unit_price: a.unit_price, total: a.total,
        })), { transaction: t });
      }
      if (input.guests?.length) {
        await models.BookingGuest.bulkCreate(input.guests.map((g) => ({ ...g, booking_id: booking.id })), { transaction: t });
      }
      if (quote.coupon_id) {
        await models.CouponUsage.create({
          coupon_id: quote.coupon_id, user_id: customerId, booking_id: booking.id, amount: quote.discount_amount,
          status: confirmNow ? 'redeemed' : 'reserved',
        }, { transaction: t });
      }

      await models.Payment.create({
        booking_id: booking.id,
        amount: quote.final_amount,
        currency: quote.currency,
        method: markPaid?.method || (free ? 'free' : null),
        status: confirmNow ? 'approved' : 'unpaid',
        transfer_reference: markPaid?.reference || null,
        submitted_at: confirmNow ? new Date() : null,
        reviewed_at: confirmNow ? new Date() : null,
        reviewed_by: confirmNow ? actor?.id || null : null,
      }, { transaction: t });

      await addEvent(booking, 'created', { actor, meta: { source }, transaction: t });
      if (confirmNow) await addEvent(booking, 'confirmed', { actor, meta: { manual: !!markPaid }, transaction: t });

      const customer = await models.User.findByPk(customerId, { transaction: t });
      const ctx = {
        booking_id: booking.id, booking_number: booking.booking_number, space_name: space.name,
        start_at: booking.start_at, amount: quote.final_amount, hold_minutes: holdMinutes,
      };
      await notify(customer, confirmNow ? 'booking_confirmed' : 'booking_created', ctx, { transaction: t, link: `/account/bookings/${booking.id}` });
      if (source === 'admin') {
        await audit(actor, 'booking.create_manual', { entityType: 'booking', entityId: booking.id, label: booking.booking_number, meta: { amount: quote.final_amount, paid: !!markPaid }, ip, transaction: t });
      }
      return booking.id;
    }).then((id) => loadBooking(id));
  } catch (err) {
    // The DB exclusion constraint is the last line of defence against a race we somehow lost.
    if (err?.parent?.code === '23P01' || err?.original?.code === '23P01') fail('SPACE_UNAVAILABLE');
    throw err;
  }
}

/** Refund/fee math for the configured cancellation policy. */
export function cancellationQuote(booking, settings, now = DateTime.now()) {
  const policy = settings.booking.cancellation;
  const paid = booking.payment?.status === 'approved' ? Number(booking.payment.amount) : 0;
  const hoursBefore = (new Date(booking.start_at).getTime() - now.toMillis()) / 3_600_000;
  const tiers = [...policy.tiers].sort((a, b) => b.hours_before - a.hours_before);
  const tier = tiers.find((x) => hoursBefore >= x.hours_before) || { refund_percent: 0, hours_before: 0 };
  let refund = 0;
  let fee = 0;
  if (paid > 0) {
    fee = Number(policy.fee_fixed || 0) + (paid * Number(policy.fee_percent || 0)) / 100;
    refund = Math.max(0, Math.round((paid * tier.refund_percent) / 100 - fee));
    if (tier.refund_percent === 0) { fee = 0; refund = 0; }
  }
  const statusOk = policy.allowed_statuses.includes(booking.status);
  const started = hoursBefore <= 0;
  return {
    allowed: statusOk && !started,
    reason: !statusOk ? 'status' : started ? 'started' : null,
    paid_amount: paid,
    refund_percent: paid > 0 ? tier.refund_percent : 0,
    refund_amount: refund,
    fee_amount: Math.round(fee * 100) / 100,
    hours_before: Math.max(0, Math.round(hoursBefore * 10) / 10),
    policy: { tiers: policy.tiers, fee_fixed: policy.fee_fixed, fee_percent: policy.fee_percent, allowed_statuses: policy.allowed_statuses },
  };
}

export async function cancelBooking({ bookingId, actor, isAdmin = false, reason, refundPercentOverride, ip }) {
  const settings = await getSettings();
  await sequelize.transaction(async (t) => {
    await models.Booking.findByPk(bookingId, { transaction: t, lock: t.LOCK.UPDATE, attributes: ['id'] });
    const booking = await loadBooking(bookingId, t);
    if (!booking) fail('NOT_FOUND');
    if (!isAdmin && booking.user_id !== actor.id) fail('NOT_FOUND');
    if (['cancelled', 'expired', 'rejected', 'completed'].includes(booking.status)) fail('BOOKING_STATE');

    const q = cancellationQuote(booking, settings);
    if (!isAdmin && !q.allowed) fail('CANCEL_NOT_ALLOWED');

    let refund = q.refund_amount;
    if (isAdmin && refundPercentOverride != null) refund = Math.round((q.paid_amount * refundPercentOverride) / 100);
    const payment = booking.payment;
    if (payment) {
      if (payment.status === 'approved' && refund > 0) {
        await payment.update({ status: 'refund_pending', refund_amount: refund }, { transaction: t });
      } else if (['proof_uploaded', 'under_review'].includes(payment.status)) {
        await payment.update({ status: 'rejected', rejection_reason: 'تم إلغاء الحجز قبل مراجعة الدفع', needs_new_receipt: false, reviewed_at: new Date() }, { transaction: t });
      }
    }
    await booking.update({
      status: 'cancelled', cancelled_at: new Date(), cancel_reason: reason || null,
      refund_amount: refund, hold_expires_at: null,
    }, { transaction: t });
    await models.CouponUsage.update({ status: 'released' }, { where: { booking_id: booking.id }, transaction: t });
    await addEvent(booking, 'cancelled', { actor, meta: { refund, by_admin: isAdmin, reason }, transaction: t });
    await notify(booking.customer, 'booking_cancelled', {
      booking_id: booking.id, booking_number: booking.booking_number, space_name: booking.space.name, refund_amount: refund,
    }, { transaction: t, link: `/account/bookings/${booking.id}` });
    if (isAdmin) {
      await audit(actor, 'booking.cancel', { entityType: 'booking', entityId: booking.id, label: booking.booking_number, meta: { refund, reason }, ip, transaction: t });
    }
  });
  return loadBooking(bookingId);
}

/** Admin reschedule / edit. Re-validates availability under the same space lock. */
export async function updateBooking({ bookingId, actor, patch, ip }) {
  const settings = await getSettings();
  await sequelize.transaction(async (t) => {
    const current = await models.Booking.findByPk(bookingId, { transaction: t });
    if (!current) fail('NOT_FOUND');
    if (!['pending_payment', 'payment_under_review', 'confirmed'].includes(current.status)) fail('BOOKING_STATE');
    const locked = await lockSpace(current.space_id, t);
    const space = await loadSpaceFull(locked.id, t);
    const booking = await loadBooking(bookingId, t);
    const updates = {};

    if (patch.date || patch.start_time || patch.duration_minutes) {
      const tz = settings.general.timezone;
      const cur = DateTime.fromJSDate(booking.start_at).setZone(tz);
      const range = resolveRange({
        space, rules: space.hours, pricing: space.pricing, unit: booking.unit,
        date: patch.date || cur.toISODate(), startTime: patch.start_time || cur.toFormat('HH:mm'),
        durationMinutes: patch.duration_minutes || booking.duration_minutes, settings, relaxed: true,
      });
      updates.unit_slot = await reserveSlot({ space, start: range.start, end: range.end, transaction: t, excludeBookingId: booking.id });
      updates.start_at = toJSDate(range.start);
      updates.end_at = toJSDate(range.end);
      updates.duration_minutes = range.durationMinutes;
      if (booking.payment?.status !== 'approved') {
        const quote = await buildQuote({ space, pricing: space.pricing, range, unit: booking.unit, guestCount: patch.guest_count || booking.guest_count, addons: booking.addons.map((a) => ({ add_on_id: a.add_on_id, quantity: a.quantity })), userId: booking.user_id, settings, transaction: t });
        Object.assign(updates, { base_amount: quote.base_amount, addon_amount: quote.addon_amount, discount_amount: quote.discount_amount, tax_amount: quote.tax_amount, final_amount: quote.final_amount });
        await booking.payment.update({ amount: quote.final_amount }, { transaction: t });
      }
    }
    if (patch.guest_count) {
      if (patch.guest_count > space.capacity) fail('CAPACITY_EXCEEDED');
      updates.guest_count = patch.guest_count;
    }
    if (patch.notes !== undefined) updates.notes = patch.notes;
    await booking.update(updates, { transaction: t });
    await addEvent(booking, 'edited', { actor, meta: Object.keys(patch), transaction: t });
    await audit(actor, 'booking.edit', { entityType: 'booking', entityId: booking.id, label: booking.booking_number, meta: patch, ip, transaction: t });
  }).catch((err) => {
    if (err?.parent?.code === '23P01') fail('SPACE_UNAVAILABLE');
    throw err;
  });
  return loadBooking(bookingId);
}

/** "Book Again": prefill built from what this customer typically does. */
export async function rebookSuggestions(userId, { limit = 3 } = {}) {
  const settings = await getSettings();
  const tz = settings.general.timezone;
  const past = await models.Booking.findAll({
    where: { user_id: userId, status: { [Op.in]: ['confirmed', 'active', 'completed'] } },
    include: [
      { model: models.Space, as: 'space', include: [{ model: models.SpaceType, as: 'type' }, { model: models.SpaceImage, as: 'images' }, { model: models.Location, as: 'location' }] },
      { model: models.BookingAddOn, as: 'addons' },
    ],
    order: [['start_at', 'DESC']],
    limit: 40,
  });
  const bySpace = new Map();
  for (const b of past) {
    if (!b.space || b.space.status !== 'active') continue;
    if (!bySpace.has(b.space_id)) bySpace.set(b.space_id, []);
    bySpace.get(b.space_id).push(b);
  }
  const mode = (arr) => {
    const counts = new Map();
    arr.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };
  return [...bySpace.values()].slice(0, limit).map((list) => {
    const last = list[0];
    return {
      space: { id: last.space.id, slug: last.space.slug, name: last.space.name, capacity: last.space.capacity,
        cover: (last.space.images || []).slice().sort((a, b) => a.sort - b.sort)[0]?.url, type: last.space.type?.name, location: last.space.location?.name },
      unit: mode(list.map((b) => b.unit)),
      start_time: mode(list.map((b) => DateTime.fromJSDate(b.start_at).setZone(tz).toFormat('HH:mm'))),
      duration_minutes: mode(list.map((b) => b.duration_minutes)),
      guest_count: mode(list.map((b) => b.guest_count)),
      addons: last.addons.filter((a) => a.add_on_id).map((a) => ({ add_on_id: a.add_on_id, quantity: a.quantity, name: a.name })),
      times_booked: list.length,
      last_booking_number: last.booking_number,
    };
  });
}

/** Background lifecycle: expiry, start, completion, reminders, review requests. */
export async function runLifecycle() {
  const settings = await getSettings();
  const now = new Date();
  let expired = 0;
  await sequelize.transaction(async (t) => { expired = await expireStaleHolds({ transaction: t }); });

  const include = [{ model: models.User, as: 'customer' }, { model: models.Space, as: 'space' }];

  const starting = await models.Booking.findAll({ where: { status: 'confirmed', start_at: { [Op.lte]: now }, end_at: { [Op.gt]: now } } });
  for (const b of starting) { await b.update({ status: 'active' }); await addEvent(b, 'started'); }

  const finishing = await models.Booking.findAll({ where: { status: { [Op.in]: ['confirmed', 'active'] }, end_at: { [Op.lte]: now } }, include });
  for (const b of finishing) {
    await sequelize.transaction(async (t) => {
      await b.update({ status: 'completed', review_requested_at: now }, { transaction: t });
      await models.CouponUsage.update({ status: 'redeemed' }, { where: { booking_id: b.id, status: 'reserved' }, transaction: t });
      await addEvent(b, 'completed', { transaction: t });
      await notify(b.customer, 'review_request', { booking_id: b.id, booking_number: b.booking_number, space_name: b.space?.name }, { transaction: t, link: `/account/bookings/${b.id}?review=1` });
    });
  }

  const horizon = new Date(now.getTime() + settings.notifications.reminder_hours_before * 3_600_000);
  const reminders = await models.Booking.findAll({
    where: { status: 'confirmed', reminder_sent_at: null, start_at: { [Op.gt]: now, [Op.lte]: horizon } }, include,
  });
  for (const b of reminders) {
    await sequelize.transaction(async (t) => {
      await b.update({ reminder_sent_at: now }, { transaction: t });
      await notify(b.customer, 'booking_reminder', { booking_id: b.id, booking_number: b.booking_number, space_name: b.space?.name, start_at: b.start_at }, { transaction: t, link: `/account/bookings/${b.id}` });
    });
  }
  return { expired, started: starting.length, completed: finishing.length, reminders: reminders.length };
}
