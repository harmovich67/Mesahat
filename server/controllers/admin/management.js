import { Op } from 'sequelize';
import { models, sequelize } from '../../models/index.js';
import { fail } from '../../utils/errors.js';
import { serializeSpaceCard, serializeSpaceDetail, serializeUser } from '../../utils/serializers.js';
import { audit } from '../../services/audit.js';
import { getSettings, updateSettings } from '../../services/settings.js';
import { hashPassword } from '../../services/auth.js';
import { notify } from '../../services/notifications.js';
import { saveSpace, duplicateSpace, getSpaceBySlugOrId, detailIncludes } from '../../services/spaces.js';
import { crud } from '../crud.js';
import { PERMISSIONS, PERMISSION_LABELS } from '../../config/permissions.js';
import { storage, sniffMime } from '../../storage/index.js';
import { config } from '../../config/env.js';

/* ------------------------------ spaces ------------------------------ */
export const spacesList = async (_req, res) => {
  const rows = await models.Space.findAll({ include: detailIncludes(), order: [['created_at', 'DESC']] });
  res.json({ items: rows.map(serializeSpaceDetail) });
};
export const spaceGet = async (req, res) => res.json({ item: serializeSpaceDetail(await getSpaceBySlugOrId(req.params.id, { includeDraft: true })) });
export const spaceCreate = async (req, res) => {
  const id = await saveSpace({ data: req.body, actor: req.user, ip: req.ip });
  res.status(201).json({ item: serializeSpaceDetail(await getSpaceBySlugOrId(id, { includeDraft: true })) });
};
export const spaceUpdate = async (req, res) => {
  await saveSpace({ id: req.params.id, data: req.body, actor: req.user, ip: req.ip });
  res.json({ item: serializeSpaceDetail(await getSpaceBySlugOrId(req.params.id, { includeDraft: true })) });
};
export const spaceStatus = async (req, res) => {
  const space = await models.Space.findByPk(req.params.id);
  if (!space) fail('NOT_FOUND');
  await space.update({ status: req.body.status });
  await audit(req.user, req.body.status === 'archived' ? 'space.archive' : 'space.status', { entityType: 'space', entityId: space.id, label: space.name.ar, meta: { status: req.body.status }, ip: req.ip });
  res.json({ ok: true });
};
export const spaceDuplicate = async (req, res) => {
  const id = await duplicateSpace({ id: req.params.id, actor: req.user, ip: req.ip });
  res.status(201).json({ item: serializeSpaceDetail(await getSpaceBySlugOrId(id, { includeDraft: true })) });
};
export const spaceDelete = async (req, res) => {
  await sequelize.transaction(async (t) => {
    const space = await models.Space.findByPk(req.params.id, { transaction: t });
    if (!space) fail('NOT_FOUND');
    if (await models.Booking.count({ where: { space_id: space.id }, transaction: t })) fail('DELETE_BLOCKED');
    await space.destroy({ transaction: t });
    await audit(req.user, 'space.delete', { entityType: 'space', entityId: space.id, label: space.name.ar, ip: req.ip, transaction: t });
  });
  res.json({ ok: true });
};

/* ------------------------------ catalog CRUD ------------------------------ */
const inUse = (model, field) => async (row, t) => {
  if (await models[model].count({ where: { [field]: row.id }, transaction: t })) fail('DELETE_BLOCKED');
};
export const locationsCrud = crud({ model: 'Location', entity: 'location', order: [['created_at', 'ASC']], beforeDelete: inUse('Space', 'location_id') });
export const spaceTypesCrud = crud({ model: 'SpaceType', entity: 'space_type', order: [['sort', 'ASC']], beforeDelete: inUse('Space', 'type_id') });
export const amenitiesCrud = crud({
  model: 'Amenity', entity: 'amenity', order: [['created_at', 'ASC']],
  beforeDelete: async (row, t) => { await models.SpaceAmenity.destroy({ where: { amenity_id: row.id }, transaction: t }); },
});
export const addOnsCrud = crud({ model: 'AddOn', entity: 'addon', order: [['sort', 'ASC']], beforeDelete: inUse('BookingAddOn', 'add_on_id') });
export const couponsCrud = (() => {
  const base = crud({ model: 'Coupon', entity: 'coupon', order: [['created_at', 'DESC']], beforeDelete: inUse('CouponUsage', 'coupon_id') });
  return {
    ...base,
    list: async (_req, res) => {
      const rows = await models.Coupon.findAll({ order: [['created_at', 'DESC']] });
      const usage = await models.CouponUsage.findAll({ where: { status: { [Op.in]: ['reserved', 'redeemed'] } }, attributes: ['coupon_id', [sequelize.fn('COUNT', sequelize.col('id')), 'n'], [sequelize.fn('SUM', sequelize.col('amount')), 'saved']], group: ['coupon_id'], raw: true });
      res.json({ items: rows.map((c) => ({ ...c.toJSON(), used: Number(usage.find((u) => u.coupon_id === c.id)?.n || 0), total_discount: Number(usage.find((u) => u.coupon_id === c.id)?.saved || 0) })) });
    },
  };
})();

