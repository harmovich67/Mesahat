import { QueryTypes, Op } from 'sequelize';
import { DateTime } from 'luxon';
import { models, sequelize } from '../models/index.js';
import { getSettings } from './settings.js';
import { dayWindow } from './availability.js';

const q = (sql, replacements) => sequelize.query(sql, { type: QueryTypes.SELECT, replacements });
const REAL = ['confirmed', 'active', 'completed'];

export function resolveRange({ range = '30d', from, to }, tz) {
  const today = DateTime.now().setZone(tz).startOf('day');
  let start;
  let end = today;
  if (range === 'today') start = today;
  else if (range === '7d') start = today.minus({ days: 6 });
  else if (range === '90d') start = today.minus({ days: 89 });
  else if (range === 'custom' && from && to) { start = DateTime.fromISO(from, { zone: tz }); end = DateTime.fromISO(to, { zone: tz }); }
  else start = today.minus({ days: 29 });
  return { start, end, startAt: start.toUTC().toJSDate(), endAt: end.plus({ days: 1 }).toUTC().toJSDate(), days: Math.round(end.diff(start, 'days').days) + 1 };
}

/** Occupancy engine: utilisation (booked unit-hours / available unit-hours) per space and per weekday×hour. */
export async function utilization({ start, end, tz, locationId }) {
  const spaces = await models.Space.findAll({
    where: { status: 'active', ...(locationId ? { location_id: locationId } : {}) },
    include: [{ model: models.AvailabilityRule, as: 'hours' }, { model: models.SpaceType, as: 'type' }, { model: models.Location, as: 'location' }],
  });
  const bookings = await models.Booking.findAll({
    where: {
      space_id: { [Op.in]: spaces.map((s) => s.id) },
      status: { [Op.in]: REAL },
      start_at: { [Op.lt]: end.plus({ days: 1 }).toJSDate() },
      end_at: { [Op.gt]: start.toJSDate() },
    },
    attributes: ['space_id', 'start_at', 'end_at'],
  });
  const bySpace = new Map();
  for (const b of bookings) {
    if (!bySpace.has(b.space_id)) bySpace.set(b.space_id, []);
    bySpace.get(b.space_id).push(b);
  }

  const heat = new Map(); // `${wd}|${h}` -> {booked, avail}
  const perSpace = [];
  const perSpaceHeat = {};
  for (const space of spaces) {
    let booked = 0;
    let avail = 0;
    const list = bySpace.get(space.id) || [];
    const sh = new Map();
    for (let d = start; d <= end; d = d.plus({ days: 1 })) {
      const iso = d.toISODate();
      const win = dayWindow(space.hours, iso, tz);
      if (!win) continue;
      const wd = d.weekday % 7;
      for (let h = Math.floor(win.open.hour); h < Math.ceil(win.close.hour + win.close.minute / 60 || 24); h += 1) {
        const cs = d.set({ hour: h });
        const ce = cs.plus({ hours: 1 });
        const lo = DateTime.max(cs, win.open);
        const hi = DateTime.min(ce, win.close);
        const open = Math.max(0, hi.diff(lo, 'minutes').minutes) / 60;
        if (!open) continue;
        let used = 0;
        for (const b of list) {
          const bs = DateTime.fromJSDate(b.start_at);
          const be = DateTime.fromJSDate(b.end_at);
          const ov = Math.min(be.toMillis(), hi.toMillis()) - Math.max(bs.toMillis(), lo.toMillis());
          if (ov > 0) used += ov / 3_600_000;
        }
        used = Math.min(used, open * space.units);
        const key = `${wd}|${h}`;
        const cell = heat.get(key) || { booked: 0, avail: 0 };
        cell.booked += used; cell.avail += open * space.units; heat.set(key, cell);
        const scell = sh.get(key) || { booked: 0, avail: 0 };
        scell.booked += used; scell.avail += open * space.units; sh.set(key, scell);
        booked += used; avail += open * space.units;
      }
    }
    perSpace.push({
      space_id: space.id, slug: space.slug, name: space.name, type: space.type?.name, location: space.location?.name,
      booked_hours: Math.round(booked * 10) / 10, available_hours: Math.round(avail * 10) / 10,
      occupancy: avail ? Math.round((booked / avail) * 1000) / 10 : 0,
    });
    perSpaceHeat[space.id] = [...sh.entries()].map(([k, v]) => {
      const [weekday, hour] = k.split('|').map(Number);
      return { weekday, hour, value: v.avail ? Math.round((v.booked / v.avail) * 100) : 0 };
    });
  }
  const cells = [...heat.entries()].map(([k, v]) => {
    const [weekday, hour] = k.split('|').map(Number);
    return { weekday, hour, value: v.avail ? Math.round((v.booked / v.avail) * 100) : 0, booked: Math.round(v.booked * 10) / 10 };
  });
  const totalBooked = perSpace.reduce((s, x) => s + x.booked_hours, 0);
  const totalAvail = perSpace.reduce((s, x) => s + x.available_hours, 0);

  const byHour = {};
  const byDay = {};
  for (const c of cells) {
    byHour[c.hour] = (byHour[c.hour] || 0) + c.booked;
    byDay[c.weekday] = (byDay[c.weekday] || 0) + c.booked;
  }
  const peak_hours = Object.entries(byHour).map(([hour, v]) => ({ hour: Number(hour), booked_hours: Math.round(v * 10) / 10 })).sort((a, b) => a.hour - b.hour);
  const peak_days = Object.entries(byDay).map(([weekday, v]) => ({ weekday: Number(weekday), booked_hours: Math.round(v * 10) / 10 })).sort((a, b) => a.weekday - b.weekday);

  const hot = cells.filter((c) => c.value >= 75).sort((a, b) => b.value - a.value).slice(0, 5);
  const cold = cells.filter((c) => c.value <= 20 && c.hour >= 9 && c.hour <= 19).sort((a, b) => a.value - b.value).slice(0, 5);
  return {
    occupancy: totalAvail ? Math.round((totalBooked / totalAvail) * 1000) / 10 : 0,
    per_space: perSpace.sort((a, b) => b.occupancy - a.occupancy),
    heatmap: cells,
    heatmap_by_space: perSpaceHeat,
    peak_hours,
    peak_days,
    insights: { raise_price: hot, promote: cold },
  };
}

