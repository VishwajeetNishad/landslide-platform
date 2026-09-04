/**
 * src/core/audit.js -- Reusable helper for writing to the append-only audit_log table.
 *
 * Implements ARCHITECTURE.md §20 / IMPLEMENTATION_STEPS.md V11/V13.
 *
 * All state modifications involving human-in-the-loop decisions
 * (prediction verification, alert authorization/rejection) MUST pass
 * through this helper within the caller's transaction.
 */

/**
 * Record an entry into the audit_log table.
 *
 * @param {object} client - pg client or pool with a .query() method
 * @param {object} params
 * @param {number|null} params.actorId - app_user.id or null for system actions
 * @param {string} params.actorLabel - human-readable name of the actor at this instant
 * @param {string} params.action - e.g. 'PREDICTION_VERIFIED', 'ALERT_AUTHORISED'
 * @param {string} params.entity - e.g. 'prediction', 'alert'
 * @param {string|number} params.entityId - ID of the entity being acted upon
 * @param {object|null} params.before - JSON state before change
 * @param {object|null} params.after - JSON state after change
 */
export async function recordAudit(
  client,
  { actorId = null, actorLabel, action, entity, entityId, before = null, after = null },
) {
  if (!actorLabel || typeof actorLabel !== 'string' || !actorLabel.trim()) {
    throw new Error('Audit log requires a non-empty actorLabel');
  }
  if (!action || typeof action !== 'string' || !action.trim()) {
    throw new Error('Audit log requires a non-empty action');
  }
  if (!entity || typeof entity !== 'string' || !entity.trim()) {
    throw new Error('Audit log requires a non-empty entity');
  }

  const query = `
    INSERT INTO audit_log (actor_id, actor_label, action, entity, entity_id, before, after)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, ts, actor_id, actor_label, action, entity, entity_id, before, after
  `;

  const params = [
    actorId ? Number(actorId) : null,
    actorLabel.trim(),
    action.trim(),
    entity.trim(),
    entityId != null ? String(entityId) : null,
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null,
  ];

  const { rows } = await client.query(query, params);
  return rows[0];
}
