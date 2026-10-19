import { DataTypes as T } from 'sequelize';
import { sequelize } from '../config/database.js';
import { defineIdentity } from './identity.js';
import { defineCatalog } from './catalog.js';
import { defineBooking, BOOKING_STATUSES, PAYMENT_STATUSES, BLOCKING_STATUSES } from './booking.js';

const id = () => ({ type: T.UUID, defaultValue: T.UUIDV4, primaryKey: true });

const identity = defineIdentity(sequelize);
const catalog = defineCatalog(sequelize);
const booking = defineBooking(sequelize);

const Review = sequelize.define('Review', {
  id: id(),
  booking_id: { type: T.UUID, allowNull: false, unique: true },
  user_id: { type: T.UUID, allowNull: false },
  space_id: { type: T.UUID, allowNull: false },
  rating: { type: T.SMALLINT, allowNull: false, validate: { min: 1, max: 5 } },
  comment: { type: T.TEXT },
  images: { type: T.JSONB, defaultValue: [] },
  status: { type: T.ENUM('pending', 'approved', 'hidden'), defaultValue: 'pending' },
  featured: { type: T.BOOLEAN, defaultValue: false },
}, { tableName: 'reviews', indexes: [{ fields: ['space_id', 'status'] }] });

const Notification = sequelize.define('Notification', {
  id: id(),
  user_id: { type: T.UUID, allowNull: false },
  type: { type: T.STRING(40), allowNull: false },
  title: { type: T.JSONB, allowNull: false },
  body: { type: T.JSONB },
  link: { type: T.STRING(300) },
  data: { type: T.JSONB },
  read_at: { type: T.DATE },
}, { tableName: 'notifications', updatedAt: false, indexes: [{ fields: ['user_id', 'read_at', 'created_at'] }] });

const AuditLog = sequelize.define('AuditLog', {
  id: id(),
  actor_id: { type: T.UUID },
  actor_name: { type: T.STRING(120) },
  action: { type: T.STRING(60), allowNull: false },
  entity_type: { type: T.STRING(40) },
  entity_id: { type: T.STRING(64) },
  entity_label: { type: T.STRING(200) },
  meta: { type: T.JSONB },
  ip: { type: T.STRING(64) },
}, { tableName: 'audit_logs', updatedAt: false, indexes: [{ fields: ['created_at'] }, { fields: ['action'] }] });

const Setting = sequelize.define('Setting', {
  key: { type: T.STRING(80), primaryKey: true },
  value: { type: T.JSONB, allowNull: false },
}, { tableName: 'settings' });

const StoredFile = sequelize.define('StoredFile', {
  id: id(),
  bucket: { type: T.STRING(40), allowNull: false },
  key: { type: T.STRING(300), allowNull: false, unique: true },
  mime_type: { type: T.STRING(80), allowNull: false },
  data: { type: T.BLOB('long'), allowNull: false },
  size: { type: T.INTEGER, allowNull: false },
}, { tableName: 'stored_files', updatedAt: false, indexes: [{ fields: ['key'] }, { fields: ['bucket'] }] });

export const models = { ...identity, ...catalog, ...booking, Review, Notification, AuditLog, Setting, Favorite, StoredFile };
const m = models;

// Identity
m.User.belongsToMany(m.Role, { through: m.UserRole, foreignKey: 'user_id', otherKey: 'role_id', as: 'roles' });
m.Role.belongsToMany(m.User, { through: m.UserRole, foreignKey: 'role_id', otherKey: 'user_id', as: 'users' });
m.Role.belongsToMany(m.Permission, { through: m.RolePermission, foreignKey: 'role_id', otherKey: 'permission_id', as: 'permissions' });
m.Permission.belongsToMany(m.Role, { through: m.RolePermission, foreignKey: 'permission_id', otherKey: 'role_id', as: 'roles' });
m.User.hasMany(m.RefreshToken, { foreignKey: 'user_id' });

