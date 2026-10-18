import { Op } from 'sequelize';
import { DateTime } from 'luxon';
import { models, sequelize } from '../models/index.js';
import { fail } from '../utils/errors.js';
import { serializeSpaceCard } from '../utils/serializers.js';
import { getSettings } from './settings.js';
import { availabilityReport, isRangeAvailable } from './availability.js';
import { audit } from './audit.js';

export const cardIncludes = () => [
  { model: models.SpaceType, as: 'type' },
  { model: models.Location, as: 'location' },
  { model: models.SpaceImage, as: 'images' },
  { model: models.Amenity, as: 'amenities', through: { attributes: [] } },
  { model: models.PricingRule, as: 'pricing' },
];
export const detailIncludes = () => [...cardIncludes(), { model: models.AvailabilityRule, as: 'hours' }];

const lowestPrice = (s, unit) => {
  const base = s.pricing.filter((p) => p.kind === 'base' && p.active && (!unit || p.unit === unit));
  return base.length ? Math.min(...base.map((p) => Number(p.amount))) : null;
};

/** Public search. Date/time filters are enforced against real availability, not guessed on the client. */
export async function searchSpaces(query) {
  const settings = await getSettings();
  const where = { status: 'active' };
  const include = cardIncludes();
  if (query.capacity) where.capacity = { [Op.gte]: query.capacity };
  if (query.featured) where.featured = true;
  if (query.q) {
    where[Op.or] = [
      sequelize.where(sequelize.cast(sequelize.col('Space.name'), 'text'), { [Op.iLike]: `%${query.q}%` }),
    ];
  }
  if (query.location) include.find((i) => i.as === 'location').where = { [Op.or]: [{ slug: query.location }, { id: /^[0-9a-f-]{36}$/i.test(query.location) ? query.location : null }] };
  if (query.type) include.find((i) => i.as === 'type').where = { key: query.type };
  if (query.group) include.find((i) => i.as === 'type').where = { group: query.group };

  let rows = await models.Space.findAll({ where, include, order: [['featured', 'DESC'], ['created_at', 'ASC']] });

  if (query.min_price != null || query.max_price != null) {
    rows = rows.filter((s) => {
      const p = lowestPrice(s, query.unit);
      if (p == null) return false;
      return (query.min_price == null || p >= query.min_price) && (query.max_price == null || p <= query.max_price);
    });
  } else if (query.unit) {
    rows = rows.filter((s) => lowestPrice(s, query.unit) != null);
  }

  const availability = {};
  if (query.date && query.start_time && query.end_time) {
    const tz = settings.general.timezone;
    const start = DateTime.fromISO(`${query.date}T${query.start_time}`, { zone: tz });
    const end = DateTime.fromISO(`${query.date}T${query.end_time}`, { zone: tz });
    if (start.isValid && end > start && start > DateTime.now()) {
      const full = await models.Space.findAll({ where: { id: { [Op.in]: rows.map((r) => r.id) } }, include: [{ model: models.AvailabilityRule, as: 'hours' }] });
      const hoursBy = new Map(full.map((f) => [f.id, f.hours]));
      const kept = [];
      for (const s of rows) {
        const rule = hoursBy.get(s.id)?.find((h) => h.weekday === start.weekday % 7);
        const within = rule && !rule.is_closed && query.start_time >= rule.opens && query.end_time <= rule.closes;
        const free = within ? await isRangeAvailable({ space: s, start, end }) : { ok: false, remaining: 0 };
        availability[s.id] = free.ok ? (s.units > 1 && free.remaining / s.units <= 0.25 ? 'limited' : 'available') : 'unavailable';
        if (free.ok) kept.push(s);
      }
      rows = kept;
    }
  }

  const sorters = {
    price_asc: (a, b) => (lowestPrice(a) ?? 0) - (lowestPrice(b) ?? 0),
    price_desc: (a, b) => (lowestPrice(b) ?? 0) - (lowestPrice(a) ?? 0),
    rating: (a, b) => Number(b.rating_avg) - Number(a.rating_avg),
    capacity: (a, b) => b.capacity - a.capacity,
  };
  if (sorters[query.sort]) rows.sort(sorters[query.sort]);

  const total = rows.length;
  const page = rows.slice((query.page - 1) * query.limit, query.page * query.limit);
  return {
    total,
    page: query.page,
    items: page.map((s) => ({ ...serializeSpaceCard(s), availability: availability[s.id] || null })),
  };
}

