import { Op } from 'sequelize';
import { DateTime } from 'luxon';
import { models, BLOCKING_STATUSES } from '../models/index.js';
import { fail } from '../utils/errors.js';
import { atTime, overlaps, toJSDate } from '../utils/time.js';
import { expireStaleHolds } from './holds.js';

const SINGLE_DAY_UNITS = ['hourly', 'half_day', 'full_day', 'daily'];
export const UNIT_SPAN_DAYS = { weekly: 7, monthly: 30 };

function ceilTo(dt, stepMinutes) {
  const mins = dt.hour * 60 + dt.minute + (dt.second || dt.millisecond ? 1 : 0);
  const rounded = Math.ceil(mins / stepMinutes) * stepMinutes;
  return dt.startOf('day').plus({ minutes: rounded });
}

/** Operating window for a calendar date, or null when the space is closed that day. */
export function dayWindow(rules, dateISO, tz) {
  const wd = DateTime.fromISO(dateISO, { zone: tz }).weekday % 7;
  const rule = rules.find((r) => r.weekday === wd);
  if (!rule || rule.is_closed) return null;
  return { open: atTime(dateISO, rule.opens, tz), close: atTime(dateISO, rule.closes, tz) };
}

/**
 * Turns a customer's intent (unit + date + start time + duration) into an exact
 * [start, end) range. The server alone decides start/end — clients never send timestamps.
 */
export function resolveRange({ space, rules, pricing, unit, date, startTime, durationMinutes, settings, relaxed = false, now = DateTime.now() }) {
  const tz = settings.general.timezone;
  const b = settings.booking;
  if (!pricing.some((p) => p.unit === unit && p.kind === 'base' && p.active)) fail('UNIT_NOT_SUPPORTED');

  const today = now.setZone(tz).startOf('day');
  const day = DateTime.fromISO(date, { zone: tz }).startOf('day');
  if (!day.isValid) fail('VALIDATION');
  if (day < today) fail('PAST_TIME');
  if (!relaxed && day > today.plus({ days: b.advance_booking_days })) fail('TOO_FAR_AHEAD');

  const win = dayWindow(rules, date, tz);
  if (!win) fail('SPACE_CLOSED');
  const earliest = ceilTo(now.setZone(tz).plus({ minutes: relaxed ? 0 : b.min_lead_minutes }), b.slot_step_minutes);
  let start;
  let end;
  let minutes;

  if (unit === 'hourly' || unit === 'half_day') {
    if (!startTime) fail('VALIDATION');
    start = atTime(date, startTime, tz);
    minutes = unit === 'half_day' ? b.half_day_hours * 60 : Number(durationMinutes);
    if (!Number.isInteger(minutes) || minutes % b.slot_step_minutes !== 0) fail('DURATION_INVALID');
    if (unit === 'hourly' && (minutes < b.min_duration_minutes || minutes > b.max_duration_minutes)) fail('DURATION_INVALID');
    if (start.minute % b.slot_step_minutes !== 0) fail('VALIDATION');
    end = start.plus({ minutes });
    if (start < win.open || end > win.close) fail('OUTSIDE_HOURS');
    if (relaxed ? end <= now.setZone(tz) : start < earliest) fail('PAST_TIME');
  } else {
    // Whole-day style units start at opening time (or "now" if already open today).
    start = day.equals(today) && earliest > win.open ? earliest : win.open;
    if (start >= win.close) fail('PAST_TIME');
    const span = UNIT_SPAN_DAYS[unit] || 1;
    const lastISO = day.plus({ days: span - 1 }).toISODate();
    const lastWin = dayWindow(rules, lastISO, tz) || { close: atTime(lastISO, '21:00', tz) };
    end = lastWin.close;
    minutes = Math.round(end.diff(start, 'minutes').minutes);
  }
  return { start, end, durationMinutes: minutes, date };
}

