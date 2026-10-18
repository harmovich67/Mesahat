import { Op, QueryTypes } from 'sequelize';
import { DateTime } from 'luxon';
import { models, sequelize } from '../../models/index.js';
import { fail } from '../../utils/errors.js';
import { serializeBooking, serializePayment } from '../../utils/serializers.js';
import { atTime, toJSDate } from '../../utils/time.js';
import { getSettings } from '../../services/settings.js';
import * as reports from '../../services/reports.js';
import * as bookingSvc from '../../services/bookings.js';
import * as paymentSvc from '../../services/payments.js';
import { audit } from '../../services/audit.js';
import { hashPassword } from '../../services/auth.js';
import { refreshRating } from '../../services/spaces.js';
import { can } from '../../middleware/index.js';
import crypto from 'node:crypto';

const like = (s) => `%${String(s).replace(/[%_]/g, '\\$&')}%`;

/* ------------------------------ dashboard & reports ------------------------------ */
export const dashboard = async (_req, res) => res.json(await reports.dashboard());
export const reportsOverview = async (req, res) => res.json(await reports.overview(req.query));

/* ------------------------------ bookings ------------------------------ */
async function attachReceipts(bookings) {
  const ids = bookings.map((b) => b.payment?.id).filter(Boolean);
  if (!ids.length) return;
  const receipts = await models.PaymentReceipt.findAll({ where: { payment_id: { [Op.in]: ids } }, attributes: ['id', 'payment_id', 'is_current', 'original_name', 'mime_type', 'file_size', 'created_at'] });
  for (const b of bookings) if (b.payment) b.payment.setDataValue('receipts', receipts.filter((r) => r.payment_id === b.payment.id));
}