export async function overview({ range, from, to, location }) {
  const settings = await getSettings();
  const tz = settings.general.timezone;
  const r = resolveRange({ range, from, to }, tz);
  const loc = location ? 'AND b.location_id = :location' : '';
  const rep = { start: r.startAt, end: r.endAt, tz, location };

  const [revenue, bookingsDaily, byStatus, methods, cancellations, customers, popular, monthly, byUnit] = await Promise.all([
    q(`SELECT to_char((p.reviewed_at AT TIME ZONE :tz)::date, 'YYYY-MM-DD') AS date,
              COALESCE(SUM(p.amount - COALESCE(p.refund_amount,0)),0)::float AS revenue, COUNT(*)::int AS payments
       FROM payments p JOIN bookings b ON b.id = p.booking_id
       WHERE p.status IN ('approved','refund_pending','refunded') AND p.reviewed_at >= :start AND p.reviewed_at < :end ${loc}
       GROUP BY 1 ORDER BY 1`, rep),
    q(`SELECT to_char((b.start_at AT TIME ZONE :tz)::date, 'YYYY-MM-DD') AS date, COUNT(*)::int AS bookings
       FROM bookings b WHERE b.start_at >= :start AND b.start_at < :end AND b.status IN ('confirmed','active','completed') ${loc}
       GROUP BY 1 ORDER BY 1`, rep),
    q(`SELECT b.status, COUNT(*)::int AS count FROM bookings b WHERE b.created_at >= :start AND b.created_at < :end ${loc} GROUP BY 1`, rep),
    q(`SELECT p.method, COUNT(*)::int AS count, COALESCE(SUM(p.amount),0)::float AS amount
       FROM payments p JOIN bookings b ON b.id = p.booking_id
       WHERE p.status IN ('approved','refund_pending','refunded') AND p.reviewed_at >= :start AND p.reviewed_at < :end ${loc} GROUP BY 1 ORDER BY 3 DESC`, rep),
    q(`SELECT to_char((b.cancelled_at AT TIME ZONE :tz)::date, 'YYYY-MM-DD') AS date, COUNT(*)::int AS cancelled,
              COALESCE(SUM(b.refund_amount),0)::float AS refunds
       FROM bookings b WHERE b.status = 'cancelled' AND b.cancelled_at >= :start AND b.cancelled_at < :end ${loc} GROUP BY 1 ORDER BY 1`, rep),
    q(`SELECT to_char((u.created_at AT TIME ZONE :tz)::date, 'YYYY-MM-DD') AS date, COUNT(*)::int AS new_customers
       FROM users u WHERE u.is_staff = false AND u.created_at >= :start AND u.created_at < :end GROUP BY 1 ORDER BY 1`, rep),
    q(`SELECT s.id, s.slug, s.name, COUNT(b.id)::int AS bookings, COALESCE(SUM(b.final_amount),0)::float AS revenue
       FROM spaces s LEFT JOIN bookings b ON b.space_id = s.id AND b.status IN ('confirmed','active','completed')
         AND b.start_at >= :start AND b.start_at < :end
       WHERE s.status = 'active' ${location ? 'AND s.location_id = :location' : ''} GROUP BY s.id ORDER BY bookings DESC, revenue DESC`, rep),
    q(`SELECT to_char(date_trunc('month', p.reviewed_at AT TIME ZONE :tz), 'YYYY-MM') AS month,
              COALESCE(SUM(p.amount - COALESCE(p.refund_amount,0)),0)::float AS revenue
       FROM payments p JOIN bookings b ON b.id = p.booking_id
       WHERE p.status IN ('approved','refund_pending','refunded') AND p.reviewed_at >= :monthStart ${loc} GROUP BY 1 ORDER BY 1`,
    { ...rep, monthStart: DateTime.now().setZone(tz).startOf('month').minus({ months: 5 }).toUTC().toJSDate() }),
    q(`SELECT b.unit, COUNT(*)::int AS count FROM bookings b WHERE b.status IN ('confirmed','active','completed')
       AND b.start_at >= :start AND b.start_at < :end ${loc} GROUP BY 1 ORDER BY 2 DESC`, rep),
  ]);

  // fill missing days so charts have a continuous axis
  const fill = (rows, key, zero) => {
    const m = new Map(rows.map((x) => [x.date, x]));
    const out = [];
    for (let d = r.start; d <= r.end; d = d.plus({ days: 1 })) out.push({ date: d.toISODate(), ...zero, ...(m.get(d.toISODate()) || {}) });
    return out;
  };
  const revSeries = fill(revenue, 'revenue', { revenue: 0, payments: 0 });
  const bookSeries = fill(bookingsDaily, 'bookings', { bookings: 0 });
  let cum = (await q('SELECT COUNT(*)::int AS n FROM users WHERE is_staff = false AND created_at < :start', rep))[0].n;
  const custSeries = fill(customers, 'new_customers', { new_customers: 0 }).map((x) => { cum += x.new_customers; return { ...x, total: cum }; });
  const cancSeries = fill(cancellations, 'cancelled', { cancelled: 0, refunds: 0 });

  const util = await utilization({ start: r.start, end: r.end, tz, locationId: location });
  const totalBookings = byStatus.reduce((s, x) => s + x.count, 0);
  const cancelled = byStatus.find((x) => x.status === 'cancelled')?.count || 0;

  return {
    range: { from: r.start.toISODate(), to: r.end.toISODate(), days: r.days },
    totals: {
      revenue: revSeries.reduce((s, x) => s + x.revenue, 0),
      bookings: bookSeries.reduce((s, x) => s + x.bookings, 0),
      new_customers: custSeries.reduce((s, x) => s + x.new_customers, 0),
      cancellation_rate: totalBookings ? Math.round((cancelled / totalBookings) * 1000) / 10 : 0,
      occupancy: util.occupancy,
      avg_booking_value: (() => {
        const n = revSeries.reduce((s, x) => s + x.payments, 0);
        return n ? Math.round(revSeries.reduce((s, x) => s + x.revenue, 0) / n) : 0;
      })(),
    },
    revenue_daily: revSeries,
    revenue_monthly: monthly,
    bookings_daily: bookSeries,
    bookings_by_status: byStatus,
    bookings_by_unit: byUnit,
    payment_methods: methods,
    cancellations: { series: cancSeries, total: cancelled, refunds: cancSeries.reduce((s, x) => s + x.refunds, 0) },
    customer_growth: custSeries,
    popular_spaces: popular.slice(0, 8),
    least_used_spaces: [...popular].reverse().slice(0, 5),
    occupancy: util,
  };
}

