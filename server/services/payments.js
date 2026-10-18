import { Op } from 'sequelize';
import { models, sequelize } from '../models/index.js';
import { fail } from '../utils/errors.js';
import { storage, sniffMime } from '../storage/index.js';
import { config } from '../config/env.js';
import { getSettings } from './settings.js';
import { notify, notifyStaff } from './notifications.js';
import { audit } from './audit.js';
import { addEvent, assertTransition, loadBooking, bookingIncludes } from './bookings.js';
import { expireStaleHolds } from './holds.js';

const paymentInclude = () => [
  { model: models.Booking, as: 'booking', include: bookingIncludes() },
  { model: models.PaymentReceipt, as: 'receipts' },
];

async function lockedPayment(paymentId, t) {
  await models.Payment.findByPk(paymentId, { transaction: t, lock: t.LOCK.UPDATE, attributes: ['id'] });
  const p = await models.Payment.findByPk(paymentId, { include: paymentInclude(), transaction: t });
  if (!p) fail('NOT_FOUND');
  // Re-lock the parent booking too so approve/cancel/expire can't interleave.
  await models.Booking.findByPk(p.booking_id, { transaction: t, lock: t.LOCK.UPDATE, attributes: ['id'] });
  return p;
}

function assertHoldAlive(booking) {
  if (booking.status === 'expired') fail('BOOKING_EXPIRED');
  if (booking.status !== 'pending_payment') fail('BOOKING_STATE');
  if (booking.hold_expires_at && booking.hold_expires_at < new Date()) fail('BOOKING_EXPIRED');
}

/** Customer picks (or changes) the manual transfer method. */
export async function selectPaymentMethod({ bookingId, user, methodCode }) {
  return sequelize.transaction(async (t) => {
    const booking = await models.Booking.findByPk(bookingId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!booking || booking.user_id !== user.id) fail('NOT_FOUND');
    await expireStaleHolds({ transaction: t, spaceId: booking.space_id });
    await booking.reload({ transaction: t });
    assertHoldAlive(booking);
    const method = await models.PaymentMethod.findOne({ where: { code: methodCode, active: true }, transaction: t });
    if (!method) fail('PAYMENT_METHOD_INVALID');
    const payment = await models.Payment.findOne({ where: { booking_id: booking.id }, transaction: t });
    if (!['unpaid', 'proof_uploaded', 'rejected'].includes(payment.status)) fail('PAYMENT_STATE');
    await payment.update({ method: method.code, amount: booking.final_amount }, { transaction: t });
    return payment.id;
  }).then((id) => models.Payment.findByPk(id, { include: [{ model: models.PaymentReceipt, as: 'receipts' }] }));
}

/**
 * Stores a receipt (replacing the previous one if any). Validates real file content, not just the extension.
 * Does NOT submit the payment — the customer confirms separately.
 */
export async function uploadReceipt({ paymentId, user, file }) {
  if (!file?.buffer?.length) fail('RECEIPT_REQUIRED');
  const settings = await getSettings();
  const maxBytes = Math.min(settings.payment.receipt_max_mb * 1024 * 1024, config.storage.maxReceiptBytes);
  if (file.buffer.length > maxBytes) fail('RECEIPT_SIZE');
  const mime = sniffMime(file.buffer);
  if (!mime || !settings.payment.receipt_types.includes(mime)) fail('RECEIPT_TYPE');

  const stored = await storage.save('private', file.buffer, mime, 'receipts');
  try {
    await sequelize.transaction(async (t) => {
      const p = await lockedPayment(paymentId, t);
      if (p.booking.user_id !== user.id) fail('NOT_FOUND');
      assertHoldAlive(p.booking);
      if (!p.method) fail('PAYMENT_METHOD_INVALID');
      if (!['unpaid', 'proof_uploaded', 'rejected'].includes(p.status)) fail('PAYMENT_STATE');
      const replaced = p.receipts.some((r) => r.is_current);
      await models.PaymentReceipt.update({ is_current: false }, { where: { payment_id: p.id, is_current: true }, transaction: t });
      await models.PaymentReceipt.create({
        payment_id: p.id, file_path: stored.key, original_name: String(file.originalname || 'receipt').slice(0, 250),
        mime_type: mime, file_size: stored.size, checksum: stored.checksum, uploaded_by: user.id, is_current: true,
      }, { transaction: t });
      await p.update({ status: 'proof_uploaded' }, { transaction: t });
      await addEvent(p.booking, replaced ? 'receipt_replaced' : 'receipt_uploaded', { actor: user, transaction: t });
    });
  } catch (err) {
    await storage.remove('private', stored.key).catch(() => {});
    throw err;
  }
  return models.Payment.findByPk(paymentId, { include: [{ model: models.PaymentReceipt, as: 'receipts' }] });
}

