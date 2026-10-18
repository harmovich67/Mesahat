import { models, sequelize } from '../models/index.js';
import { fail } from '../utils/errors.js';
import { audit } from '../services/audit.js';

/**
 * Generic admin CRUD. Keeps controllers thin: validation happens in middleware, RBAC in routes,
 * every mutation is audited, and FK-protected deletes turn into friendly errors.
 */
export function crud({ model, entity, labelOf, order = [['created_at', 'DESC']], include, beforeDelete }) {
  const M = () => models[model];
  const label = (row) => (labelOf ? labelOf(row) : row.name?.ar || row.code || row.key || row.id);
  return {
    list: async (_req, res) => res.json({ items: await M().findAll({ order, include }) }),
    get: async (req, res) => {
      const row = await M().findByPk(req.params.id, { include });
      if (!row) fail('NOT_FOUND');
      res.json({ item: row });
    },
    create: async (req, res) => {
      const row = await sequelize.transaction(async (t) => {
        const created = await M().create(req.body, { transaction: t });
        await audit(req.user, `${entity}.create`, { entityType: entity, entityId: created.id, label: label(created), ip: req.ip, transaction: t });
        return created;
      });
      res.status(201).json({ item: row });
    },
    update: async (req, res) => {
      const row = await sequelize.transaction(async (t) => {
        const found = await M().findByPk(req.params.id, { transaction: t });
        if (!found) fail('NOT_FOUND');
        await found.update(req.body, { transaction: t });
        await audit(req.user, `${entity}.update`, { entityType: entity, entityId: found.id, label: label(found), ip: req.ip, transaction: t });
        return found;
      });
      res.json({ item: row });
    },
    remove: async (req, res) => {
      await sequelize.transaction(async (t) => {
        const found = await M().findByPk(req.params.id, { transaction: t });
        if (!found) fail('NOT_FOUND');
        if (beforeDelete) await beforeDelete(found, t);
        await found.destroy({ transaction: t });
        await audit(req.user, `${entity}.delete`, { entityType: entity, entityId: found.id, label: label(found), ip: req.ip, transaction: t });
      });
      res.json({ ok: true });
    },
  };
}
