/**
 * test/alerts.test.js -- Disaster alert state machine and human authorization gate (Step V12).
 *
 * Verifies:
 * 1. Alerts start in PENDING_AUTHORISATION when drafted.
 * 2. Decision card payload includes exposure, risk level, and ward info.
 * 3. CRUCIAL NEGATIVE TEST 1: Database CHECK constraint prevents direct bypass to DISPATCHED without a human authorizer.
 * 4. CRUCIAL NEGATIVE TEST 2: Aizawl admin cannot authorize a Sikkim alert (403 Forbidden).
 * 5. CRUCIAL NEGATIVE TEST 3: Rejection requires a mandatory reason.
 * 6. CRUCIAL NEGATIVE TEST 4: Dispatch cannot occur before human authorization.
 * 7. Authorized officer can authorize and dispatch, recording immutable audit records.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';
import { query } from '../src/db/pool.js';

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe('Alerts endpoint with no database configured', () => {
  let app;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('answers 503 when database is not configured', { skip: HAS_DB && 'DATABASE_URL is set' }, async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/alerts' });
    assert.equal(res.statusCode, 503);
    assert.match(res.json().message, /DATABASE_URL/);
  });
});

describe('Alert state machine & human authorization gate (database backed)', {
  skip: !HAS_DB && 'DATABASE_URL is not set -- run npm run test:db',
}, () => {
  let app;
  let aizawlAdminToken;
  let aizawlPredictionId;
  let sikkimPredictionId;
  let aizawlAlertId;
  let sikkimAlertId;

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

    // 2. Setup isolated forecast run and predictions
    const { rows: runRows } = await query(
      `INSERT INTO forecast_run (run_ts, input_cutoff_ts, model_version, is_demo_data)
       VALUES (now(), now(), 'test-v12', true)
       RETURNING id`,
    );
    const runId = runRows[0].id;

    // Aizawl prediction on AZ-1142
    const { rows: pAizawl } = await query(
      `INSERT INTO prediction (forecast_run_id, slope_unit_id, probability, risk_level,
                               valid_from, valid_to, verification_status)
       VALUES ($1, 'AZ-1142', 0.82, 'HIGH', now(), now() + interval '12 hours', 'PENDING_VERIFICATION')
       RETURNING id`,
      [runId],
    );
    aizawlPredictionId = Number(pAizawl[0].id);

    // Add exposure for AZ-1142
    await query(
      `INSERT INTO exposure (prediction_id, buildings_count, population_estimate, road_metres, population_source)
       VALUES ($1, 14, 110, 320.0, 'Census 2026 test')
       ON CONFLICT (prediction_id) DO NOTHING`,
      [aizawlPredictionId],
    );

    // Sikkim slope unit and prediction for boundary tests
    await query(
      `INSERT INTO slope_unit (id, district_id, geom, centroid, area_ha, source, is_mock)
       VALUES ('SK-0012', 'gangtok',
               ST_GeomFromText('POLYGON((88.61 27.33, 88.62 27.33, 88.62 27.32, 88.61 27.32, 88.61 27.33))', 4326),
               ST_GeomFromText('POINT(88.615 27.325)', 4326),
               5.0, 'test-sikkim', true)
       ON CONFLICT (id) DO NOTHING`,
    );

    const { rows: pSikkim } = await query(
      `INSERT INTO prediction (forecast_run_id, slope_unit_id, probability, risk_level,
                               valid_from, valid_to, verification_status)
       VALUES ($1, 'SK-0012', 0.70, 'HIGH', now(), now() + interval '12 hours', 'PENDING_VERIFICATION')
       RETURNING id`,
      [runId],
    );
    sikkimPredictionId = Number(pSikkim[0].id);
  });

  after(async () => {
    if (HAS_DB) {
      await query(`DELETE FROM alert WHERE prediction_id IN ($1, $2)`, [aizawlPredictionId, sikkimPredictionId]);
      await query(`DELETE FROM exposure WHERE prediction_id = $1`, [aizawlPredictionId]);
      await query(`DELETE FROM prediction WHERE id IN ($1, $2)`, [aizawlPredictionId, sikkimPredictionId]);
      await query(`DELETE FROM slope_unit WHERE id = 'SK-0012'`);
      await query(`DELETE FROM forecast_run WHERE model_version = 'test-v12'`);
    }
    await app.close();
  });

  test('POST /api/v1/alerts/draft drafts an alert in PENDING_AUTHORISATION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/alerts/draft',
      headers: { authorization: `Bearer ${aizawlAdminToken}` },
      payload: {
        prediction_id: aizawlPredictionId,
        severity: 'Severe',
        headline: 'Critical Landslide Danger in Melthum',
        channels: ['SMS', 'APP'],
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.prediction_id, aizawlPredictionId);
    assert.equal(body.status, 'PENDING_AUTHORISATION');
    assert.equal(body.severity, 'Severe');
    assert.ok(body.id > 0);
    aizawlAlertId = body.id;
  });

  test('Draft alert for Sikkim prediction for boundary test', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/alerts/draft',
      headers: { authorization: `Bearer ${aizawlAdminToken}` },
      payload: {
        prediction_id: sikkimPredictionId,
        severity: 'Severe',
      },
    });

    assert.equal(res.statusCode, 201);
    sikkimAlertId = res.json().id;
  });

  test('GET /api/v1/alerts returns alerts with Decision Card context', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/alerts?district=aizawl',
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(Array.isArray(body));
    const targetAlert = body.find((a) => a.id === aizawlAlertId);
    assert.ok(targetAlert, 'Target alert must exist in list');
    assert.equal(targetAlert.status, 'PENDING_AUTHORISATION');
    assert.ok(targetAlert.decision_card, 'Decision card data must exist');
    assert.equal(targetAlert.decision_card.slope_unit_id, 'AZ-1142');
    assert.equal(targetAlert.decision_card.population_estimate, 110);
    assert.equal(targetAlert.decision_card.buildings_count, 14);
  });

  test('CRUCIAL NEGATIVE TEST 1: Database CHECK constraint prevents direct bypass to DISPATCHED', async () => {
    // Attempting raw SQL bypass to DISPATCHED without authorised_by
    await assert.rejects(
      async () => {
        await query(
          `UPDATE alert SET status = 'DISPATCHED', dispatched_at = now() WHERE id = $1`,
          [aizawlAlertId],
        );
      },
      (err) => {
        // Must fail with PostgreSQL check constraint violation
        assert.match(err.message, /alert_must_be_authorised_before_dispatch/);
        return true;
      },
    );
  });

  test('CRUCIAL NEGATIVE TEST 2: Aizawl admin cannot authorize a Sikkim alert -> 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/${sikkimAlertId}/authorise`,
      headers: { authorization: `Bearer ${aizawlAdminToken}` },
    });

    assert.equal(res.statusCode, 403);
    assert.match(res.json().message, /Forbidden.*not assigned to district 'gangtok'/);
  });

  test('CRUCIAL NEGATIVE TEST 3: Rejecting an alert requires a reason', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/${aizawlAlertId}/reject`,
      headers: { authorization: `Bearer ${aizawlAdminToken}` },
      payload: { reason: '' },
    });

    assert.equal(res.statusCode, 422);
  });

  test('CRUCIAL NEGATIVE TEST 4: Cannot dispatch an alert before it is AUTHORISED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/${aizawlAlertId}/dispatch`,
      headers: { authorization: `Bearer ${aizawlAdminToken}` },
    });

    assert.equal(res.statusCode, 422);
    assert.match(res.json().message, /Alert must be AUTHORISED by a human officer before dispatch/);
  });

  test('POSITIVE FLOW: Officer authorizes alert -> AUTHORISED and audit log recorded', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/${aizawlAlertId}/authorise`,
      headers: { authorization: `Bearer ${aizawlAdminToken}` },
      payload: { auto_dispatch: false },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.id, aizawlAlertId);
    assert.equal(body.status, 'AUTHORISED');
    assert.ok(body.authorised_by > 0);
    assert.ok(body.authorised_at);

    // Verify audit log
    const { rows: auditRows } = await query(
      `SELECT * FROM audit_log WHERE entity = 'alert' AND entity_id = $1 ORDER BY ts DESC LIMIT 1`,
      [String(aizawlAlertId)],
    );
    assert.equal(auditRows.length, 1);
    assert.equal(auditRows[0].action, 'ALERT_AUTHORISED');
  });

  test('POSITIVE FLOW: Dispatching previously authorized alert succeeds -> DISPATCHED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/${aizawlAlertId}/dispatch`,
      headers: { authorization: `Bearer ${aizawlAdminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, 'DISPATCHED');
    assert.ok(body.dispatched_at);

    // Verify database state
    const { rows } = await query(`SELECT status, authorised_by, dispatched_at FROM alert WHERE id = $1`, [
      aizawlAlertId,
    ]);
    assert.equal(rows[0].status, 'DISPATCHED');
    assert.ok(rows[0].authorised_by !== null);
    assert.ok(rows[0].dispatched_at !== null);
  });

  test('POSITIVE FLOW: Rejecting alert with valid reason sets REJECTED status', async () => {
    // Draft another alert to test rejection
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/v1/alerts/draft',
      headers: { authorization: `Bearer ${aizawlAdminToken}` },
      payload: {
        prediction_id: aizawlPredictionId,
        headline: 'False Alarm Inspection',
      },
    });
    const rejectAlertId = draftRes.json().id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/${rejectAlertId}/reject`,
      headers: { authorization: `Bearer ${aizawlAdminToken}` },
      payload: { reason: 'Drone footage confirmed surface runoff diverted; no slope movement.' },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, 'REJECTED');
    assert.ok(body.rejected_by > 0);
    assert.ok(body.rejected_at);
    assert.match(body.rejection_reason, /Drone footage/);
  });
});
