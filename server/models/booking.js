import { DataTypes as T } from 'sequelize';

const id = () => ({ type: T.UUID, defaultValue: T.UUIDV4, primaryKey: true });
const money = (allowNull = false) => ({ type: T.DECIMAL(12, 2), allowNull, defaultValue: allowNull ? null : 0 });

export const BOOKING_STATUSES = [
  'pending_payment', 'payment_under_review', 'confirmed', 'active',
  'completed', 'cancelled', 'expired', 'rejected',
];
export const PAYMENT_STATUSES = [
  'unpaid', 'proof_uploaded', 'under_review', 'approved', 'rejected', 'refund_pending', 'refunded',
];
/** Booking statuses that occupy the space (and are protected by the DB exclusion constraint). */
export const BLOCKING_STATUSES = ['pending_payment', 'payment_under_review', 'confirmed', 'active'];

export function defineBooking(sequelize) {
  const Booking = sequelize.define('Booking', {
    id: id(),
    booking_number: { type: T.STRING(20), allowNull: false, unique: true },
    user_id: { type: T.UUID, allowNull: false },
    space_id: { type: T.UUID, allowNull: false },
    location_id: { type: T.UUID, allowNull: false },
    start_at: { type: T.DATE, allowNull: false },
    end_at: { type: T.DATE, allowNull: false },
    duration_minutes: { type: T.INTEGER, allowNull: false },
    unit: { type: T.ENUM('hourly', 'half_day', 'full_day', 'daily', 'weekly', 'monthly'), allowNull: false },
    unit_slot: { type: T.SMALLINT, allowNull: false, defaultValue: 1 },
    guest_count: { type: T.INTEGER, allowNull: false, defaultValue: 1 },
    base_amount: money(),
    discount_amount: money(),
    addon_amount: money(),
    tax_amount: money(),
    final_amount: money(),
    currency: { type: T.STRING(3), defaultValue: 'EGP' },
    status: { type: T.ENUM(...BOOKING_STATUSES), allowNull: false, defaultValue: 'pending_payment' },
    hold_expires_at: { type: T.DATE },
    coupon_id: { type: T.UUID },
    coupon_code: { type: T.STRING(40) },
    notes: { type: T.TEXT },
    source: { type: T.ENUM('online', 'admin'), defaultValue: 'online' },
    created_by: { type: T.UUID },
    price_snapshot: { type: T.JSONB },
    cancelled_at: { type: T.DATE },
    cancel_reason: { type: T.STRING(300) },
    refund_amount: money(),
    reminder_sent_at: { type: T.DATE },
    review_requested_at: { type: T.DATE },
  }, {
    tableName: 'bookings',
    indexes: [
      { fields: ['user_id', 'start_at'] },
      { fields: ['space_id', 'start_at', 'end_at'] },
      { fields: ['status'] },
      { fields: ['hold_expires_at'] },
      { fields: ['location_id'] },
    ],
  });

  const BookingGuest = sequelize.define('BookingGuest', {
    id: id(),
    booking_id: { type: T.UUID, allowNull: false },
    name: { type: T.STRING(120), allowNull: false },
    email: { type: T.STRING(190) },
    phone: { type: T.STRING(30) },
  }, { tableName: 'booking_guests', indexes: [{ fields: ['booking_id'] }] });

  const BookingAddOn = sequelize.define('BookingAddOn', {
    id: id(),
    booking_id: { type: T.UUID, allowNull: false },
    add_on_id: { type: T.UUID },
    name: { type: T.JSONB, allowNull: false }, // price/name snapshot
    quantity: { type: T.INTEGER, defaultValue: 1 },
    unit_price: money(),
    total: money(),
  }, { tableName: 'booking_add_ons', indexes: [{ fields: ['booking_id'] }] });

  const BookingEvent = sequelize.define('BookingEvent', {
    id: id(),
    booking_id: { type: T.UUID, allowNull: false },
    type: { type: T.STRING(40), allowNull: false },
    actor_id: { type: T.UUID },
    meta: { type: T.JSONB },
  }, { tableName: 'booking_events', updatedAt: false, indexes: [{ fields: ['booking_id', 'created_at'] }] });

  const PaymentMethod = sequelize.define('PaymentMethod', {
    id: id(),
    code: { type: T.STRING(30), allowNull: false, unique: true },
    name: { type: T.JSONB, allowNull: false },
    account_identifier: { type: T.STRING(120) }, // Vodafone number / InstaPay address
    account_name: { type: T.STRING(160) },
    instructions: { type: T.JSONB },
    qr_image_url: { type: T.STRING(500) },
    active: { type: T.BOOLEAN, defaultValue: true },
    sort: { type: T.INTEGER, defaultValue: 0 },
  }, { tableName: 'payment_methods' });

  const Payment = sequelize.define('Payment', {
    id: id(),
    booking_id: { type: T.UUID, allowNull: false, unique: true },
    method: { type: T.STRING(30) },
    amount: money(),
    currency: { type: T.STRING(3), defaultValue: 'EGP' },
    status: { type: T.ENUM(...PAYMENT_STATUSES), allowNull: false, defaultValue: 'unpaid' },
    transfer_reference: { type: T.STRING(120) },
    transfer_time: { type: T.DATE },
    sender_info: { type: T.STRING(200) },
    submitted_at: { type: T.DATE },
    reviewed_at: { type: T.DATE },
    reviewed_by: { type: T.UUID },
    rejection_reason: { type: T.STRING(500) },
    needs_new_receipt: { type: T.BOOLEAN, defaultValue: false },
    refund_amount: money(),
    refunded_at: { type: T.DATE },
  }, { tableName: 'payments', indexes: [{ fields: ['status', 'submitted_at'] }] });

  const PaymentReceipt = sequelize.define('PaymentReceipt', {
    id: id(),
    payment_id: { type: T.UUID, allowNull: false },
    file_path: { type: T.STRING(300), allowNull: false },
    original_name: { type: T.STRING(255), allowNull: false },
    mime_type: { type: T.STRING(80), allowNull: false },
    file_size: { type: T.INTEGER, allowNull: false },
    checksum: { type: T.STRING(80) },
    is_current: { type: T.BOOLEAN, defaultValue: true },
    uploaded_by: { type: T.UUID },
  }, { tableName: 'payment_receipts', updatedAt: false, indexes: [{ fields: ['payment_id'] }] });

  const Coupon = sequelize.define('Coupon', {
    id: id(),
    code: { type: T.STRING(40), allowNull: false, unique: true },
    description: { type: T.JSONB },
    discount_type: { type: T.ENUM('percentage', 'fixed'), allowNull: false },
    value: { type: T.DECIMAL(10, 2), allowNull: false },
    max_discount: { type: T.DECIMAL(10, 2) },
    min_amount: money(),
    starts_at: { type: T.DATE },
    ends_at: { type: T.DATE },
    usage_limit: { type: T.INTEGER },
    per_user_limit: { type: T.INTEGER, defaultValue: 1 },
    space_ids: { type: T.JSONB }, // null = all
    space_type_keys: { type: T.JSONB },
    active: { type: T.BOOLEAN, defaultValue: true },
  }, { tableName: 'coupons' });

  const CouponUsage = sequelize.define('CouponUsage', {
    id: id(),
    coupon_id: { type: T.UUID, allowNull: false },
    user_id: { type: T.UUID, allowNull: false },
    booking_id: { type: T.UUID, allowNull: false },
    amount: money(),
    status: { type: T.ENUM('reserved', 'redeemed', 'released'), defaultValue: 'reserved' },
  }, { tableName: 'coupon_usages', indexes: [{ fields: ['coupon_id', 'status'] }, { fields: ['coupon_id', 'user_id'] }] });

  return { Booking, BookingGuest, BookingAddOn, BookingEvent, PaymentMethod, Payment, PaymentReceipt, Coupon, CouponUsage };
}
