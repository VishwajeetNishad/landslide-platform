/**
 * src/routes/alerts.js -- Disaster alert state machine and human authorization gate (Step V12).
 *
 * Implements ARCHITECTURE.md §14, §20 / IMPLEMENTATION_STEPS.md V12.
 *
 * State machine:
 *   DRAFT -> PENDING_AUTHORISATION -> AUTHORISED / REJECTED -> DISPATCHED
 *
 * THE SAFETY GATE:
 * No alert can reach DISPATCHED without a named human officer in authorised_by.
 * This is enforced at the database level by CHECK constraint
 * `alert_must_be_authorised_before_dispatch`.
 */

import { authenticate } from '../core/auth.js';
import { assertDistrictAccess, requireRole, ROLES } from '../core/rbac.js';
import { recordAudit } from '../core/audit.js';
import { getPool, query, withTransaction } from '../db/pool.js';

function requireDatabase() {
  if (getPool() === null) {
    const err = new Error(
      'The database is not configured, so alerts cannot be managed. ' +
        'Set DATABASE_URL and run: npm run migrate',
    );
    err.statusCode = 503;
    throw err;
  }
}

export async function registerAlertRoutes(app) {
  // ---------- POST /api/v1/alerts/draft ----------
  // System or authorized user drafts an alert from a prediction.
  app.post(
    '/api/v1/alerts/draft',
    {
      preHandler: authenticate,
      schema: {
        tags: ['alerts'],
        summary: 'Draft a disaster alert for a prediction (starts in PENDING_AUTHORISATION)',
        body: {
          type: 'object',
          required: ['prediction_id'],
          properties: {
            prediction_id: { type: 'integer' },
            severity: {
              type: 'string',
              enum: ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'],
              default: 'Severe',
            },
            headline: { type: 'string' },
            body: { type: 'string' },
            channels: {
              type: 'array',
              items: { type: 'string', enum: ['SMS', 'APP', 'IVR', 'CAP'] },
              default: ['SMS', 'APP'],
            },
          },
          additionalProperties: false,
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              prediction_id: { type: 'integer' },
              status: { type: 'string' },
              severity: { type: 'string' },
              headline: { type: 'string' },
              body: { type: 'string' },
              channels: { type: 'array', items: { type: 'string' } },
              created_at: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      requireDatabase();
      const { prediction_id, severity = 'Severe', headline, body, channels = ['SMS', 'APP'] } = request.body;

      // Verify prediction exists and get district
      const { rows: pRows } = await query(
        `SELECT p.id, p.slope_unit_id, p.risk_level, p.probability, s.district_id, s.ward_name
         FROM prediction p
         JOIN slope_unit s ON s.id = p.slope_unit_id
         WHERE p.id = $1`,
        [prediction_id],
      );

      if (pRows.length === 0) {
        const err = new Error(`No prediction with id '${prediction_id}'`);
        err.statusCode = 404;
        throw err;
      }

      const p = pRows[0];
      const defaultHeadline = headline || `Landslide Risk Warning: ${p.ward_name || p.slope_unit_id}`;
      const defaultBody =
        body ||
        `High failure probability (${Math.round(p.probability * 100)}%) detected for slope unit ${p.slope_unit_id}. ` +
          `Impact risk: ${p.risk_level ?? 'ASSESSED'}. Evacuation / road caution advised.`;

      const { rows } = await query(
        `INSERT INTO alert (prediction_id, status, severity, headline, body, channels)
         VALUES ($1, 'PENDING_AUTHORISATION', $2, $3, $4, $5::jsonb)
         RETURNING id, prediction_id, status, severity, headline, body, channels, created_at`,
        [prediction_id, severity, defaultHeadline, defaultBody, JSON.stringify(channels)],
      );

      reply.code(201);
      const row = rows[0];
      return {
        id: Number(row.id),
        prediction_id: Number(row.prediction_id),
        status: row.status,
        severity: row.severity,
        headline: row.headline,
        body: row.body,
        channels: row.channels,
        created_at: row.created_at.toISOString(),
      };
    },
  );

  // ---------- GET /api/v1/alerts ----------
  // Query alerts with optional status and district filter
  app.get(
    '/api/v1/alerts',
    {
      schema: {
        tags: ['alerts'],
        summary: 'List disaster alerts with exposure and decision card context',
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['DRAFT', 'PENDING_AUTHORISATION', 'AUTHORISED', 'REJECTED', 'DISPATCHED', 'EXPIRED'],
            },
            district: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      requireDatabase();
      const { status, district } = request.query;

      let sql = `
        SELECT a.id, a.prediction_id, a.status, a.severity, a.headline, a.body, a.channels,
               a.authorised_by, u_auth.full_name AS authorised_by_name, a.authorised_at,
               a.rejected_by, u_rej.full_name AS rejected_by_name, a.rejected_at, a.rejection_reason,
               a.dispatched_at, a.created_at,
               p.slope_unit_id, p.probability, p.risk_level, p.verification_status,
               s.district_id, s.ward_name,
               coalesce(e.population_estimate, 0) AS population_estimate,
               coalesce(e.buildings_count, 0) AS buildings_count
        FROM alert a
        JOIN prediction p ON p.id = a.prediction_id
        JOIN slope_unit s ON s.id = p.slope_unit_id
        LEFT JOIN exposure e ON e.prediction_id = p.id
        LEFT JOIN app_user u_auth ON u_auth.id = a.authorised_by
        LEFT JOIN app_user u_rej  ON u_rej.id  = a.rejected_by
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        sql += ` AND a.status = $${params.length}`;
      }
      if (district) {
        params.push(district.toLowerCase());
        sql += ` AND s.district_id = $${params.length}`;
      }

      sql += ` ORDER BY a.created_at DESC`;

      const { rows } = await query(sql, params);
      return rows.map((r) => ({
        id: Number(r.id),
        prediction_id: Number(r.prediction_id),
        status: r.status,
        severity: r.severity,
        headline: r.headline,
        body: r.body,
        channels: r.channels,
        decision_card: {
          slope_unit_id: r.slope_unit_id,
          ward_name: r.ward_name,
          district_id: r.district_id,
          probability: Number(r.probability),
          risk_level: r.risk_level,
          verification_status: r.verification_status,
          population_estimate: Number(r.population_estimate),
          buildings_count: Number(r.buildings_count),
        },
        authorisation: r.authorised_by
          ? {
              authorised_by: Number(r.authorised_by),
              authorised_by_name: r.authorised_by_name,
              authorised_at: r.authorised_at ? r.authorised_at.toISOString() : null,
            }
          : null,
        rejection: r.rejected_by
          ? {
              rejected_by: Number(r.rejected_by),
              rejected_by_name: r.rejected_by_name,
              rejected_at: r.rejected_at ? r.rejected_at.toISOString() : null,
              rejection_reason: r.rejection_reason,
            }
          : null,
        dispatched_at: r.dispatched_at ? r.dispatched_at.toISOString() : null,
        created_at: r.created_at.toISOString(),
      }));
    },
  );

  // ---------- POST /api/v1/alerts/:id/authorise ----------
  // Named human officer authorises the alert dispatch.
  app.post(
    '/api/v1/alerts/:id/authorise',
    {
      preHandler: [authenticate, requireRole(ROLES.SUPER_ADMIN, ROLES.DISTRICT_ADMIN)],
      schema: {
        tags: ['alerts'],
        summary: 'Human authorisation gate — named officer authorizes alert',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
        body: {
          type: ['object', 'null'],
          properties: {
            auto_dispatch: { type: 'boolean', default: false },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      requireDatabase();
      const alertId = Number(request.params.id);
      const autoDispatch = Boolean(request.body?.auto_dispatch);

      // Fetch alert + district
      const { rows: aRows } = await query(
        `SELECT a.id, a.status, a.prediction_id, s.district_id, s.ward_name
         FROM alert a
         JOIN prediction p ON p.id = a.prediction_id
         JOIN slope_unit s ON s.id = p.slope_unit_id
         WHERE a.id = $1`,
        [alertId],
      );

      if (aRows.length === 0) {
        const err = new Error(`No alert with id '${alertId}'`);
        err.statusCode = 404;
        throw err;
      }

      const alert = aRows[0];

      // Enforce regional scoping: Aizawl admin cannot authorize Sikkim alert
      assertDistrictAccess(request.user, alert.district_id);

      if (!['DRAFT', 'PENDING_AUTHORISATION'].includes(alert.status)) {
        const err = new Error(`Cannot authorise alert currently in status '${alert.status}'`);
        err.statusCode = 422;
        throw err;
      }

      const newStatus = autoDispatch ? 'DISPATCHED' : 'AUTHORISED';

      const updated = await withTransaction(async (client) => {
        const { rows: upRows } = await client.query(
          `UPDATE alert
           SET status = $1,
               authorised_by = $2,
               authorised_at = now(),
               dispatched_at = CASE WHEN $3 = TRUE THEN now() ELSE dispatched_at END
           WHERE id = $4
           RETURNING id, prediction_id, status, severity, headline, body,
                     authorised_by, authorised_at, dispatched_at`,
          [newStatus, request.user.sub, autoDispatch, alertId],
        );

        await recordAudit(client, {
          actorId: request.user.sub,
          actorLabel: request.user.full_name || request.user.email,
          action: 'ALERT_AUTHORISED',
          entity: 'alert',
          entityId: alertId,
          before: { status: alert.status },
          after: {
            status: newStatus,
            authorised_by: request.user.sub,
            auto_dispatch: autoDispatch,
          },
        });

        return upRows[0];
      });

      return {
        id: Number(updated.id),
        prediction_id: Number(updated.prediction_id),
        status: updated.status,
        authorised_by: Number(updated.authorised_by),
        authorised_by_name: request.user.full_name || request.user.email,
        authorised_at: updated.authorised_at ? updated.authorised_at.toISOString() : null,
        dispatched_at: updated.dispatched_at ? updated.dispatched_at.toISOString() : null,
      };
    },
  );

  // ---------- POST /api/v1/alerts/:id/reject ----------
  // Officer rejects alert with mandatory reason
  app.post(
    '/api/v1/alerts/:id/reject',
    {
      preHandler: [authenticate, requireRole(ROLES.SUPER_ADMIN, ROLES.DISTRICT_ADMIN)],
      schema: {
        tags: ['alerts'],
        summary: 'Officer rejects alert draft — requires mandatory reason',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
        body: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', minLength: 3, maxLength: 500 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      requireDatabase();
      const alertId = Number(request.params.id);
      const { reason } = request.body;

      if (!reason || !reason.trim()) {
        const err = new Error('Rejection reason cannot be blank');
        err.statusCode = 422;
        throw err;
      }

      const { rows: aRows } = await query(
        `SELECT a.id, a.status, s.district_id
         FROM alert a
         JOIN prediction p ON p.id = a.prediction_id
         JOIN slope_unit s ON s.id = p.slope_unit_id
         WHERE a.id = $1`,
        [alertId],
      );

      if (aRows.length === 0) {
        const err = new Error(`No alert with id '${alertId}'`);
        err.statusCode = 404;
        throw err;
      }

      const alert = aRows[0];
      assertDistrictAccess(request.user, alert.district_id);

      if (!['DRAFT', 'PENDING_AUTHORISATION'].includes(alert.status)) {
        const err = new Error(`Cannot reject alert currently in status '${alert.status}'`);
        err.statusCode = 422;
        throw err;
      }

      const updated = await withTransaction(async (client) => {
        const { rows: upRows } = await client.query(
          `UPDATE alert
           SET status = 'REJECTED',
               rejected_by = $1,
               rejected_at = now(),
               rejection_reason = $2
           WHERE id = $3
           RETURNING id, prediction_id, status, rejected_by, rejected_at, rejection_reason`,
          [request.user.sub, reason.trim(), alertId],
        );

        await recordAudit(client, {
          actorId: request.user.sub,
          actorLabel: request.user.full_name || request.user.email,
          action: 'ALERT_REJECTED',
          entity: 'alert',
          entityId: alertId,
          before: { status: alert.status },
          after: {
            status: 'REJECTED',
            rejected_by: request.user.sub,
            rejection_reason: reason.trim(),
          },
        });

        return upRows[0];
      });

      return {
        id: Number(updated.id),
        prediction_id: Number(updated.prediction_id),
        status: updated.status,
        rejected_by: Number(updated.rejected_by),
        rejected_by_name: request.user.full_name || request.user.email,
        rejected_at: updated.rejected_at ? updated.rejected_at.toISOString() : null,
        rejection_reason: updated.rejection_reason,
      };
    },
  );

  // ---------- POST /api/v1/alerts/:id/dispatch ----------
  // Dispatches an alert that was previously AUTHORISED.
  app.post(
    '/api/v1/alerts/:id/dispatch',
    {
      preHandler: [authenticate, requireRole(ROLES.SUPER_ADMIN, ROLES.DISTRICT_ADMIN)],
      schema: {
        tags: ['alerts'],
        summary: 'Dispatch an authorized alert to public emergency channels',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
      },
    },
    async (request) => {
      requireDatabase();
      const alertId = Number(request.params.id);

      const { rows: aRows } = await query(
        `SELECT a.id, a.status, a.authorised_by, s.district_id
         FROM alert a
         JOIN prediction p ON p.id = a.prediction_id
         JOIN slope_unit s ON s.id = p.slope_unit_id
         WHERE a.id = $1`,
        [alertId],
      );

      if (aRows.length === 0) {
        const err = new Error(`No alert with id '${alertId}'`);
        err.statusCode = 404;
        throw err;
      }

      const alert = aRows[0];
      assertDistrictAccess(request.user, alert.district_id);

      // Enforce the gate: cannot dispatch if not AUTHORISED
      if (alert.status !== 'AUTHORISED' || !alert.authorised_by) {
        const err = new Error('Alert must be AUTHORISED by a human officer before dispatch');
        err.statusCode = 422;
        throw err;
      }

      const updated = await withTransaction(async (client) => {
        const { rows: upRows } = await client.query(
          `UPDATE alert
           SET status = 'DISPATCHED',
               dispatched_at = now()
           WHERE id = $1
           RETURNING id, prediction_id, status, authorised_by, dispatched_at`,
          [alertId],
        );

        await recordAudit(client, {
          actorId: request.user.sub,
          actorLabel: request.user.full_name || request.user.email,
          action: 'ALERT_DISPATCHED',
          entity: 'alert',
          entityId: alertId,
          before: { status: 'AUTHORISED' },
          after: { status: 'DISPATCHED' },
        });

        return upRows[0];
      });

      return {
        id: Number(updated.id),
        status: updated.status,
        dispatched_at: updated.dispatched_at.toISOString(),
      };
    },
  );
}
