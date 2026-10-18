import { DataTypes as T } from 'sequelize';

const id = () => ({ type: T.UUID, defaultValue: T.UUIDV4, primaryKey: true });
const i18n = (allowNull = false) => ({ type: T.JSONB, allowNull });

export function defineCatalog(sequelize) {
  const Location = sequelize.define('Location', {
    id: id(),
    slug: { type: T.STRING(120), allowNull: false, unique: true },
    name: i18n(),
    address: i18n(),
    city: i18n(),
    latitude: { type: T.DECIMAL(9, 6) },
    longitude: { type: T.DECIMAL(9, 6) },
    description: i18n(true),
    images: { type: T.JSONB, defaultValue: [] },
    working_hours: { type: T.JSONB, defaultValue: {} },
    phone: { type: T.STRING(30) },
    email: { type: T.STRING(190) },
    active: { type: T.BOOLEAN, defaultValue: true },
  }, { tableName: 'locations' });

  const SpaceType = sequelize.define('SpaceType', {
    id: id(),
    key: { type: T.STRING(40), allowNull: false, unique: true },
    group: { type: T.STRING(40), allowNull: false }, // public category: meeting-rooms, coworking, ...
    name: i18n(),
    description: i18n(true),
    icon: { type: T.STRING(40) },
    color: { type: T.STRING(20) },
    sort: { type: T.INTEGER, defaultValue: 0 },
    active: { type: T.BOOLEAN, defaultValue: true },
  }, { tableName: 'space_types' });

  const Space = sequelize.define('Space', {
    id: id(),
    slug: { type: T.STRING(140), allowNull: false, unique: true },
    name: i18n(),
    description: i18n(true),
    rules: { type: T.JSONB, defaultValue: [] }, // array of {ar,en}
    type_id: { type: T.UUID, allowNull: false },
    location_id: { type: T.UUID, allowNull: false },
    capacity: { type: T.INTEGER, allowNull: false, defaultValue: 1 },
    // Number of identical bookable units (e.g. 24 hot desks in a zone). Rooms = 1.
    units: { type: T.INTEGER, allowNull: false, defaultValue: 1 },
    area_sqm: { type: T.INTEGER },
    floor: { type: T.STRING(40) },
    status: { type: T.ENUM('draft', 'active', 'archived'), defaultValue: 'active' },
    featured: { type: T.BOOLEAN, defaultValue: false },
    currency: { type: T.STRING(3), defaultValue: 'EGP' },
    buffer_minutes: { type: T.INTEGER, defaultValue: 0 },
    rating_avg: { type: T.DECIMAL(3, 2), defaultValue: 0 },
    rating_count: { type: T.INTEGER, defaultValue: 0 },
  }, { tableName: 'spaces', indexes: [{ fields: ['status'] }, { fields: ['location_id'] }, { fields: ['type_id'] }] });

  const SpaceImage = sequelize.define('SpaceImage', {
    id: id(),
    space_id: { type: T.UUID, allowNull: false },
    url: { type: T.STRING(500), allowNull: false },
    alt: i18n(true),
    sort: { type: T.INTEGER, defaultValue: 0 },
  }, { tableName: 'space_images', indexes: [{ fields: ['space_id'] }] });

  const Amenity = sequelize.define('Amenity', {
    id: id(),
    key: { type: T.STRING(40), allowNull: false, unique: true },
    name: i18n(),
    icon: { type: T.STRING(40) },
    active: { type: T.BOOLEAN, defaultValue: true },
  }, { tableName: 'amenities' });

  const SpaceAmenity = sequelize.define('SpaceAmenity', {
    space_id: { type: T.UUID, primaryKey: true },
    amenity_id: { type: T.UUID, primaryKey: true },
  }, { tableName: 'space_amenities', timestamps: false });

  // Prices per billing unit. `kind` enables weekend / peak overrides => dynamic pricing ready.
  const PricingRule = sequelize.define('PricingRule', {
    id: id(),
    space_id: { type: T.UUID, allowNull: false },
    unit: { type: T.ENUM('hourly', 'half_day', 'full_day', 'daily', 'weekly', 'monthly'), allowNull: false },
    kind: { type: T.ENUM('base', 'weekend', 'peak'), allowNull: false, defaultValue: 'base' },
    amount: { type: T.DECIMAL(10, 2), allowNull: false },
    peak_start: { type: T.STRING(5) },
    peak_end: { type: T.STRING(5) },
    active: { type: T.BOOLEAN, defaultValue: true },
  }, { tableName: 'pricing_rules', indexes: [{ fields: ['space_id'] }] });

  const AvailabilityRule = sequelize.define('AvailabilityRule', {
    id: id(),
    space_id: { type: T.UUID, allowNull: false },
    weekday: { type: T.SMALLINT, allowNull: false }, // 0 = Sunday .. 6 = Saturday
    opens: { type: T.STRING(5), allowNull: false, defaultValue: '09:00' },
    closes: { type: T.STRING(5), allowNull: false, defaultValue: '21:00' },
    is_closed: { type: T.BOOLEAN, defaultValue: false },
  }, { tableName: 'availability_rules', indexes: [{ unique: true, fields: ['space_id', 'weekday'] }] });

  const BlockedPeriod = sequelize.define('BlockedPeriod', {
    id: id(),
    space_id: { type: T.UUID }, // null => whole location
    location_id: { type: T.UUID },
    start_at: { type: T.DATE, allowNull: false },
    end_at: { type: T.DATE, allowNull: false },
    reason: { type: T.ENUM('blocked', 'maintenance', 'blackout', 'holiday'), defaultValue: 'blocked' },
    note: { type: T.STRING(300) },
    created_by: { type: T.UUID },
  }, { tableName: 'blocked_periods', indexes: [{ fields: ['space_id', 'start_at', 'end_at'] }] });

  const AddOn = sequelize.define('AddOn', {
    id: id(),
    name: i18n(),
    description: i18n(true),
    price: { type: T.DECIMAL(10, 2), allowNull: false },
    pricing_mode: { type: T.ENUM('per_booking', 'per_hour', 'per_person'), defaultValue: 'per_booking' },
    max_quantity: { type: T.INTEGER, defaultValue: 10 },
    image_url: { type: T.STRING(500) },
    applicable_types: { type: T.JSONB }, // array of space type keys, null = all
    active: { type: T.BOOLEAN, defaultValue: true },
    sort: { type: T.INTEGER, defaultValue: 0 },
  }, { tableName: 'add_ons' });

  return { Location, SpaceType, Space, SpaceImage, Amenity, SpaceAmenity, PricingRule, AvailabilityRule, BlockedPeriod, AddOn };
}
