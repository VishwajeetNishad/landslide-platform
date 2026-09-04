/**
 * src/routes/audit.js -- Audit log query API (Step V13).
 *
 * Implements ARCHITECTURE.md §20 / IMPLEMENTATION_STEPS.md V13.
 *
 * Provides authorized officers and administrators with a verifiable,
 * chronological audit trail of all human decisions and safety gate transitions:
 *   - PREDICTION_VERIFIED
 *   - ALERT_AUTHORISED
 *   - ALERT_REJECTED
 *   - ALERT_DISPATCHED
 */

import { authenticate } from '../core/auth.js';
import { requireRole, ROLES } from '../core/rbac.js';
import { getPool, query } from '../db/pool.js';

function requireDatabase() {
  if (getPool() === null) {
    const err = new Error(
      'The database is not configured, so audit records cannot be retrieved. ' +
        'Set DATABASE_URL and run: npm run migrate',
    );
    err.statusCode = 503;
    throw err;
  }
}

export async function registerAuditRoutes(app) {
  app.get(
    '/api/v1/audit-log',
    {
      preHandler: [
        authenticate,
        requireRole(ROLES.SUPER_ADMIN, ROLES.DISTRICT_ADMIN, ROLES.FIELD_OFFICER),
      ],
      schema: {
        tags: ['audit'],
        summary: 'Query immutable audit log of human decisions and safety transitions',
        description:
          'Returns paginated audit records for compliance, governance, and post-event analysis. ' +
          'All records are protected by database triggers that forbid UPDATE and DELETE.',
        querystring: {
          type: 'object',
          properties: {
            entity: { type: 'string', description: 'Filter by entity type (e.g. prediction, alert)' },
            entity_id: { type: 'string', description: 'Filter by entity identifier' },
            action: { type: 'string', description: 'Filter by action name (e.g. ALERT_AUTHORISED)' },
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    ts: { type: 'string' },
                    actor_id: { type: ['integer', 'null'] },
                    actor_label: { type: 'string' },
                    action: { type: 'string' },
                    entity: { type: 'string' },
                    entity_id: { type: ['string', 'null'] },
                    before: { type: ['object', 'null'], additionalProperties: true },
                    after: { type: ['object', 'null'], additionalProperties: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      requireDatabase();
      const { entity, entity_id, action, limit = 50, offset = 0 } = request.query;

      let whereClause = ' WHERE 1=1';
      const params = [];

      if (entity) {
        params.push(entity.trim());
        whereClause += ` AND entity = $${params.length}`;
      }
      if (entity_id) {
        params.push(entity_id.trim());
        whereClause += ` AND entity_id = $${params.length}`;
      }
      if (action) {
        params.push(action.trim());
        whereClause += ` AND action = $${params.length}`;
      }

      // 1. Get total count
      const countSql = `SELECT count(*)::int AS total FROM audit_log${whereClause}`;
      const { rows: countRows } = await query(countSql, params);
      const total = countRows[0].total;

      // 2. Get paginated items
      params.push(limit);
      const limitParamIdx = params.length;
      params.push(offset);
      const offsetParamIdx = params.length;

      const dataSql = `
        SELECT id, ts, actor_id, actor_label, action, entity, entity_id, before, after
        FROM audit_log
        ${whereClause}
        ORDER BY ts DESC, id DESC
        LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
      `;
      const { rows } = await query(dataSql, params);

      return {
        total,
        limit,
        offset,
        items: rows.map((r) => ({
          id: Number(r.id),
          ts: r.ts.toISOString(),
          actor_id: r.actor_id !== null ? Number(r.actor_id) : null,
          actor_label: r.actor_label,
          action: r.action,
          entity: r.entity,
          entity_id: r.entity_id,
          before: r.before,
          after: r.after,
        })),
      };
    },
  );
}
