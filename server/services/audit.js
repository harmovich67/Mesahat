import { models } from '../models/index.js';

/**
 * Records an important admin action. Pass the active `transaction` so the audit
 * entry commits atomically with the change it describes.
 */
export async function audit(actor, action, { entityType, entityId, label, meta, ip, transaction } = {}) {
  return models.AuditLog.create({
    actor_id: actor?.id || null,
    actor_name: actor?.name || 'النظام',
    action,
    entity_type: entityType || null,
    entity_id: entityId ? String(entityId) : null,
    entity_label: label || null,
    meta: meta || null,
    ip: ip || null,
  }, { transaction });
}
