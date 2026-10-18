import { Op } from 'sequelize';
import { models } from '../models/index.js';
import { notify } from './notifications.js';

/**
 * Releases bookings whose payment hold ran out. Called (a) inside the booking
 * transaction right after the space row is locked, so stale holds never block a
 * new reservation, and (b) periodically by the background job.
 */
export async function expireStaleHolds({ transaction, spaceId } = {}) {
  const where = { status: 'pending_payment', hold_expires_at: { [Op.lt]: new Date() } };
  if (spaceId) where.space_id = spaceId;
  const stale = await models.Booking.findAll({
    where,
    transaction,
    lock: transaction ? { level: transaction.LOCK.UPDATE, of: models.Booking } : undefined,
    include: [{ model: models.User, as: 'customer' }, { model: models.Space, as: 'space' }],
  });
  for (const b of stale) {
    await b.update({ status: 'expired', hold_expires_at: null }, { transaction });
    await models.CouponUsage.update({ status: 'released' }, { where: { booking_id: b.id }, transaction });
    await models.BookingEvent.create({ booking_id: b.id, type: 'expired' }, { transaction });
    await notify(b.customer, 'booking_expired', {
      booking_id: b.id, booking_number: b.booking_number, space_name: b.space?.name,
    }, { transaction, link: `/account/bookings/${b.id}` });
  }
  return stale.length;
}
