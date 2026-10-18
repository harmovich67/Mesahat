import { Op } from 'sequelize';
import { models } from '../models/index.js';
import { TEMPLATES, renderEmail } from '../emails/templates.js';
import { emailService } from '../emails/service.js';
import { getSettings } from './settings.js';

/**
 * Creates an in-app notification and (after the surrounding transaction commits)
 * sends the matching email. Safe to call inside business transactions.
 */
export async function notify(user, type, ctx = {}, { transaction, link, email = true } = {}) {
  const tpl = TEMPLATES[type];
  if (!tpl || !user) return null;
  const note = await models.Notification.create({
    user_id: user.id,
    type,
    title: tpl.title(ctx),
    body: tpl.body(ctx),
    link: link || null,
    data: ctx.booking_id ? { booking_id: ctx.booking_id } : null,
  }, { transaction });

  const send = async () => {
    const settings = await getSettings();
    if (!email || !settings.notifications.email_enabled || !user.email) return;
    const mail = renderEmail(type, ctx, user.locale || 'ar');
    if (mail) await emailService.send({ to: user.email, ...mail });
  };
  if (transaction) transaction.afterCommit(() => { send(); });
  else send();
  return note;
}

/** Notifies every staff member holding the given permission (or a wildcard owner). */
export async function notifyStaff(permission, type, ctx, opts = {}) {
  const staff = await models.User.findAll({
    where: { is_staff: true, status: 'active' },
    include: [{ model: models.Role, as: 'roles', include: [{ model: models.Permission, as: 'permissions' }] }],
    transaction: opts.transaction,
  });
  const targets = staff.filter((u) => u.roles.some((r) => r.key === 'owner' || r.permissions.some((p) => p.key === permission)));
  for (const u of targets) await notify(u, type, ctx, { ...opts, email: false });
}

export async function unreadCount(userId) {
  return models.Notification.count({ where: { user_id: userId, read_at: { [Op.is]: null } } });
}