/** Admin image upload for spaces / locations / add-ons / QR codes (public bucket). */
export const uploadImage = async (req, res) => {
  if (!req.file) fail('RECEIPT_UPLOAD_FAILED');
  const mime = sniffMime(req.file.buffer);
  if (!mime || mime === 'application/pdf') fail('RECEIPT_TYPE');
  if (req.file.size > config.storage.maxImageBytes) fail('RECEIPT_SIZE');
  const saved = await storage.save('public', req.file.buffer, mime, 'media');
  res.status(201).json({ url: `/media/${saved.key}` });
};

/* ------------------------------ settings & payment methods ------------------------------ */
export const settingsGet = async (_req, res) => res.json({ settings: await getSettings() });
export const settingsUpdate = async (req, res) => {
  const settings = await sequelize.transaction(async (t) => {
    const out = await updateSettings(req.body, { transaction: t });
    await audit(req.user, 'settings.update', { entityType: 'settings', label: Object.keys(req.body).join(', '), meta: req.body, ip: req.ip, transaction: t });
    return out;
  });
  res.json({ settings });
};

export const paymentMethodsList = async (_req, res) => res.json({ items: await models.PaymentMethod.findAll({ order: [['sort', 'ASC']] }) });
export const paymentMethodUpdate = async (req, res) => {
  const m = await models.PaymentMethod.findOne({ where: { code: req.params.code } });
  if (!m) fail('NOT_FOUND');
  await sequelize.transaction(async (t) => {
    await m.update(req.body, { transaction: t });
    await audit(req.user, 'payment_method.update', { entityType: 'payment_method', entityId: m.id, label: m.name.ar, meta: { active: m.active, account: m.account_identifier }, ip: req.ip, transaction: t });
  });
  res.json({ item: m });
};

/* ------------------------------ team, roles, permissions ------------------------------ */
const teamInclude = [{ model: models.Role, as: 'roles', through: { attributes: [] } }];

export const teamList = async (_req, res) => {
  const rows = await models.User.findAll({ where: { is_staff: true }, include: teamInclude, order: [['created_at', 'ASC']] });
  res.json({ items: rows.map((u) => serializeUser(u)) });
};

async function assertNotLastOwner(userId, nextRoleIds, nextStatus, t) {
  const owner = await models.Role.findOne({ where: { key: 'owner' }, transaction: t });
  const isOwner = await models.UserRole.findOne({ where: { user_id: userId, role_id: owner.id }, transaction: t });
  if (!isOwner) return;
  const losing = (nextRoleIds && !nextRoleIds.includes(owner.id)) || nextStatus === 'suspended';
  if (!losing) return;
  const owners = await models.UserRole.count({ where: { role_id: owner.id }, transaction: t });
  if (owners <= 1) fail('FORBIDDEN', { message: 'لا يمكن إزالة آخر مالك للحساب.' });
}