export const bookingsList = async (req, res) => {
  const { q, status, payment_status: payStatus, location, space, type, from, to, scope, page, limit } = req.query;
  const settings = await getSettings();
  const tz = settings.general.timezone;
  const where = {};
  if (status) where.status = { [Op.in]: status.split(',') };
  if (location) where.location_id = location;
  if (space) where.space_id = space;
  if (from || to) {
    where.start_at = {};
    if (from) where.start_at[Op.gte] = toJSDate(DateTime.fromISO(from, { zone: tz }).startOf('day'));
    if (to) where.start_at[Op.lt] = toJSDate(DateTime.fromISO(to, { zone: tz }).plus({ days: 1 }).startOf('day'));
  }
  if (scope === 'today') {
    const today = DateTime.now().setZone(tz).startOf('day');
    where.start_at = { [Op.gte]: toJSDate(today), [Op.lt]: toJSDate(today.plus({ days: 1 })) };
  } else if (scope === 'upcoming') where.start_at = { [Op.gte]: new Date() };
  if (q) {
    where[Op.or] = [
      { booking_number: { [Op.iLike]: like(q) } },
      { '$customer.name$': { [Op.iLike]: like(q) } },
      { '$customer.email$': { [Op.iLike]: like(q) } },
      { '$customer.phone$': { [Op.iLike]: like(q) } },
    ];
  }
  const include = [
    { model: models.Space, as: 'space', attributes: ['id', 'slug', 'name', 'capacity'], include: [{ model: models.SpaceType, as: 'type', attributes: ['key', 'name', 'color'], ...(type ? { where: { key: type } } : {}) }] },
    { model: models.Location, as: 'location', attributes: ['id', 'slug', 'name', 'city'] },
    { model: models.User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
    { model: models.Payment, as: 'payment', ...(payStatus ? { where: { status: { [Op.in]: payStatus.split(',') } } } : {}) },
  ];
  const { rows, count } = await models.Booking.findAndCountAll({
    where, include, order: [['start_at', 'DESC']], limit, offset: (page - 1) * limit, subQuery: false, distinct: true,
  });
  await attachReceipts(rows);
  res.json({ items: rows.map((b) => serializeBooking(b, { admin: true })), total: count, page, limit });
};

export const bookingGet = async (req, res) => {
  const b = await bookingSvc.loadBooking(req.params.id);
  if (!b) fail('NOT_FOUND');
  b.review = await models.Review.findOne({ where: { booking_id: b.id } });
  res.json({ booking: serializeBooking(b, { admin: true }), cancellation: bookingSvc.cancellationQuote(b, await getSettings()) });
};

export const bookingCreateManual = async (req, res) => {
  const { customer_id: customerId, customer, mark_paid: markPaid, ...input } = req.body;
  let userId = customerId;
  if (!userId) {
    if (!customer) fail('VALIDATION', { details: { customer: 'اختر عميلًا أو أدخل بياناته' } });
    // Walk-in / phone customers get a lightweight account (no usable password).
    const email = customer.email || `walkin-${crypto.randomBytes(5).toString('hex')}@walkin.workora.local`;
    const found = await models.User.findOne({ where: { email } });
    userId = found?.id || (await models.User.create({ name: customer.name, email, phone: customer.phone, password_hash: await hashPassword(crypto.randomBytes(18).toString('hex')) })).id;
  }
  const booking = await bookingSvc.createBooking({ customerId: userId, input, source: 'admin', actor: req.user, markPaid, ip: req.ip });
  res.status(201).json({ booking: serializeBooking(booking, { admin: true }) });
};

export const bookingPatch = async (req, res) => {
  const b = await bookingSvc.updateBooking({ bookingId: req.params.id, actor: req.user, patch: req.body, ip: req.ip });
  res.json({ booking: serializeBooking(b, { admin: true }) });
};

export const bookingCancel = async (req, res) => {
  const b = await bookingSvc.cancelBooking({ bookingId: req.params.id, actor: req.user, isAdmin: true, reason: req.body.reason, refundPercentOverride: req.body.refund_percent, ip: req.ip });
  res.json({ booking: serializeBooking(b, { admin: true }) });
};

/* ------------------------------ calendar & blocks ------------------------------ */
const STATUS_COLOR = {
  pending_payment: '#C9803A', payment_under_review: '#B7791F', confirmed: '#1F4D3F', active: '#2F7D5B', completed: '#6B7A72', cancelled: '#B4443A', expired: '#9CA3AF', rejected: '#B4443A',
};
export const calendar = async (req, res) => {
  const { from, to, location, space, type, status } = req.query;
  const start = from ? DateTime.fromISO(from) : DateTime.now().minus({ days: 7 });
  const end = to ? DateTime.fromISO(to) : DateTime.now().plus({ days: 30 });
  const where = { start_at: { [Op.lt]: end.toJSDate() }, end_at: { [Op.gt]: start.toJSDate() } };
  where.status = { [Op.in]: status ? status.split(',') : ['pending_payment', 'payment_under_review', 'confirmed', 'active', 'completed'] };
  if (location) where.location_id = location;
  if (space) where.space_id = space;
  const bookings = await models.Booking.findAll({
    where,
    include: [
      { model: models.Space, as: 'space', attributes: ['id', 'name'], include: [{ model: models.SpaceType, as: 'type', attributes: ['key'], ...(type ? { where: { key: type } } : {}) }] },
      { model: models.User, as: 'customer', attributes: ['id', 'name'] },
    ],
  });
  const blockWhere = { start_at: { [Op.lt]: end.toJSDate() }, end_at: { [Op.gt]: start.toJSDate() } };
  if (space) blockWhere[Op.or] = [{ space_id: space }, { space_id: null }];
  if (location) blockWhere.location_id = location;
  const blocks = await models.BlockedPeriod.findAll({ where: blockWhere, include: [{ model: models.Space, as: 'space', attributes: ['id', 'name'] }] });
  res.json({
    events: bookings.filter((b) => b.space).map((b) => ({
      id: b.id, kind: 'booking', title: `${b.customer?.name || ''} · ${b.space.name.ar}`, start: b.start_at, end: b.end_at, status: b.status,
      booking_number: b.booking_number, space_id: b.space_id, space_name: b.space.name, customer_name: b.customer?.name, color: STATUS_COLOR[b.status],
    })),
    blocks: blocks.map((x) => ({
      id: x.id, kind: 'block', title: x.reason === 'maintenance' ? 'صيانة' : 'محجوب', start: x.start_at, end: x.end_at, reason: x.reason, note: x.note,
      space_id: x.space_id, location_id: x.location_id, space_name: x.space?.name, color: x.reason === 'maintenance' ? '#7C5C3B' : '#4B5563',
    })),
  });
};

export const blockCreate = async (req, res) => {
  const settings = await getSettings();
  const tz = settings.general.timezone;
  const { space_id: spaceId, location_id: locId, date, start_time: st, end_time: et, end_date: endDate, reason, note } = req.body;
  const start = atTime(date, st, tz);
  const end = atTime(endDate || date, et, tz);
  if (end <= start) fail('VALIDATION');
  let locationId = locId;
  if (spaceId) {
    const sp = await models.Space.findByPk(spaceId);
    if (!sp) fail('NOT_FOUND');
    locationId = sp.location_id;
  }
  const block = await sequelize.transaction(async (t) => {
    if (spaceId) await models.Space.findByPk(spaceId, { transaction: t, lock: t.LOCK.UPDATE });
    // refuse to block time that already has live bookings: they must be moved/cancelled first
    const clash = await models.Booking.count({
      where: {
        ...(spaceId ? { space_id: spaceId } : { location_id: locationId }),
        status: { [Op.in]: ['pending_payment', 'payment_under_review', 'confirmed', 'active'] },
        start_at: { [Op.lt]: toJSDate(end) }, end_at: { [Op.gt]: toJSDate(start) },
      }, transaction: t,
    });
    if (clash) fail('SPACE_UNAVAILABLE', { message: 'توجد حجوزات نشطة في هذه الفترة. قم بنقلها أو إلغائها أولًا.' });
    const created = await models.BlockedPeriod.create({ space_id: spaceId || null, location_id: locationId, start_at: toJSDate(start), end_at: toJSDate(end), reason, note, created_by: req.user.id }, { transaction: t });
    await audit(req.user, reason === 'maintenance' ? 'space.maintenance' : 'space.block', { entityType: 'space', entityId: spaceId || locationId, label: note || reason, meta: { start: start.toISO(), end: end.toISO() }, ip: req.ip, transaction: t });
    return created;
  });
  res.status(201).json({ block });
};

export const blockDelete = async (req, res) => {
  const b = await models.BlockedPeriod.findByPk(req.params.id);
  if (!b) fail('NOT_FOUND');
  await b.destroy();
  await audit(req.user, 'space.unblock', { entityType: 'space', entityId: b.space_id || b.location_id, label: b.note || b.reason, ip: req.ip });
  res.json({ ok: true });
};

/* ------------------------------ payments (Payment Verification Center) ------------------------------ */
const paymentRow = (p) => ({
  ...serializePayment(p),
  booking: {
    id: p.booking.id, booking_number: p.booking.booking_number, status: p.booking.status, start_at: p.booking.start_at, end_at: p.booking.end_at,
    final_amount: Number(p.booking.final_amount), guest_count: p.booking.guest_count, coupon_code: p.booking.coupon_code,
    space: p.booking.space && { id: p.booking.space.id, name: p.booking.space.name, slug: p.booking.space.slug },
    location: p.booking.location && { name: p.booking.location.name },
    customer: p.booking.customer && { id: p.booking.customer.id, name: p.booking.customer.name, email: p.booking.customer.email, phone: p.booking.customer.phone },
  },
});

export const paymentsList = async (req, res) => {
  const { status = 'under_review', q, page, limit } = req.query;
  const where = {};
  if (status !== 'all') where.status = { [Op.in]: status.split(',') };
  const bookingWhere = q ? { [Op.or]: [{ booking_number: { [Op.iLike]: like(q) } }, { '$booking.customer.name$': { [Op.iLike]: like(q) } }] } : undefined;
  const { rows, count } = await models.Payment.findAndCountAll({
    where: { ...where, ...(q ? { [Op.or]: [{ transfer_reference: { [Op.iLike]: like(q) } }, ...bookingWhere[Op.or]] } : {}) },
    include: [
      { model: models.Booking, as: 'booking', include: [{ model: models.Space, as: 'space', attributes: ['id', 'name', 'slug'] }, { model: models.Location, as: 'location', attributes: ['name'] }, { model: models.User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] }] },
      { model: models.PaymentReceipt, as: 'receipts', attributes: ['id', 'is_current', 'original_name', 'mime_type', 'file_size', 'created_at'] },
      { model: models.User, as: 'reviewer', attributes: ['id', 'name'] },
    ],
    order: [[status === 'under_review' ? 'submitted_at' : 'updated_at', status === 'under_review' ? 'ASC' : 'DESC']],
    limit, offset: (page - 1) * limit, subQuery: false, distinct: true,
  });
  const counts = await models.Payment.findAll({ attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'n']], group: ['status'], raw: true });
  res.json({ items: rows.map(paymentRow), total: count, counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) });
};

