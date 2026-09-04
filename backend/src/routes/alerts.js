/**
 * src/routes/alerts.js -- Disaster alert state machine, human authorization gate,
 * and OASIS CAP 1.2 / multilingual SMS dissemination (Steps V12 & V14).
 *
 * Implements ARCHITECTURE.md §14, §16, §20 / IMPLEMENTATION_STEPS.md V12, V14.
 *
 * State machine:
 *   DRAFT -> PENDING_AUTHORISATION -> AUTHORISED / REJECTED -> DISPATCHED
 *
 * THE SAFETY GATE:
 * No alert can reach DISPATCHED without a named human officer in authorised_by.
 * This is enforced at the database level by CHECK constraint
 * `alert_must_be_authorised_before_dispatch`.
 *
 * ZERO HARDCODED VALUES:
 * All jurisdictions, state names, districts, slope unit IDs, wards, and road exposure
 * are dynamically resolved from the database models.
 */

import { buildCap12Xml } from '../alerting/cap.js';
import { renderSmsTemplates } from '../alerting/templates.js';
import { recordAudit } from '../core/audit.js';
import { authenticate } from '../core/auth.js';
import { assertDistrictAccess, requireRole, ROLES } from '../core/rbac.js';
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

/**
 * Helper to dispatch mock SMS in English, Hindi, and Mizo into mock_sms_dispatch.
 * Fully dynamic: resolves group names and text from ward, slope unit, district, and exposure.
 */