// Catalog
m.Space.belongsTo(m.Location, { foreignKey: 'location_id', as: 'location' });
m.Location.hasMany(m.Space, { foreignKey: 'location_id', as: 'spaces' });
m.Space.belongsTo(m.SpaceType, { foreignKey: 'type_id', as: 'type' });
m.SpaceType.hasMany(m.Space, { foreignKey: 'type_id', as: 'spaces' });
m.Space.hasMany(m.SpaceImage, { foreignKey: 'space_id', as: 'images', onDelete: 'CASCADE' });
m.SpaceImage.belongsTo(m.Space, { foreignKey: 'space_id' });
m.Space.belongsToMany(m.Amenity, { through: m.SpaceAmenity, foreignKey: 'space_id', otherKey: 'amenity_id', as: 'amenities' });
m.Amenity.belongsToMany(m.Space, { through: m.SpaceAmenity, foreignKey: 'amenity_id', otherKey: 'space_id', as: 'spaces' });
m.Space.hasMany(m.PricingRule, { foreignKey: 'space_id', as: 'pricing', onDelete: 'CASCADE' });
m.Space.hasMany(m.AvailabilityRule, { foreignKey: 'space_id', as: 'hours', onDelete: 'CASCADE' });
m.Space.hasMany(m.BlockedPeriod, { foreignKey: 'space_id', as: 'blocks', onDelete: 'CASCADE' });
m.BlockedPeriod.belongsTo(m.Space, { foreignKey: 'space_id', as: 'space' });

// Bookings
m.Booking.belongsTo(m.User, { foreignKey: 'user_id', as: 'customer' });
m.User.hasMany(m.Booking, { foreignKey: 'user_id', as: 'bookings' });
m.Booking.belongsTo(m.Space, { foreignKey: 'space_id', as: 'space' });
m.Space.hasMany(m.Booking, { foreignKey: 'space_id', as: 'bookings' });
m.Booking.belongsTo(m.Location, { foreignKey: 'location_id', as: 'location' });
m.Booking.hasMany(m.BookingGuest, { foreignKey: 'booking_id', as: 'guests', onDelete: 'CASCADE' });
m.Booking.hasMany(m.BookingAddOn, { foreignKey: 'booking_id', as: 'addons', onDelete: 'CASCADE' });
m.Booking.hasMany(m.BookingEvent, { foreignKey: 'booking_id', as: 'events', onDelete: 'CASCADE' });
m.Booking.hasOne(m.Payment, { foreignKey: 'booking_id', as: 'payment' });
m.Payment.belongsTo(m.Booking, { foreignKey: 'booking_id', as: 'booking' });
m.Payment.hasMany(m.PaymentReceipt, { foreignKey: 'payment_id', as: 'receipts' });
m.PaymentReceipt.belongsTo(m.Payment, { foreignKey: 'payment_id', as: 'payment' });
m.Payment.belongsTo(m.User, { foreignKey: 'reviewed_by', as: 'reviewer' });
m.BookingEvent.belongsTo(m.User, { foreignKey: 'actor_id', as: 'actor' });
m.Coupon.hasMany(m.CouponUsage, { foreignKey: 'coupon_id', as: 'usages' });
m.CouponUsage.belongsTo(m.Coupon, { foreignKey: 'coupon_id', as: 'coupon' });

// Reviews / favourites / notifications
m.Review.belongsTo(m.User, { foreignKey: 'user_id', as: 'author' });
m.Review.belongsTo(m.Space, { foreignKey: 'space_id', as: 'space' });
m.Review.belongsTo(m.Booking, { foreignKey: 'booking_id', as: 'booking' });
m.Space.hasMany(m.Review, { foreignKey: 'space_id', as: 'reviews' });
m.Favorite.belongsTo(m.Space, { foreignKey: 'space_id', as: 'space' });
m.User.hasMany(m.Notification, { foreignKey: 'user_id' });

export { sequelize, BOOKING_STATUSES, PAYMENT_STATUSES, BLOCKING_STATUSES };