export const paymentGet = async (req, res) => {
  const p = await paymentSvc.paymentById(req.params.id);
  if (!p) fail('NOT_FOUND');
  res.json({ payment: paymentRow(p), booking: serializeBooking(p.booking, { admin: true }) });
};
export const paymentApprove = async (req, res) => {
  const p = await paymentSvc.approvePayment({ paymentId: req.params.id, admin: req.user, note: req.body.note, ip: req.ip });
  res.json({ payment: paymentRow(p) });
};
export const paymentReject = async (req, res) => {
  const p = await paymentSvc.rejectPayment({ paymentId: req.params.id, admin: req.user, reason: req.body.reason, ip: req.ip });
  res.json({ payment: paymentRow(p) });
};
export const paymentRequestNew = async (req, res) => {
  const p = await paymentSvc.requestNewReceipt({ paymentId: req.params.id, admin: req.user, reason: req.body.reason, ip: req.ip });
  res.json({ payment: paymentRow(p) });
};
export const paymentRefund = async (req, res) => {
  const p = await paymentSvc.markRefunded({ paymentId: req.params.id, admin: req.user, ip: req.ip });
  res.json({ payment: paymentRow(p) });
};

/* ------------------------------ customers ------------------------------ */
export const customersList = async (req, res) => {
  const { q, page, limit } = req.query;
  const rows = await sequelize.query(`
    SELECT u.id, u.name, u.email, u.phone, u.status, u.company, u.created_at,
      (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id)::int AS bookings_count,
      (SELECT COALESCE(SUM(p.amount - COALESCE(p.refund_amount,0)),0) FROM payments p JOIN bookings b ON b.id = p.booking_id
         WHERE b.user_id = u.id AND p.status IN ('approved','refund_pending','refunded'))::float AS total_spend,
      (SELECT MAX(b.start_at) FROM bookings b WHERE b.user_id = u.id) AS last_booking_at,
      (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id)::int AS reviews_count
    FROM users u
    WHERE u.is_staff = false AND (:q::text IS NULL OR u.name ILIKE :like OR u.email ILIKE :like OR u.phone ILIKE :like)
    ORDER BY last_booking_at DESC NULLS LAST, u.created_at DESC
    LIMIT :limit OFFSET :offset`, {
    type: QueryTypes.SELECT, replacements: { q: q || null, like: like(q || ''), limit, offset: (page - 1) * limit },
  });
  const [{ n }] = await sequelize.query('SELECT COUNT(*)::int AS n FROM users u WHERE u.is_staff = false AND (:q::text IS NULL OR u.name ILIKE :like OR u.email ILIKE :like OR u.phone ILIKE :like)', { type: QueryTypes.SELECT, replacements: { q: q || null, like: like(q || '') } });
  res.json({ items: rows, total: n, page, limit });
};

