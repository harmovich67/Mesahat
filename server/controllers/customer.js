import { Op } from 'sequelize';
import { models, sequelize } from '../models/index.js';
import { fail } from '../utils/errors.js';
import { serializeBooking, serializePayment } from '../utils/serializers.js';
import { getSettings } from '../services/settings.js';
import {
  createBooking, loadBooking, bookingIncludes, cancellationQuote, cancelBooking, rebookSuggestions,
} from '../services/bookings.js';
import { selectPaymentMethod, uploadReceipt, submitPayment, readReceipt, paymentById } from '../services/payments.js';
import { can } from '../middleware/index.js';
import { audit } from '../services/audit.js';
import { storage, sniffMime } from '../storage/index.js';
import { config } from '../config/env.js';
import { refreshRating } from '../services/spaces.js';

const ownBooking = async (req) => {
  const b = await loadBooking(req.params.id);
  if (!b || b.user_id !== req.user.id) fail('NOT_FOUND');
  return b;
};

const withReview = async (booking) => {
  booking.review = await models.Review.findOne({ where: { booking_id: booking.id } });
  return booking;
};

/* ------------------------------ bookings ------------------------------ */
export const create = async (req, res) => {
  const booking = await createBooking({ customerId: req.user.id, input: req.body });
  res.status(201).json({ booking: serializeBooking(booking) });
};

export const list = async (req, res) => {
  const now = new Date();
  const where = { user_id: req.user.id };
  const scope = req.query.scope;
  if (scope === 'upcoming') Object.assign(where, { status: { [Op.in]: ['confirmed', 'active'] }, end_at: { [Op.gte]: now } });
  else if (scope === 'pending') where.status = { [Op.in]: ['pending_payment', 'payment_under_review'] };
  else if (scope === 'past') where.status = { [Op.in]: ['completed', 'cancelled', 'expired', 'rejected'] };
  const rows = await models.Booking.findAll({ where, include: bookingIncludes(), order: [['start_at', scope === 'upcoming' ? 'ASC' : 'DESC']], limit: 200 });
  const reviews = await models.Review.findAll({ where: { booking_id: { [Op.in]: rows.map((r) => r.id) } } });
  rows.forEach((r) => { r.review = reviews.find((x) => x.booking_id === r.id) || null; });
  res.json({ items: rows.map((b) => serializeBooking(b)) });
};

export const get = async (req, res) => {
  const booking = await withReview(await ownBooking(req));
  const settings = await getSettings();
  res.json({ booking: serializeBooking(booking), cancellation: cancellationQuote(booking, settings) });
};

export const quoteCancel = async (req, res) => {
  const booking = await ownBooking(req);
  res.json({ cancellation: cancellationQuote(booking, await getSettings()) });
};

export const cancel = async (req, res) => {
  await ownBooking(req);
  const booking = await cancelBooking({ bookingId: req.params.id, actor: req.user, reason: req.body.reason, ip: req.ip });
  res.json({ booking: serializeBooking(booking) });
};

export const rebook = async (req, res) => res.json({ items: await rebookSuggestions(req.user.id) });

/* ------------------------------ payments ------------------------------ */
export const choosePayment = async (req, res) => {
  const payment = await selectPaymentMethod({ bookingId: req.params.id, user: req.user, methodCode: req.body.method });
  res.json({ payment: serializePayment(payment) });
};

export const receipt = async (req, res) => {
  const payment = await uploadReceipt({ paymentId: req.params.id, user: req.user, file: req.file });
  res.status(201).json({ payment: serializePayment(payment) });
};

export const submit = async (req, res) => {
  const payment = await submitPayment({ paymentId: req.params.id, user: req.user, details: req.body });
  const booking = await loadBooking(payment.booking_id);
  res.json({ payment: serializePayment(payment), booking: serializeBooking(booking) });
};