/**
 * Customer submits the transfer details. A current receipt is REQUIRED.
 * This only moves the payment to "under review" — it never confirms the booking.
 */
export async function submitPayment({ paymentId, user, details }) {
  await sequelize.transaction(async (t) => {
    const p = await lockedPayment(paymentId, t);
    if (p.booking.user_id !== user.id) fail('NOT_FOUND');
    assertHoldAlive(p.booking);
    if (!['proof_uploaded', 'rejected', 'unpaid'].includes(p.status)) fail('PAYMENT_STATE');
    const hasReceipt = p.receipts.some((r) => r.is_current);
    if (!hasReceipt) fail('RECEIPT_REQUIRED');

    await p.update({
      status: 'under_review',
      transfer_reference: details.transfer_reference || null,
      transfer_time: details.transfer_time,
      sender_info: details.sender_info || null,
      submitted_at: new Date(),
      rejection_reason: null,
      needs_new_receipt: false,
    }, { transaction: t });
    assertTransition(p.booking.status, 'payment_under_review');
    await p.booking.update({ status: 'payment_under_review', hold_expires_at: null }, { transaction: t });
    await addEvent(p.booking, 'payment_submitted', { actor: user, meta: { method: p.method }, transaction: t });
    await addEvent(p.booking, 'under_review', { transaction: t });

    const method = await models.PaymentMethod.findOne({ where: { code: p.method }, transaction: t });
    const ctx = { booking_id: p.booking.id, booking_number: p.booking.booking_number, space_name: p.booking.space.name, amount: p.amount };
    await notify(p.booking.customer, 'payment_submitted', ctx, { transaction: t, link: `/account/bookings/${p.booking.id}` });
    await notifyStaff('payments.review', 'proof_uploaded', {
      ...ctx, customer_name: p.booking.customer.name, method_name: method?.name?.ar || p.method,
    }, { transaction: t, link: '/admin/payments' });
  });
  return models.Payment.findByPk(paymentId, { include: [{ model: models.PaymentReceipt, as: 'receipts' }] });
}

export async function approvePayment({ paymentId, admin, note, ip }) {
  await sequelize.transaction(async (t) => {
    const p = await lockedPayment(paymentId, t);
    if (p.status !== 'under_review') fail('PAYMENT_STATE');
    assertTransition(p.booking.status, 'confirmed');
    await p.update({ status: 'approved', reviewed_by: admin.id, reviewed_at: new Date(), rejection_reason: null }, { transaction: t });
    await p.booking.update({ status: 'confirmed', hold_expires_at: null }, { transaction: t });
    await models.CouponUsage.update({ status: 'redeemed' }, { where: { booking_id: p.booking_id, status: 'reserved' }, transaction: t });
    await addEvent(p.booking, 'payment_approved', { actor: admin, meta: { note }, transaction: t });
    await addEvent(p.booking, 'confirmed', { actor: admin, transaction: t });
    const ctx = { booking_id: p.booking.id, booking_number: p.booking.booking_number, space_name: p.booking.space.name, amount: p.amount, start_at: p.booking.start_at };
    await notify(p.booking.customer, 'payment_approved', ctx, { transaction: t, link: `/account/bookings/${p.booking.id}` });
    await notify(p.booking.customer, 'booking_confirmed', ctx, { transaction: t, link: `/account/bookings/${p.booking.id}` });
    await audit(admin, 'payment.approve', { entityType: 'payment', entityId: p.id, label: p.booking.booking_number, meta: { amount: Number(p.amount), method: p.method }, ip, transaction: t });
  });
  return paymentById(paymentId);
}