/** Customer profile for admins. Receipt files are intentionally NOT exposed here — only payment metadata. */
export const customerGet = async (req, res) => {
  const user = await models.User.findOne({ where: { id: req.params.id, is_staff: false } });
  if (!user) fail('NOT_FOUND');
  const bookings = await models.Booking.findAll({
    where: { user_id: user.id }, order: [['start_at', 'DESC']], limit: 100,
    include: [{ model: models.Space, as: 'space', attributes: ['id', 'name', 'slug'] }, { model: models.Payment, as: 'payment' }],
  });
  const reviews = await models.Review.findAll({ where: { user_id: user.id }, include: [{ model: models.Space, as: 'space', attributes: ['id', 'name'] }], order: [['created_at', 'DESC']] });
  res.json({
    customer: { id: user.id, name: user.name, email: user.email, phone: user.phone, status: user.status, company: user.company, created_at: user.createdAt, last_login_at: user.last_login_at },
    bookings: bookings.map((b) => ({
      id: b.id, booking_number: b.booking_number, status: b.status, start_at: b.start_at, final_amount: Number(b.final_amount), space: b.space,
      payment: b.payment && { status: b.payment.status, method: b.payment.method, amount: Number(b.payment.amount), submitted_at: b.payment.submitted_at },
    })),
    reviews,
  });
};

export const customerStatus = async (req, res) => {
  const user = await models.User.findOne({ where: { id: req.params.id, is_staff: false } });
  if (!user) fail('NOT_FOUND');
  const status = req.body.status === 'suspended' ? 'suspended' : 'active';
  await user.update({ status });
  await audit(req.user, status === 'suspended' ? 'customer.suspend' : 'customer.activate', { entityType: 'customer', entityId: user.id, label: user.name, ip: req.ip });
  res.json({ ok: true, status });
};

