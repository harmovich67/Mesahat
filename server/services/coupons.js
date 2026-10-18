import { Op } from 'sequelize';
import { models } from '../models/index.js';
import { fail } from '../utils/errors.js';

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Validates a coupon for a given booking context and computes the discount.
 * Pass `lock: true` + transaction when reserving, so usage-limit checks are race-safe.
 */
export async function evaluateCoupon({ code, userId, space, subtotal, transaction, lock = false }) {
  if (!code) return null;
  const coupon = await models.Coupon.findOne({
    where: { code: String(code).trim().toUpperCase() },
    transaction,
    lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!coupon || !coupon.active) fail('COUPON_INVALID');

  const now = new Date();
  if ((coupon.starts_at && coupon.starts_at > now) || (coupon.ends_at && coupon.ends_at < now)) fail('COUPON_EXPIRED');

  if (coupon.space_ids?.length && !coupon.space_ids.includes(space.id)) fail('COUPON_NOT_APPLICABLE');
  if (coupon.space_type_keys?.length && !coupon.space_type_keys.includes(space.type?.key)) fail('COUPON_NOT_APPLICABLE');
  if (subtotal < Number(coupon.min_amount || 0)) fail('COUPON_MIN_AMOUNT');

  const live = { coupon_id: coupon.id, status: { [Op.in]: ['reserved', 'redeemed'] } };
  if (coupon.usage_limit != null && (await models.CouponUsage.count({ where: live, transaction })) >= coupon.usage_limit) fail('COUPON_LIMIT');
  if (coupon.per_user_limit != null && userId
    && (await models.CouponUsage.count({ where: { ...live, user_id: userId }, transaction })) >= coupon.per_user_limit) fail('COUPON_USER_LIMIT');

  let discount = coupon.discount_type === 'percentage'
    ? subtotal * (Number(coupon.value) / 100)
    : Number(coupon.value);
  if (coupon.max_discount != null) discount = Math.min(discount, Number(coupon.max_discount));
  discount = r2(Math.min(discount, subtotal));
  return { coupon, discount };
}