/** Receipt download — owner or an authorised reviewer only. Never publicly addressable. */
export const downloadReceipt = async (req, res) => {
  const payment = await paymentById(req.params.id);
  if (!payment) fail('NOT_FOUND');
  const isOwner = payment.booking.user_id === req.user.id;
  const isReviewer = can(req, 'payments.view');
  if (!isOwner && !isReviewer) fail('NOT_FOUND');
  const current = payment.receipts.find((r) => r.is_current) || [...payment.receipts].sort((a, b) => (b.createdAt ?? b.created_at) - (a.createdAt ?? a.created_at))[0];
  if (!current) fail('NOT_FOUND');
  if (!isOwner) {
    await audit(req.user, 'payment.view_receipt', { entityType: 'payment', entityId: payment.id, label: payment.booking.booking_number, ip: req.ip });
  }
  const { buffer, mime, name } = await readReceipt(current);
  res.set({
    'Content-Type': mime,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
  });
  res.send(buffer);
};

export const paymentHistory = async (req, res) => {
  const rows = await models.Payment.findAll({
    include: [{ model: models.Booking, as: 'booking', where: { user_id: req.user.id }, include: [{ model: models.Space, as: 'space', attributes: ['id', 'name', 'slug'] }] }, { model: models.PaymentReceipt, as: 'receipts' }],
    order: [['created_at', 'DESC']],
  });
  res.json({ items: rows.map((p) => ({ ...serializePayment(p), booking_number: p.booking.booking_number, space: p.booking.space, booking_status: p.booking.status })) });
};

/* ------------------------------ favourites ------------------------------ */
export const favorites = async (req, res) => {
  const rows = await models.Favorite.findAll({ where: { user_id: req.user.id }, attributes: ['space_id'] });
  res.json({ space_ids: rows.map((r) => r.space_id) });
};
export const toggleFavorite = async (req, res) => {
  const space = await models.Space.findByPk(req.params.spaceId, { attributes: ['id'] });
  if (!space) fail('NOT_FOUND');
  const where = { user_id: req.user.id, space_id: space.id };
  const existing = await models.Favorite.findOne({ where });
  if (existing) await existing.destroy(); else await models.Favorite.create(where);
  res.json({ favorite: !existing });
};

/* ------------------------------ notifications ------------------------------ */
export const notifications = async (req, res) => {
  const [items, unread] = await Promise.all([
    models.Notification.findAll({ where: { user_id: req.user.id }, order: [['created_at', 'DESC']], limit: 60 }),
    models.Notification.count({ where: { user_id: req.user.id, read_at: { [Op.is]: null } } }),
  ]);
  res.json({ items, unread });
};
export const readNotification = async (req, res) => {
  await models.Notification.update({ read_at: new Date() }, { where: { id: req.params.id, user_id: req.user.id } });
  res.json({ ok: true });
};
export const readAllNotifications = async (req, res) => {
  await models.Notification.update({ read_at: new Date() }, { where: { user_id: req.user.id, read_at: { [Op.is]: null } } });
  res.json({ ok: true });
};

/* ------------------------------ reviews ------------------------------ */
export const createReview = async (req, res) => {
  const { booking_id: bookingId, rating, comment, images } = req.body;
  const review = await sequelize.transaction(async (t) => {
    const booking = await models.Booking.findByPk(bookingId, { transaction: t });
    if (!booking || booking.user_id !== req.user.id || booking.status !== 'completed') fail('REVIEW_NOT_ALLOWED');
    if (await models.Review.findOne({ where: { booking_id: bookingId }, transaction: t })) fail('REVIEW_NOT_ALLOWED');
    return models.Review.create({ booking_id: bookingId, user_id: req.user.id, space_id: booking.space_id, rating, comment, images, status: 'pending' }, { transaction: t });
  });
  res.status(201).json({ review });
};
export const myReviews = async (req, res) => {
  const rows = await models.Review.findAll({ where: { user_id: req.user.id }, order: [['created_at', 'DESC']], include: [{ model: models.Space, as: 'space', attributes: ['id', 'name', 'slug'] }] });
  res.json({ items: rows });
};

/* ------------------------------ public media upload (review photos, avatars) ------------------------------ */
export const uploadPublicImage = async (req, res) => {
  if (!req.file) fail('RECEIPT_UPLOAD_FAILED');
  const mime = sniffMime(req.file.buffer);
  if (!mime || mime === 'application/pdf') fail('RECEIPT_TYPE');
  if (req.file.size > config.storage.maxImageBytes) fail('RECEIPT_SIZE');
  const saved = await storage.save('public', req.file.buffer, mime, 'media');
  res.status(201).json({ url: `/media/${saved.key}` });
};