/* ------------------------------ reviews ------------------------------ */
export const reviewsList = async (req, res) => {
  const where = req.query.status ? { status: req.query.status } : {};
  const rows = await models.Review.findAll({
    where, order: [['created_at', 'DESC']], limit: 200,
    include: [{ model: models.User, as: 'author', attributes: ['id', 'name'] }, { model: models.Space, as: 'space', attributes: ['id', 'name'] }, { model: models.Booking, as: 'booking', attributes: ['booking_number'] }],
  });
  res.json({ items: rows });
};
export const reviewModerate = async (req, res) => {
  const review = await models.Review.findByPk(req.params.id);
  if (!review) fail('NOT_FOUND');
  await sequelize.transaction(async (t) => {
    const patch = {};
    if (['approved', 'hidden', 'pending'].includes(req.body.status)) patch.status = req.body.status;
    if (typeof req.body.featured === 'boolean') patch.featured = req.body.featured;
    await review.update(patch, { transaction: t });
    await refreshRating(review.space_id, t);
    await audit(req.user, 'review.moderate', { entityType: 'review', entityId: review.id, meta: patch, ip: req.ip, transaction: t });
  });
  res.json({ review });
};
export const reviewDelete = async (req, res) => {
  const review = await models.Review.findByPk(req.params.id);
  if (!review) fail('NOT_FOUND');
  await sequelize.transaction(async (t) => {
    await review.destroy({ transaction: t });
    await refreshRating(review.space_id, t);
    await audit(req.user, 'review.delete', { entityType: 'review', entityId: review.id, ip: req.ip, transaction: t });
  });
  res.json({ ok: true });
};

/* ------------------------------ audit log ------------------------------ */
export const auditList = async (req, res) => {
  const { q, page, limit } = req.query;
  const where = q ? { [Op.or]: [{ action: { [Op.iLike]: like(q) } }, { actor_name: { [Op.iLike]: like(q) } }, { entity_label: { [Op.iLike]: like(q) } }] } : {};
  const { rows, count } = await models.AuditLog.findAndCountAll({ where, order: [['created_at', 'DESC']], limit, offset: (page - 1) * limit });
  res.json({ items: rows, total: count });
};

/* ------------------------------ global search (command palette) ------------------------------ */
export const search = async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ bookings: [], customers: [], spaces: [], payments: [], locations: [], coupons: [] });
  const L = like(q);
  const out = { bookings: [], customers: [], spaces: [], payments: [], locations: [], coupons: [] };
  if (can(req, 'bookings.view')) {
    out.bookings = (await models.Booking.findAll({
      where: { [Op.or]: [{ booking_number: { [Op.iLike]: L } }, { '$customer.name$': { [Op.iLike]: L } }] }, limit: 5, order: [['created_at', 'DESC']], subQuery: false,
      include: [{ model: models.User, as: 'customer', attributes: ['name'] }, { model: models.Space, as: 'space', attributes: ['name'] }],
    })).map((b) => ({ id: b.id, label: b.booking_number, sub: `${b.customer?.name} · ${b.space?.name?.ar}`, status: b.status }));
  }
  if (can(req, 'customers.view')) {
    out.customers = (await models.User.findAll({ where: { is_staff: false, [Op.or]: [{ name: { [Op.iLike]: L } }, { email: { [Op.iLike]: L } }, { phone: { [Op.iLike]: L } }] }, limit: 5 }))
      .map((u) => ({ id: u.id, label: u.name, sub: u.email }));
  }
  if (can(req, 'spaces.view')) {
    out.spaces = (await models.Space.findAll({ where: sequelize.where(sequelize.cast(sequelize.col('name'), 'text'), { [Op.iLike]: L }), limit: 5 }))
      .map((s) => ({ id: s.id, label: s.name.ar, sub: s.name.en, slug: s.slug }));
    out.locations = (await models.Location.findAll({ where: sequelize.where(sequelize.cast(sequelize.col('name'), 'text'), { [Op.iLike]: L }), limit: 4 }))
      .map((l) => ({ id: l.id, label: l.name.ar, sub: l.city?.ar }));
  }
  if (can(req, 'payments.view')) {
    out.payments = (await models.Payment.findAll({
      where: { [Op.or]: [{ transfer_reference: { [Op.iLike]: L } }, { '$booking.booking_number$': { [Op.iLike]: L } }] }, limit: 5, subQuery: false,
      include: [{ model: models.Booking, as: 'booking', attributes: ['booking_number'] }],
    })).map((p) => ({ id: p.id, label: p.booking.booking_number, sub: `${Number(p.amount)} ج.م · ${p.transfer_reference || ''}`, status: p.status }));
  }
  if (can(req, 'coupons.manage')) {
    out.coupons = (await models.Coupon.findAll({ where: { code: { [Op.iLike]: L } }, limit: 4 })).map((c) => ({ id: c.id, label: c.code, sub: `${c.discount_type === 'percentage' ? `${Number(c.value)}%` : `${Number(c.value)} ج.م`}` }));
  }
  return res.json(out);
};