/** Operational snapshot for the admin home page. */
export async function dashboard() {
  const settings = await getSettings();
  const tz = settings.general.timezone;
  const today = DateTime.now().setZone(tz).startOf('day');
  const s = today.toUTC().toJSDate();
  const e = today.plus({ days: 1 }).toUTC().toJSDate();
  const yS = today.minus({ days: 1 }).toUTC().toJSDate();

  const [[todayBookings], [yBookings], [rev], [yRev], [pending], [activeSpaces], [cancelled], [pendingReviews]] = await Promise.all([
    q(`SELECT COUNT(*)::int AS n FROM bookings WHERE start_at >= :s AND start_at < :e AND status IN ('payment_under_review','pending_payment','confirmed','active','completed')`, { s, e }),
    q(`SELECT COUNT(*)::int AS n FROM bookings WHERE start_at >= :s AND start_at < :e AND status IN ('payment_under_review','pending_payment','confirmed','active','completed')`, { s: yS, e: s }),
    q(`SELECT COALESCE(SUM(amount - COALESCE(refund_amount,0)),0)::float AS n FROM payments WHERE status IN ('approved','refund_pending','refunded') AND reviewed_at >= :s AND reviewed_at < :e`, { s, e }),
    q(`SELECT COALESCE(SUM(amount - COALESCE(refund_amount,0)),0)::float AS n FROM payments WHERE status IN ('approved','refund_pending','refunded') AND reviewed_at >= :s AND reviewed_at < :e`, { s: yS, e: s }),
    q(`SELECT COUNT(*)::int AS n FROM payments WHERE status = 'under_review'`, {}),
    q(`SELECT COUNT(*)::int AS n FROM spaces WHERE status = 'active'`, {}),
    q(`SELECT COUNT(*)::int AS n FROM bookings WHERE status = 'cancelled' AND cancelled_at >= :s AND cancelled_at < :e`, { s, e }),
    q(`SELECT COUNT(*)::int AS n FROM reviews WHERE status = 'pending'`, {}),
  ]);
  const util = await utilization({ start: today, end: today, tz });
  const upcoming = await models.Booking.findAll({
    where: { start_at: { [Op.gte]: new Date() }, status: { [Op.in]: ['confirmed', 'payment_under_review', 'pending_payment'] } },
    order: [['start_at', 'ASC']], limit: 8,
    include: [{ model: models.Space, as: 'space', attributes: ['id', 'name', 'slug'] }, { model: models.User, as: 'customer', attributes: ['id', 'name'] }, { model: models.Payment, as: 'payment', attributes: ['status'] }],
  });
  const week = await overview({ range: '7d' });
  return {
    today_bookings: todayBookings.n, yesterday_bookings: yBookings.n,
    today_revenue: rev.n, yesterday_revenue: yRev.n,
    pending_payments: pending.n,
    active_spaces: activeSpaces.n,
    occupancy_today: util.occupancy,
    cancelled_today: cancelled.n,
    pending_reviews: pendingReviews.n,
    upcoming: upcoming.map((b) => ({
      id: b.id, booking_number: b.booking_number, start_at: b.start_at, end_at: b.end_at, status: b.status,
      payment_status: b.payment?.status, final_amount: Number(b.final_amount), space: b.space, customer: b.customer && { id: b.customer.id, name: b.customer.name },
    })),
    revenue_week: week.revenue_daily,
    status_mix: week.bookings_by_status,
  };
}