const PURPOSE_TYPES = {
  meeting: ['meeting_room', 'private_room', 'conference_room'],
  focus: ['private_office', 'private_room', 'dedicated_desk', 'coworking_desk', 'hot_desk'],
  interview: ['private_room', 'meeting_room'],
  workshop: ['training_room', 'conference_room', 'event_space'],
  team: ['meeting_room', 'conference_room', 'private_office'],
  event: ['event_space', 'training_room', 'conference_room'],
};
const PEOPLE = { '1-2': [1, 2], '3-6': [3, 6], '7-15': [7, 15], '15+': [16, 500] };

/** "Space Match": scores every active space against the visitor's intent. */
export async function matchSpaces({ purpose, people, hours, location }) {
  const rows = await models.Space.findAll({ where: { status: 'active' }, include: cardIncludes() });
  const [minP, maxP] = PEOPLE[people];
  const preferred = PURPOSE_TYPES[purpose];
  const scored = rows
    .filter((s) => !location || s.location?.slug === location)
    .map((s) => {
      let score = 0;
      const reasons = [];
      const typeIdx = preferred.indexOf(s.type.key);
      if (typeIdx >= 0) { score += 50 - typeIdx * 8; reasons.push('type'); }
      if (s.capacity >= minP && s.capacity <= Math.max(maxP, minP * 2)) { score += 30; reasons.push('capacity'); }
      else if (s.capacity >= minP) { score += 12; reasons.push('capacity_ok'); }
      else score -= 60;
      if (s.capacity > maxP * 3) score -= 15;
      if (['workshop', 'event'].includes(purpose) && s.amenities.some((a) => ['projector', 'whiteboard', 'sound_system'].includes(a.key))) { score += 10; reasons.push('equipment'); }
      if (['meeting', 'interview', 'team'].includes(purpose) && s.amenities.some((a) => ['smart_tv', 'video_conferencing', 'whiteboard'].includes(a.key))) { score += 8; reasons.push('equipment'); }
      if (purpose === 'focus' && s.amenities.some((a) => a.key === 'quiet_zone' || a.key === 'power_outlets')) { score += 8; reasons.push('focus'); }
      score += Number(s.rating_avg) * 2;
      const hourly = s.pricing.find((p) => p.unit === 'hourly' && p.kind === 'base' && p.active);
      const daily = s.pricing.find((p) => ['daily', 'full_day'].includes(p.unit) && p.kind === 'base' && p.active);
      const est = hourly ? Number(hourly.amount) * hours : daily ? Number(daily.amount) : null;
      return { s, score, reasons, est };
    })
    .filter((x) => x.score > 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  return scored.map((x, i) => ({
    ...serializeSpaceCard(x.s), match_score: Math.max(60, Math.min(99, Math.round(x.score))), match_reasons: x.reasons, estimated_total: x.est, best: i === 0,
  }));
}

export async function getSpaceBySlugOrId(key, { includeDraft = false } = {}) {
  const isId = /^[0-9a-f-]{36}$/i.test(key);
  const space = await models.Space.findOne({
    where: { ...(isId ? { id: key } : { slug: key }), ...(includeDraft ? {} : { status: 'active' }) },
    include: detailIncludes(),
  });
  if (!space) fail('NOT_FOUND');
  return space;
}

export async function refreshRating(spaceId, transaction) {
  const [row] = await models.Review.findAll({
    where: { space_id: spaceId, status: 'approved' },
    attributes: [[sequelize.fn('AVG', sequelize.col('rating')), 'avg'], [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
    raw: true, transaction,
  });
  await models.Space.update({ rating_avg: Number(row.avg || 0).toFixed(2), rating_count: Number(row.n) }, { where: { id: spaceId }, transaction });
}

/** Creates or updates a space with all nested data atomically. */
export async function saveSpace({ id, data, actor, ip }) {
  return sequelize.transaction(async (t) => {
    const { images, amenity_ids: amenityIds, pricing, hours, ...fields } = data;
    let space;
    if (id) {
      space = await models.Space.findByPk(id, { transaction: t, include: [{ model: models.PricingRule, as: 'pricing' }] });
      if (!space) fail('NOT_FOUND');
      const before = Object.fromEntries(space.pricing.map((p) => [`${p.unit}:${p.kind}`, Number(p.amount)]));
      await space.update(fields, { transaction: t });
      if (pricing) {
        const after = Object.fromEntries(pricing.map((p) => [`${p.unit}:${p.kind}`, Number(p.amount)]));
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          await audit(actor, 'space.price_change', { entityType: 'space', entityId: space.id, label: space.name.ar, meta: { before, after }, ip, transaction: t });
        }
      }
    } else {
      space = await models.Space.create(fields, { transaction: t });
    }
    if (images) {
      await models.SpaceImage.destroy({ where: { space_id: space.id }, transaction: t });
      await models.SpaceImage.bulkCreate(images.map((im, i) => ({ ...im, space_id: space.id, sort: i })), { transaction: t });
    }
    if (amenityIds) await space.setAmenities(amenityIds, { transaction: t });
    if (pricing) {
      await models.PricingRule.destroy({ where: { space_id: space.id }, transaction: t });
      await models.PricingRule.bulkCreate(pricing.map((p) => ({ ...p, space_id: space.id })), { transaction: t });
    }
    if (hours) {
      await models.AvailabilityRule.destroy({ where: { space_id: space.id }, transaction: t });
      await models.AvailabilityRule.bulkCreate(hours.map((h) => ({ ...h, space_id: space.id })), { transaction: t });
    } else if (!id) {
      await models.AvailabilityRule.bulkCreate([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ space_id: space.id, weekday, opens: '09:00', closes: '21:00', is_closed: weekday === 5 })), { transaction: t });
    }
    await audit(actor, id ? 'space.update' : 'space.create', { entityType: 'space', entityId: space.id, label: space.name.ar, ip, transaction: t });
    return space.id;
  });
}

export async function duplicateSpace({ id, actor, ip }) {
  const src = await getSpaceBySlugOrId(id, { includeDraft: true });
  const copySlug = `${src.slug}-copy-${Date.now().toString(36).slice(-4)}`;
  return saveSpace({
    actor, ip,
    data: {
      slug: copySlug,
      name: { ar: `${src.name.ar} (نسخة)`, en: `${src.name.en || ''} (Copy)` },
      description: src.description, rules: src.rules, type_id: src.type_id, location_id: src.location_id,
      capacity: src.capacity, units: src.units, area_sqm: src.area_sqm, floor: src.floor, status: 'draft', featured: false,
      buffer_minutes: src.buffer_minutes,
      images: src.images.map((i) => ({ url: i.url, alt: i.alt })),
      amenity_ids: src.amenities.map((a) => a.id),
      pricing: src.pricing.map((p) => ({ unit: p.unit, kind: p.kind, amount: Number(p.amount), peak_start: p.peak_start, peak_end: p.peak_end, active: p.active })),
      hours: src.hours.map((h) => ({ weekday: h.weekday, opens: h.opens, closes: h.closes, is_closed: h.is_closed })),
    },
  });
}

export { availabilityReport };
