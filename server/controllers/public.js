import { Op } from 'sequelize';
import { models, sequelize } from '../models/index.js';
import { fail } from '../utils/errors.js';
import { serializeSpaceCard, serializeSpaceDetail } from '../utils/serializers.js';
import { getPublicSettings, getSettings } from '../services/settings.js';
import { searchSpaces, matchSpaces, getSpaceBySlugOrId, cardIncludes } from '../services/spaces.js';
import { availabilityReport } from '../services/availability.js';
import { quoteBooking, loadSpaceFull } from '../services/bookings.js';
import { publicQuote } from '../services/pricing.js';
import { emailService } from '../emails/service.js';
import { notifyStaff } from '../services/notifications.js';

export const settings = async (_req, res) => res.json({ settings: await getPublicSettings() });

export const spaceTypes = async (_req, res) => {
  const [types, counts] = await Promise.all([
    models.SpaceType.findAll({ where: { active: true }, order: [['sort', 'ASC']] }),
    models.Space.findAll({ where: { status: 'active' }, attributes: ['type_id', [sequelize.fn('COUNT', sequelize.col('id')), 'n']], group: ['type_id'], raw: true }),
  ]);
  const byType = new Map(counts.map((c) => [c.type_id, Number(c.n)]));
  res.json({ items: types.map((t) => ({ ...t.toJSON(), space_count: byType.get(t.id) || 0 })) });
};

export const locations = async (_req, res) => {
  const rows = await models.Location.findAll({ where: { active: true }, order: [['created_at', 'ASC']], include: [{ model: models.Space, as: 'spaces', where: { status: 'active' }, required: false, attributes: ['id'] }] });
  res.json({ items: rows.map((l) => ({ ...l.toJSON(), space_count: l.spaces.length, spaces: undefined })) });
};

export const locationDetail = async (req, res) => {
  const loc = await models.Location.findOne({ where: { slug: req.params.slug, active: true } });
  if (!loc) fail('NOT_FOUND');
  const spaces = await models.Space.findAll({ where: { location_id: loc.id, status: 'active' }, include: cardIncludes() });
  res.json({ item: loc, spaces: spaces.map(serializeSpaceCard) });
};

export const amenities = async (_req, res) => res.json({ items: await models.Amenity.findAll({ where: { active: true }, order: [['created_at', 'ASC']] }) });

export const addOns = async (req, res) => {
  const where = { active: true };
  const rows = await models.AddOn.findAll({ where, order: [['sort', 'ASC']] });
  const type = req.query.type;
  res.json({ items: rows.filter((a) => !type || !a.applicable_types?.length || a.applicable_types.includes(type)) });
};

/** Only public-safe payment instructions; never any internal fields. */
export const paymentMethods = async (_req, res) => {
  const rows = await models.PaymentMethod.findAll({ where: { active: true }, order: [['sort', 'ASC']] });
  res.json({ items: rows.map((m) => ({ code: m.code, name: m.name, account_identifier: m.account_identifier, account_name: m.account_name, instructions: m.instructions, qr_image_url: m.qr_image_url })) });
};

export const listSpaces = async (req, res) => res.json(await searchSpaces(req.query));

export const spaceDetail = async (req, res) => {
  const space = await getSpaceBySlugOrId(req.params.id);
  const reviews = await models.Review.findAll({
    where: { space_id: space.id, status: 'approved' }, order: [['featured', 'DESC'], ['created_at', 'DESC']], limit: 20,
    include: [{ model: models.User, as: 'author', attributes: ['id', 'name', 'avatar_url'] }],
  });
  const dist = await models.Review.findAll({ where: { space_id: space.id, status: 'approved' }, attributes: ['rating', [sequelize.fn('COUNT', sequelize.col('id')), 'n']], group: ['rating'], raw: true });
  res.json({
    item: serializeSpaceDetail(space),
    reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, images: r.images, featured: r.featured, created_at: (r.createdAt ?? r.created_at), author: { name: r.author.name.split(' ')[0] + ' ' + (r.author.name.split(' ')[1]?.[0] || ''), avatar_url: r.author.avatar_url } })),
    rating_distribution: Object.fromEntries([5, 4, 3, 2, 1].map((n) => [n, Number(dist.find((d) => d.rating === n)?.n || 0)])),
  });
};

export const availability = async (req, res) => {
  const space = await loadSpaceFull((await getSpaceBySlugOrId(req.params.id)).id);
  const settings = await getSettings();
  const today = new Date().toISOString().slice(0, 10);
  const from = req.query.from || req.query.date || today;
  const to = req.query.to || req.query.date || from;
  res.json(await availabilityReport({
    space, rules: space.hours, pricing: space.pricing, settings, unit: req.query.unit, durationMinutes: req.query.duration,
    from, to, detailDate: req.query.date,
  }));
};

/** Public live quote (price preview). Same engine as booking creation. */
export const quote = async (req, res) => {
  const { quote: q } = await quoteBooking({ userId: req.user?.id, input: req.body });
  res.json({ quote: publicQuote(q) });
};

export const match = async (req, res) => res.json({ items: await matchSpaces(req.query) });

export const reviewsForSpace = async (req, res) => {
  const space = await getSpaceBySlugOrId(req.params.id);
  const rows = await models.Review.findAll({ where: { space_id: space.id, status: 'approved', comment: { [Op.ne]: null } }, order: [['created_at', 'DESC']], limit: 50, include: [{ model: models.User, as: 'author', attributes: ['name'] }] });
  res.json({ items: rows });
};

/** Featured reviews for the marketing site. */
export const featuredReviews = async (_req, res) => {
  const rows = await models.Review.findAll({
    where: { status: 'approved', featured: true }, limit: 6, order: [['created_at', 'DESC']],
    include: [{ model: models.User, as: 'author', attributes: ['name', 'company'] }, { model: models.Space, as: 'space', attributes: ['name', 'slug'] }],
  });
  res.json({ items: rows.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, author: { name: r.author.name, company: r.author.company }, space: r.space })) });
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Contact form: emails the business inbox and raises an in-app alert for staff who can message customers. */
export const contact = async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  const settings = await getSettings();
  await emailService.send({
    to: settings.general.email,
    replyTo: email,
    subject: `[WORKORA] ${subject || 'رسالة تواصل جديدة'} — ${name}`,
    text: `${name} <${email}> ${phone || ''}\n\n${message}`,
    html: `<p><b>${escapeHtml(name)}</b> &lt;${escapeHtml(email)}&gt; ${escapeHtml(phone || '')}</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
  });
  await notifyStaff('notifications.send', 'contact_message', { name, message }, { link: '/admin' }).catch(() => {});
  res.status(202).json({ ok: true });
};