async function dispatchMockSms(client, { alertId, severity, wardName, slopeUnitId, districtName, stateName, validFrom, validTo, roadMetres }) {
  const smsTexts = renderSmsTemplates({
    severity,
    wardName,
    slopeUnitId,
    districtName,
    stateName,
    validFrom,
    validTo,
    roadMetres,
  });

  const locationTag = (wardName || slopeUnitId || districtName || 'SECTOR').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const dispatches = [
    { lang: 'en', text: smsTexts.en, group: `PUBLIC_${locationTag}_EN` },
    { lang: 'hi', text: smsTexts.hi, group: `PUBLIC_${locationTag}_HI` },
    { lang: 'mizo', text: smsTexts.mizo, group: `PUBLIC_${locationTag}_MIZO` },
  ];

  for (const item of dispatches) {
    await client.query(
      `INSERT INTO mock_sms_dispatch (alert_id, channel, language, recipient_group, message_text, status)
       VALUES ($1, 'SMS', $2, $3, $4, 'DELIVERED')`,
      [alertId, item.lang, item.group, item.text],
    );
  }

  return smsTexts;
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

      // Verify prediction exists and get district & ward dynamically
      const { rows: pRows } = await query(
        `SELECT p.id, p.slope_unit_id, p.risk_level, p.probability, s.district_id, s.ward_name, d.name AS district_name
         FROM prediction p
         JOIN slope_unit s ON s.id = p.slope_unit_id
         LEFT JOIN district d ON d.id = s.district_id
         WHERE p.id = $1`,
        [prediction_id],
      );

      if (pRows.length === 0) {
        const err = new Error(`No prediction with id '${prediction_id}'`);
        err.statusCode = 404;
        throw err;
      }

      const p = pRows[0];
      const locLabel = p.ward_name || `Slope Unit ${p.slope_unit_id}`;
      const defaultHeadline = headline || `Landslide Risk Warning: ${locLabel}`;
      const defaultBody =
        body ||
        `High failure probability (${Math.round(p.probability * 100)}%) detected for ${locLabel}. ` +
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
               s.district_id, s.ward_name, d.name AS district_name, d.state AS state_name,
               coalesce(e.population_estimate, 0) AS population_estimate,
               coalesce(e.buildings_count, 0) AS buildings_count,
               coalesce(e.road_metres, 0) AS road_metres
        FROM alert a
        JOIN prediction p ON p.id = a.prediction_id
        JOIN slope_unit s ON s.id = p.slope_unit_id
        LEFT JOIN district d ON d.id = s.district_id
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
          district_name: r.district_name,
          state_name: r.state_name,
          probability: Number(r.probability),
          risk_level: r.risk_level,
          verification_status: r.verification_status,
          population_estimate: Number(r.population_estimate),
          buildings_count: Number(r.buildings_count),
          road_metres: Number(r.road_metres),
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
  // Automatically generates OASIS CAP 1.2 XML with dynamic database context and saves to alert.cap_xml.
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

      // Fetch alert + district + geometry + prediction + exposure details dynamically
      const { rows: aRows } = await query(
        `SELECT a.id, a.status, a.severity, a.headline, a.body, a.prediction_id,
                p.valid_from, p.valid_to, p.probability, p.risk_level,
                s.id AS slope_unit_id, s.district_id, s.ward_name,
                d.name AS district_name, d.state AS state_name,
                ST_AsGeoJSON(s.geom)::json AS geom_json,
                e.road_metres
         FROM alert a
         JOIN prediction p ON p.id = a.prediction_id
         JOIN slope_unit s ON s.id = p.slope_unit_id
         LEFT JOIN district d ON d.id = s.district_id
         LEFT JOIN exposure e ON e.prediction_id = p.id
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

      // Generate OASIS CAP 1.2 XML dynamically at authorisation time
      const capXml = buildCap12Xml(
        {
          id: alertId,
          severity: alert.severity,
          headline: alert.headline,
          body: alert.body,
          authorised_at: new Date(),
        },
        {
          status: 'Exercise',
          geometry: alert.geom_json,
          context: {
            ward_name: alert.ward_name,
            slope_unit_id: alert.slope_unit_id,
            district_id: alert.district_id,
            district_name: alert.district_name,
            state_name: alert.state_name,
            valid_from: alert.valid_from,
            valid_to: alert.valid_to,
            road_metres: alert.road_metres,
          },
        },
      );

      const updated = await withTransaction(async (client) => {
        const { rows: upRows } = await client.query(
          `UPDATE alert
           SET status = $1,
               authorised_by = $2,
               authorised_at = now(),
               cap_xml = $3,
               dispatched_at = CASE WHEN $4 = TRUE THEN now() ELSE dispatched_at END
           WHERE id = $5
           RETURNING id, prediction_id, status, severity, headline, body,
                     authorised_by, authorised_at, dispatched_at, cap_xml`,
          [newStatus, request.user.sub, capXml, autoDispatch, alertId],
        );

        // If auto-dispatching, dispatch mock SMS records across 3 languages
        if (autoDispatch) {
          await dispatchMockSms(client, {
            alertId,
            severity: alert.severity,
            wardName: alert.ward_name,
            slopeUnitId: alert.slope_unit_id,
            districtName: alert.district_name || alert.district_id,
            stateName: alert.state_name,
            validFrom: alert.valid_from,
            validTo: alert.valid_to,
            roadMetres: alert.road_metres,
          });
        }

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

        if (autoDispatch) {
          await recordAudit(client, {
            actorId: request.user.sub,
            actorLabel: request.user.full_name || request.user.email,
            action: 'ALERT_DISPATCHED',
            entity: 'alert',
            entityId: alertId,
            before: { status: 'AUTHORISED' },
            after: { status: 'DISPATCHED' },
          });
        }

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
        cap_xml_generated: Boolean(updated.cap_xml),
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
  // Performs mock SMS dissemination into mock_sms_dispatch.
  app.post(
    '/api/v1/alerts/:id/dispatch',
    {
      preHandler: [authenticate, requireRole(ROLES.SUPER_ADMIN, ROLES.DISTRICT_ADMIN)],
      schema: {
        tags: ['alerts'],
        summary: 'Dispatch an authorized alert to public emergency channels and mock SMS',
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
        `SELECT a.id, a.status, a.severity, a.authorised_by,
                p.valid_from, p.valid_to,
                s.id AS slope_unit_id, s.district_id, s.ward_name,
                d.name AS district_name, d.state AS state_name,
                e.road_metres
         FROM alert a
         JOIN prediction p ON p.id = a.prediction_id
         JOIN slope_unit s ON s.id = p.slope_unit_id
         LEFT JOIN district d ON d.id = s.district_id
         LEFT JOIN exposure e ON e.prediction_id = p.id
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

        // Perform dynamic mock SMS dispatch for all 3 languages
        await dispatchMockSms(client, {
          alertId,
          severity: alert.severity,
          wardName: alert.ward_name,
          slopeUnitId: alert.slope_unit_id,
          districtName: alert.district_name || alert.district_id,
          stateName: alert.state_name,
          validFrom: alert.valid_from,
          validTo: alert.valid_to,
          roadMetres: alert.road_metres,
        });

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

  // ---------- GET /api/v1/alerts/:id/cap.xml ----------
  // Serves OASIS CAP 1.2 compliant XML for government early warning pipelines (SACHET)
  app.get(
    '/api/v1/alerts/:id/cap.xml',
    {
      schema: {
        tags: ['alerts'],
        summary: 'Get OASIS CAP 1.2 XML for an alert (geo-scoped with runout polygon)',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
      },
    },
    async (request, reply) => {
      requireDatabase();
      const alertId = Number(request.params.id);

      const { rows } = await query(
        `SELECT a.id, a.status, a.severity, a.headline, a.body, a.cap_xml,
                a.authorised_at, a.created_at,
                p.valid_from, p.valid_to, p.probability, p.risk_level,
                s.id AS slope_unit_id, s.ward_name, s.district_id,
                d.name AS district_name, d.state AS state_name,
                ST_AsGeoJSON(s.geom)::json AS geom_json,
                e.road_metres
         FROM alert a
         JOIN prediction p ON p.id = a.prediction_id
         JOIN slope_unit s ON s.id = p.slope_unit_id
         LEFT JOIN district d ON d.id = s.district_id
         LEFT JOIN exposure e ON e.prediction_id = p.id
         WHERE a.id = $1`,
        [alertId],
      );

      if (rows.length === 0) {
        const err = new Error(`No alert with id '${alertId}'`);
        err.statusCode = 404;
        throw err;
      }

      const row = rows[0];
      let xml = row.cap_xml;
      if (!xml) {
        xml = buildCap12Xml(row, {
          status: 'Exercise',
          geometry: row.geom_json,
          context: {
            ward_name: row.ward_name,
            slope_unit_id: row.slope_unit_id,
            district_id: row.district_id,
            district_name: row.district_name,
            state_name: row.state_name,
            valid_from: row.valid_from,
            valid_to: row.valid_to,
            road_metres: row.road_metres,
          },
        });
      }

      reply.type('application/xml; charset=utf-8');
      return xml;
    },
  );

  // ---------- GET /api/v1/alerts/:id/sms ----------
  // Serves dynamic 3-language SMS previews and dispatched mock message records
  app.get(
    '/api/v1/alerts/:id/sms',
    {
      schema: {
        tags: ['alerts'],
        summary: 'Get 3-language SMS previews and dispatched delivery history',
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
        `SELECT a.id, a.status, a.severity, a.dispatched_at,
                p.valid_from, p.valid_to,
                s.id AS slope_unit_id, s.ward_name, s.district_id,
                d.name AS district_name, d.state AS state_name,
                e.road_metres
         FROM alert a
         JOIN prediction p ON p.id = a.prediction_id
         JOIN slope_unit s ON s.id = p.slope_unit_id
         LEFT JOIN district d ON d.id = s.district_id
         LEFT JOIN exposure e ON e.prediction_id = p.id
         WHERE a.id = $1`,
        [alertId],
      );

      if (aRows.length === 0) {
        const err = new Error(`No alert with id '${alertId}'`);
        err.statusCode = 404;
        throw err;
      }

      const alert = aRows[0];
      const previews = renderSmsTemplates({
        severity: alert.severity,
        wardName: alert.ward_name,
        slopeUnitId: alert.slope_unit_id,
        districtName: alert.district_name || alert.district_id,
        stateName: alert.state_name,
        validFrom: alert.valid_from,
        validTo: alert.valid_to,
        roadMetres: alert.road_metres,
      });

      const { rows: dispatchedRows } = await query(
        `SELECT id, channel, language, recipient_group, message_text, status, dispatched_at
       FROM mock_sms_dispatch
       WHERE alert_id = $1
       ORDER BY id ASC`,
        [alertId],
      );

      return {
        alert_id: Number(alert.id),
        status: alert.status,
        is_dispatched: alert.status === 'DISPATCHED',
        dispatched_at: alert.dispatched_at ? alert.dispatched_at.toISOString() : null,
        previews,
        dispatched_messages: dispatchedRows.map((r) => ({
          id: Number(r.id),
          channel: r.channel,
          language: r.language,
          recipient_group: r.recipient_group,
          message_text: r.message_text,
          status: r.status,
          dispatched_at: r.dispatched_at.toISOString(),
        })),
      };
    },
  );
}
