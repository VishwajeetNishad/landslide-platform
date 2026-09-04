/**
 * test/verification.test.js -- Human verification workflow and immutable audit log (Step V11).
 *
 * Verifies:
 * 1. Unauthenticated requests are rejected with 401.
 * 2. Unauthorized roles (CITIZEN) are rejected with 403.
 * 3. Cross-district verification (Aizawl officer verifying Sikkim slope) is rejected with 403.
 * 4. Invalid status transitions return 422.
 * 5. Successful verification transitions to CONFIRMED / FALSE_POSITIVE / NEEDS_REVIEW.
 * 6. INVARIANT: Scientific probability and risk_level are NEVER modified by human verification.
 * 7. Verified_by and verified_at are populated.
 * 8. An immutable entry is created in audit_log.
 * 9. PostgreSQL triggers block any UPDATE or DELETE on audit_log.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';
import { query } from '../src/db/pool.js';

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe('Verification workflow (database backed)', {
  skip: !HAS_DB && 'DATABASE_URL is not set -- run npm run test:db',
}, () => {
  let app;
  let aizawlAdminToken;
  let citizenToken;
  let testPredictionId;
  let sikkimPredictionId;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    // 1. Get auth tokens
    const loginAizawl = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin.aizawl@disaster.mz.gov.in',
        password: 'prototype2026!',
      },
    });
    aizawlAdminToken = loginAizawl.json().token;

    const loginCitizen = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'citizen@example.com',
        password: 'prototype2026!',
      },
    });
    citizenToken = loginCitizen.json().token;

    // 2. Create isolated test predictions
    // (a) Forecast run
    const { rows: runRows } = await query(
      `INSERT INTO forecast_run (run_ts, input_cutoff_ts, model_version, is_demo_data)
       VALUES (now(), now(), 'test-v11', true)
       RETURNING id`,
    );
    const runId = runRows[0].id;

    // (b) Aizawl prediction on existing AZ-1142
    const { rows: pAizawl } = await query(
      `INSERT INTO prediction (forecast_run_id, slope_unit_id, probability, risk_level,
                               valid_from, valid_to, verification_status)
       VALUES ($1, 'AZ-1142', 0.75, 'HIGH', now(), now() + interval '12 hours', 'PENDING_VERIFICATION')
       RETURNING id`,
      [runId],
    );
    testPredictionId = Number(pAizawl[0].id);

    // (c) Sikkim slope unit & prediction for boundary test
    await query(
      `INSERT INTO slope_unit (id, district_id, geom, centroid, area_ha, source, is_mock)
       VALUES ('SK-0001', 'gangtok',
               ST_GeomFromText('POLYGON((88.61 27.33, 88.62 27.33, 88.62 27.32, 88.61 27.32, 88.61 27.33))', 4326),
               ST_GeomFromText('POINT(88.615 27.325)', 4326),
               5.0, 'test-sikkim', true)
       ON CONFLICT (id) DO NOTHING`,
    );

    const { rows: pSikkim } = await query(
      `INSERT INTO prediction (forecast_run_id, slope_unit_id, probability, risk_level,
                               valid_from, valid_to, verification_status)
       VALUES ($1, 'SK-0001', 0.60, 'MEDIUM', now(), now() + interval '12 hours', 'PENDING_VERIFICATION')
       RETURNING id`,
      [runId],
    );
    sikkimPredictionId = Number(pSikkim[0].id);
  });

  after(async () => {
    // Clean up test rows
    if (HAS_DB) {
      await query(`DELETE FROM prediction WHERE id IN ($1, $2)`, [testPredictionId, sikkimPredictionId]);
      await query(`DELETE FROM slope_unit WHERE id = 'SK-0001'`);
      await query(`DELETE FROM forecast_run WHERE model_version = 'test-v11'`);
    }
    await app.close();
  });

  test('PATCH /api/v1/predictions/:id/verification without token returns 401', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/predictions/${testPredictionId}/verification`,
      payload: { status: 'CONFIRMED' },
    });
    assert.equal(res.statusCode, 401);
  });

  test('PATCH /api/v1/predictions/:id/verification with CITIZEN role returns 403', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/predictions/${testPredictionId}/verification`,
      headers: { authorization: `Bearer ${citizenToken}` },
      payload: { status: 'CONFIRMED' },
    });
    assert.equal(res.statusCode, 403);
    assert.match(res.json().message, /Forbidden.*role 'CITIZEN'/);
  });

  test('PATCH /api/v1/predictions/:id/verification with invalid status returns 422', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/predictions/${testPredictionId}/verification`,
      headers: { authorization: `Bearer ${aizawlAdminToken}` },
      payload: { status: 'INVALID_STATUS' },
    });
    assert.equal(res.statusCode, 422);
  });

  test('CRUCIAL NEGATIVE TEST: Aizawl admin cannot verify a Sikkim prediction -> 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/predictions/${sikkimPredictionId}/verification`,
      headers: { authorization: `Bearer ${aizawlAdminToken}` },
      payload: { status: 'CONFIRMED', note: 'Attempting cross-district verification' },
    });
    assert.equal(res.statusCode, 403);
    assert.match(res.json().message, /Forbidden.*not assigned to district 'gangtok'/);
  });

  test('Aizawl admin successfully verifies Aizawl prediction -> CONFIRMED', async () => {
    const noteText = 'Ground team confirmed tension crack on crown';
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/predictions/${testPredictionId}/verification`,
      headers: { authorization: `Bearer ${aizawlAdminToken}` },
      payload: {
        status: 'CONFIRMED',
        note: noteText,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.id, testPredictionId);
    assert.equal(body.verification_status, 'CONFIRMED');
    assert.equal(body.verification_note, noteText);
    assert.ok(body.verified_by > 0, 'verified_by must be set');
    assert.ok(body.verified_at, 'verified_at must be set');

    // INVARIANT TEST: probability and risk_level MUST NOT be modified
    assert.equal(body.probability, 0.75, 'Model probability must not be changed by verification');
    assert.equal(body.risk_level, 'HIGH', 'Risk level must not be changed by verification');

    // Check DB row directly
    const { rows } = await query(
      `SELECT verification_status, verified_by, verified_at, probability, risk_level
       FROM prediction WHERE id = $1`,
      [testPredictionId],
    );
    assert.equal(rows[0].verification_status, 'CONFIRMED');
    assert.ok(rows[0].verified_by !== null);
    assert.ok(rows[0].verified_at !== null);
    assert.equal(Number(rows[0].probability), 0.75);
    assert.equal(rows[0].risk_level, 'HIGH');
  });

  test('Audit log recorded the verification action with before and after states', async () => {
    const { rows: auditRows } = await query(
      `SELECT * FROM audit_log
       WHERE entity = 'prediction' AND entity_id = $1
       ORDER BY ts DESC LIMIT 1`,
      [String(testPredictionId)],
    );

    assert.equal(auditRows.length, 1, 'Audit log entry must exist');
    const entry = auditRows[0];
    assert.equal(entry.action, 'PREDICTION_VERIFIED');
    assert.ok(entry.actor_label.includes('Lalrinsanga') || entry.actor_label.includes('admin.aizawl'));
    assert.equal(entry.before.verification_status, 'PENDING_VERIFICATION');
    assert.equal(entry.after.verification_status, 'CONFIRMED');
  });

  test('Database triggers prevent UPDATE or DELETE on audit_log table', async () => {
    const { rows } = await query(
      `SELECT id FROM audit_log WHERE entity = 'prediction' AND entity_id = $1 LIMIT 1`,
      [String(testPredictionId)],
    );
    const auditId = rows[0].id;

    // 1. Attempt UPDATE -> must fail with append-only trigger exception
    await assert.rejects(
      async () => {
        await query(`UPDATE audit_log SET action = 'TAMPERED' WHERE id = $1`, [auditId]);
      },
      (err) => {
        assert.match(err.message, /audit_log is append-only/);
        return true;
      },
    );

    // 2. Attempt DELETE -> must fail with append-only trigger exception
    await assert.rejects(
      async () => {
        await query(`DELETE FROM audit_log WHERE id = $1`, [auditId]);
      },
      (err) => {
        assert.match(err.message, /audit_log is append-only/);
        return true;
      },
    );
  });
});