export const teamCreate = async (req, res) => {
  const { role_ids: roleIds, password, ...fields } = req.body;
  const user = await sequelize.transaction(async (t) => {
    if (await models.User.findOne({ where: { email: fields.email }, transaction: t })) fail('EMAIL_TAKEN');
    const created = await models.User.create({ ...fields, is_staff: true, password_hash: await hashPassword(password || 'ChangeMe#2025') }, { transaction: t });
    await created.setRoles(roleIds, { transaction: t });
    await audit(req.user, 'team.create', { entityType: 'user', entityId: created.id, label: created.name, ip: req.ip, transaction: t });
    return created;
  });
  res.status(201).json({ item: serializeUser(await models.User.findByPk(user.id, { include: teamInclude })) });
};
export const teamUpdate = async (req, res) => {
  const { role_ids: roleIds, password, ...fields } = req.body;
  await sequelize.transaction(async (t) => {
    const user = await models.User.findOne({ where: { id: req.params.id, is_staff: true }, transaction: t });
    if (!user) fail('NOT_FOUND');
    await assertNotLastOwner(user.id, roleIds, fields.status, t);
    if (password) fields.password_hash = await hashPassword(password);
    await user.update(fields, { transaction: t });
    if (roleIds) await user.setRoles(roleIds, { transaction: t });
    await audit(req.user, 'team.update', { entityType: 'user', entityId: user.id, label: user.name, meta: { roles: roleIds, status: fields.status }, ip: req.ip, transaction: t });
  });
  res.json({ item: serializeUser(await models.User.findByPk(req.params.id, { include: teamInclude })) });
};

export const rolesList = async (_req, res) => {
  const roles = await models.Role.findAll({ include: [{ model: models.Permission, as: 'permissions', through: { attributes: [] } }, { model: models.User, as: 'users', attributes: ['id'], through: { attributes: [] } }], order: [['created_at', 'ASC']] });
  res.json({
    items: roles.map((r) => ({ id: r.id, key: r.key, name: r.name, is_system: r.is_system, users_count: r.users.length, permission_keys: r.permissions.map((p) => p.key) })),
    catalog: Object.entries(PERMISSIONS).map(([group, keys]) => ({ group, permissions: keys.map((k) => ({ key: k, label: PERMISSION_LABELS[k] })) })),
  });
};
export const roleCreate = async (req, res) => {
  const { permission_keys: keys, ...fields } = req.body;
  const role = await sequelize.transaction(async (t) => {
    const created = await models.Role.create({ ...fields, is_system: false }, { transaction: t });
    await created.setPermissions(await models.Permission.findAll({ where: { key: { [Op.in]: keys } }, transaction: t }), { transaction: t });
    await audit(req.user, 'role.create', { entityType: 'role', entityId: created.id, label: created.name.ar, ip: req.ip, transaction: t });
    return created;
  });
  res.status(201).json({ item: role });
};
export const roleUpdate = async (req, res) => {
  await sequelize.transaction(async (t) => {
    const role = await models.Role.findByPk(req.params.id, { transaction: t });
    if (!role) fail('NOT_FOUND');
    if (role.key === 'owner') fail('FORBIDDEN', { message: 'لا يمكن تعديل صلاحيات المالك.' });
    const { permission_keys: keys, key, ...fields } = req.body;
    await role.update(role.is_system ? { name: fields.name || role.name } : fields, { transaction: t });
    if (keys) await role.setPermissions(await models.Permission.findAll({ where: { key: { [Op.in]: keys } }, transaction: t }), { transaction: t });
    await audit(req.user, 'role.update', { entityType: 'role', entityId: role.id, label: role.name.ar, meta: { permissions: keys }, ip: req.ip, transaction: t });
  });
  res.json({ ok: true });
};
export const roleDelete = async (req, res) => {
  await sequelize.transaction(async (t) => {
    const role = await models.Role.findByPk(req.params.id, { transaction: t });
    if (!role) fail('NOT_FOUND');
    if (role.is_system) fail('FORBIDDEN', { message: 'لا يمكن حذف دور أساسي.' });
    if (await models.UserRole.count({ where: { role_id: role.id }, transaction: t })) fail('DELETE_BLOCKED');
    await role.destroy({ transaction: t });
    await audit(req.user, 'role.delete', { entityType: 'role', entityId: role.id, label: role.name.ar, ip: req.ip, transaction: t });
  });
  res.json({ ok: true });
};

/* ------------------------------ admin → customer message ------------------------------ */
export const sendMessage = async (req, res) => {
  const user = await models.User.findByPk(req.body.user_id);
  if (!user) fail('NOT_FOUND');
  await notify(user, 'admin_message', { title: req.body.title, message: req.body.message });
  await audit(req.user, 'notification.send', { entityType: 'user', entityId: user.id, label: user.name, ip: req.ip });
  res.json({ ok: true });
};

export { serializeSpaceCard };