async function loadBusy({ space, from, to, transaction }) {
  const [bookings, blocks] = await Promise.all([
    models.Booking.findAll({
      where: {
        space_id: space.id,
        status: { [Op.in]: BLOCKING_STATUSES },
        start_at: { [Op.lt]: toJSDate(to) },
        end_at: { [Op.gt]: toJSDate(from) },
      },
      attributes: ['id', 'start_at', 'end_at', 'unit_slot'],
      transaction,
    }),
    models.BlockedPeriod.findAll({
      where: {
        [Op.or]: [{ space_id: space.id }, { space_id: null, location_id: space.location_id }],
        start_at: { [Op.lt]: toJSDate(to) },
        end_at: { [Op.gt]: toJSDate(from) },
      },
      transaction,
    }),
  ]);
  return { bookings, blocks };
}

/**
 * Authoritative availability check. MUST be called inside a transaction that holds a row lock on the
 * space (see lockSpace) — then concurrent requests are serialised and the DB exclusion constraint
 * acts as a final backstop. Returns the unit_slot to assign.
 */
export async function reserveSlot({ space, start, end, transaction, excludeBookingId }) {
  const s = toJSDate(start);
  const e = toJSDate(end);
  const pad = (space.buffer_minutes || 0) * 60_000;

  const blocked = await models.BlockedPeriod.findOne({
    where: {
      [Op.or]: [{ space_id: space.id }, { space_id: null, location_id: space.location_id }],
      start_at: { [Op.lt]: e }, end_at: { [Op.gt]: s },
    },
    transaction,
  });
  if (blocked) fail('SPACE_BLOCKED');

  const clash = await models.Booking.findAll({
    where: {
      space_id: space.id,
      status: { [Op.in]: BLOCKING_STATUSES },
      start_at: { [Op.lt]: new Date(e.getTime() + pad) },
      end_at: { [Op.gt]: new Date(s.getTime() - pad) },
      ...(excludeBookingId ? { id: { [Op.ne]: excludeBookingId } } : {}),
    },
    attributes: ['unit_slot'],
    transaction,
  });
  const used = new Set(clash.map((c) => c.unit_slot));
  for (let slot = 1; slot <= space.units; slot += 1) if (!used.has(slot)) return slot;
  return fail('SPACE_UNAVAILABLE');
}

/** Serialises all reservation attempts for one space. Also clears stale payment holds first. */
export async function lockSpace(spaceId, transaction) {
  const space = await models.Space.findByPk(spaceId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!space) fail('NOT_FOUND');
  await expireStaleHolds({ transaction, spaceId });
  return space;
}

const levelFor = (free, total, remainingRatio = 1) => {
  if (free === 0) return 'unavailable';
  if (total && free / total <= 0.34) return 'limited';
  if (remainingRatio <= 0.25) return 'limited';
  return 'available';
};

/**
 * "Smart Availability": per-day level (available / limited / unavailable) for a month-ish range,
 * optionally with exact time-slot detail for one date.
 */