/** Final rejection: booking is rejected and the slot is released. */
export async function rejectPayment({ paymentId, admin, reason, ip }) {
  if (!reason || reason.trim().length < 3) fail('REASON_REQUIRED');
  await sequelize.transaction(async (t) => {
    const p = await lockedPayment(paymentId, t);
    if (p.status !== 'under_review') fail('PAYMENT_STATE');
    assertTransition(p.booking.status, 'rejected');
    await p.update({ status: 'rejected', reviewed_by: admin.id, reviewed_at: new Date(), rejection_reason: reason.trim(), needs_new_receipt: false }, { transaction: t });
    await p.booking.update({ status: 'rejected', hold_expires_at: null }, { transaction: t });
    await models.CouponUsage.update({ status: 'released' }, { where: { booking_id: p.booking_id }, transaction: t });
    await addEvent(p.booking, 'payment_rejected', { actor: admin, meta: { reason }, transaction: t });
    await notify(p.booking.customer, 'payment_rejected', {
      booking_id: p.booking.id, booking_number: p.booking.booking_number, reason: reason.trim(),
    }, { transaction: t, link: `/account/bookings/${p.booking.id}` });
    await audit(admin, 'payment.reject', { entityType: 'payment', entityId: p.id, label: p.booking.booking_number, meta: { amount: Number(p.amount), reason }, ip, transaction: t });
  });
  return paymentById(paymentId);
}

/** Softer outcome: ask the customer for a better receipt and keep the slot held for a short window. */
export async function requestNewReceipt({ paymentId, admin, reason, ip }) {
  if (!reason || reason.trim().length < 3) fail('REASON_REQUIRED');
  const settings = await getSettings();
  const windowMin = settings.booking.reupload_window_minutes;
  await sequelize.transaction(async (t) => {
    const p = await lockedPayment(paymentId, t);
    if (p.status !== 'under_review') fail('PAYMENT_STATE');
    assertTransition(p.booking.status, 'pending_payment');
    await p.update({ status: 'rejected', reviewed_by: admin.id, reviewed_at: new Date(), rejection_reason: reason.trim(), needs_new_receipt: true }, { transaction: t });
    await p.booking.update({ status: 'pending_payment', hold_expires_at: new Date(Date.now() + windowMin * 60_000) }, { transaction: t });
    await models.PaymentReceipt.update({ is_current: false }, { where: { payment_id: p.id, is_current: true }, transaction: t });
    await addEvent(p.booking, 'new_receipt_requested', { actor: admin, meta: { reason }, transaction: t });
    await notify(p.booking.customer, 'new_receipt_requested', {
      booking_id: p.booking.id, booking_number: p.booking.booking_number, reason: reason.trim(), window_minutes: windowMin,
    }, { transaction: t, link: `/account/bookings/${p.booking.id}` });
    await audit(admin, 'payment.request_new_receipt', { entityType: 'payment', entityId: p.id, label: p.booking.booking_number, meta: { reason }, ip, transaction: t });
  });
  return paymentById(paymentId);
}

export async function markRefunded({ paymentId, admin, ip }) {
  await sequelize.transaction(async (t) => {
    const p = await lockedPayment(paymentId, t);
    if (p.status !== 'refund_pending') fail('PAYMENT_STATE');
    await p.update({ status: 'refunded', refunded_at: new Date() }, { transaction: t });
    await addEvent(p.booking, 'refunded', { actor: admin, meta: { amount: Number(p.refund_amount) }, transaction: t });
    await audit(admin, 'payment.refund', { entityType: 'payment', entityId: p.id, label: p.booking.booking_number, meta: { amount: Number(p.refund_amount) }, ip, transaction: t });
  });
  return paymentById(paymentId);
}

export const paymentById = (id) => models.Payment.findByPk(id, {
  include: [
    { model: models.PaymentReceipt, as: 'receipts' },
    { model: models.User, as: 'reviewer', attributes: ['id', 'name'] },
    { model: models.Booking, as: 'booking', include: bookingIncludes() },
  ],
});

/** Streams access to a receipt file. Callers must have already authorised the actor. */
export async function readReceipt(receipt) {
  return { buffer: await storage.read('private', receipt.file_path), mime: receipt.mime_type, name: receipt.original_name };
}