export async function availabilityReport({ space, rules, pricing, settings, unit = 'hourly', durationMinutes = 60, from, to, detailDate, now = DateTime.now() }) {
  const tz = settings.general.timezone;
  const b = settings.booking;
  const step = b.slot_step_minutes;
  const nowTz = now.setZone(tz);
  const today = nowTz.startOf('day');
  const horizon = today.plus({ days: b.advance_booking_days });
  const earliest = ceilTo(nowTz.plus({ minutes: b.min_lead_minutes }), step);

  const first = DateTime.fromISO(from, { zone: tz }).startOf('day');
  const last = DateTime.fromISO(to, { zone: tz }).startOf('day');
  if (!first.isValid || !last.isValid || last < first || last.diff(first, 'days').days > 62) fail('VALIDATION');

  const span = UNIT_SPAN_DAYS[unit] || 1;
  const { bookings, blocks } = await loadBusy({
    space, from: first.startOf('day'), to: last.plus({ days: span + 1 }).endOf('day'),
  });
  const busy = bookings.map((x) => ({ start: DateTime.fromJSDate(x.start_at), end: DateTime.fromJSDate(x.end_at) }));
  const blk = blocks.map((x) => ({ start: DateTime.fromJSDate(x.start_at), end: DateTime.fromJSDate(x.end_at), reason: x.reason }));
  const pad = space.buffer_minutes || 0;

  const slotInfo = (start, end) => {
    const blocked = blk.find((x) => overlaps(start, end, x.start, x.end));
    if (blocked) return { ok: false, remaining: 0, reason: blocked.reason };
    const count = busy.filter((x) => overlaps(start, end, x.start.minus({ minutes: pad }), x.end.plus({ minutes: pad }))).length;
    return { ok: count < space.units, remaining: Math.max(0, space.units - count) };
  };

  const supported = pricing.some((p) => p.unit === unit && p.kind === 'base' && p.active);
  const days = [];
  let detail = null;
  for (let d = first; d <= last; d = d.plus({ days: 1 })) {
    const iso = d.toISODate();
    const base = { date: iso, level: 'unavailable', free: 0, total: 0, remaining_units: 0 };
    if (!supported) { days.push({ ...base, reason: 'unit' }); continue; }
    if (d < today || d > horizon) { days.push({ ...base, reason: d < today ? 'past' : 'far' }); continue; }
    const win = dayWindow(rules, iso, tz);
    if (!win) { days.push({ ...base, reason: 'closed', closed: true }); continue; }

    let candidates = [];
    if (unit === 'hourly' || unit === 'half_day') {
      const minutes = unit === 'half_day' ? b.half_day_hours * 60 : durationMinutes;
      for (let s = win.open; s.plus({ minutes }) <= win.close; s = s.plus({ minutes: step })) {
        const e = s.plus({ minutes });
        if (s < earliest) { candidates.push({ time: s.toFormat('HH:mm'), available: false, remaining: 0, past: true, level: 'unavailable' }); continue; }
        const info = slotInfo(s, e);
        candidates.push({
          time: s.toFormat('HH:mm'),
          available: info.ok,
          remaining: info.remaining,
          reason: info.reason,
          level: !info.ok ? 'unavailable' : space.units > 1 && info.remaining / space.units <= 0.25 ? 'limited' : 'available',
        });
      }
    } else {
      const start = d.equals(today) && earliest > win.open ? earliest : win.open;
      const lastISO = d.plus({ days: span - 1 }).toISODate();
      const lw = dayWindow(rules, lastISO, tz) || { close: atTime(lastISO, '21:00', tz) };
      if (start < lw.close) {
        const info = slotInfo(start, lw.close);
        candidates = [{ time: start.toFormat('HH:mm'), available: info.ok, remaining: info.remaining }];
      }
    }
    const free = candidates.filter((c) => c.available).length;
    const minRemaining = free ? Math.min(...candidates.filter((c) => c.available).map((c) => c.remaining)) : 0;
    days.push({
      date: iso,
      level: levelFor(free, candidates.length, space.units > 1 ? minRemaining / space.units : 1),
      free,
      total: candidates.length,
      remaining_units: minRemaining,
      open: win.open.toFormat('HH:mm'),
      close: win.close.toFormat('HH:mm'),
    });
    if (detailDate === iso) detail = { date: iso, open: win.open.toFormat('HH:mm'), close: win.close.toFormat('HH:mm'), slots: candidates };
  }
  return { unit, duration_minutes: durationMinutes, days, detail };
}

/** Cheap availability probe used by the public search filter. */
export async function isRangeAvailable({ space, start, end }) {
  const { bookings, blocks } = await loadBusy({ space, from: start, to: end });
  const s = start.toJSDate();
  const e = end.toJSDate();
  if (blocks.some((x) => x.start_at < e && x.end_at > s)) return { ok: false, remaining: 0 };
  const count = bookings.filter((x) => x.start_at < e && x.end_at > s).length;
  return { ok: count < space.units, remaining: Math.max(0, space.units - count) };
}
