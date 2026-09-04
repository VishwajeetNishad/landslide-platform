/**
 * test/e2e_checkpoint_i3.test.js -- Checkpoint I3: Full End-to-End Demo Rehearsal Test.
 *
 * Implements IMPLEMENTATION_STEPS.md Checkpoint I3 & DEMO_PLAN.md.
 *
 * Tests the complete 5-beat demo narrative against live PostgreSQL/PostGIS:
 *   1. ML Ingest: Ingests mock ML predictions from Rudra's contract.
 *   2. The Scientific Risk Rule: Validates AZ-1088 (prob 0.95, exp 0 -> LOW) vs AZ-1142 (HIGH).
 *   3. Human Verification: Field Officer verifies prediction -> CONFIRMED (prob untouched).
 *   4. Safety Gate: Database CHECK constraint prevents direct dispatch without human authorizer.
 *   5. Human Authorization: District Admin signs off -> builds CAP 1.2 XML -> dispatches SMS in 3 languages.
 *   6. Audit Log: Confirms immutable audit records for all transitions.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildApp } from '../src/app.js';
import { query } from '../src/db/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe('Checkpoint I3 -- Full End-to-End Demo Rehearsal (database backed)', {
  skip: !HAS_DB && 'DATABASE_URL is not set -- run npm run test:db',
}, () => {
  let app;
  let adminToken;
  let officerToken;
  let ingestedForecastRunId;
  let az1142PredictionId;
  let az1088PredictionId;
  let alertId;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    // Authenticate demo accounts
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin.aizawl@disaster.mz.gov.in',
        password: 'prototype2026!',
      },
    });
    adminToken = adminLogin.json().token;

    const officerLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'officer.aizawl@disaster.mz.gov.in',
        password: 'prototype2026!',
      },
    });
    officerToken = officerLogin.json().token;
  });

  after(async () => {
    if (HAS_DB && alertId) {
      await query(`DELETE FROM mock_sms_dispatch WHERE alert_id = $1`, [alertId]);
      await query(`DELETE FROM alert WHERE id = $1`, [alertId]);
    }
    if (HAS_DB && ingestedForecastRunId) {
      await query(`DELETE FROM exposure WHERE prediction_id IN (SELECT id FROM prediction WHERE forecast_run_id = $1)`, [ingestedForecastRunId]);
      await query(`DELETE FROM runout_envelope WHERE prediction_id IN (SELECT id FROM prediction WHERE forecast_run_id = $1)`, [ingestedForecastRunId]);
      await query(`DELETE FROM prediction WHERE forecast_run_id = $1`, [ingestedForecastRunId]);
      await query(`DELETE FROM forecast_run WHERE id = $1`, [ingestedForecastRunId]);
    }
    await app.close();
  });

  test('BEAT 1: ML Output Ingest (POST /api/v1/predictions/ingest)', async () => {
    const mockFile = path.join(ROOT_DIR, 'data', 'sample', 'mock_ml_output.json');
    const mockData = JSON.parse(fs.readFileSync(mockFile, 'utf8'));

    // Mark as I3 rehearsal run and ensure run_ts is the latest
    mockData.forecast_run.model_version = 'i3-rehearsal-v1.0';
    mockData.forecast_run.run_ts = new Date(Date.now() + 2000).toISOString();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/predictions/ingest',
      payload: mockData,
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.ok(body.forecast_run_id > 0);
    assert.equal(body.predictions_stored, 3);
    ingestedForecastRunId = body.forecast_run_id;

    // Record prediction IDs
    const { rows } = await query(
      `SELECT id, slope_unit_id, probability, risk_level
       FROM prediction
       WHERE forecast_run_id = $1`,
      [ingestedForecastRunId],
    );

    const az1142 = rows.find((r) => r.slope_unit_id === 'AZ-1142');
    const az1088 = rows.find((r) => r.slope_unit_id === 'AZ-1088');

    assert.ok(az1142);
    assert.ok(az1088);
    az1142PredictionId = Number(az1142.id);
    az1088PredictionId = Number(az1088.id);
  });

  test('BEAT 2: Scientific Risk Matrix & AZ-1088 Proof Case (GET /api/v1/risk/current)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/risk/current?district=aizawl',
    });

    assert.equal(res.statusCode, 200);
    const data = res.json();

    // Verify metadata banner flag
    assert.equal(data.meta.is_demo_data, true);

    const features = data.features;
    const f1088 = features.find((f) => f.properties.slope_unit_id === 'AZ-1088');
    const f1142 = features.find((f) => f.properties.slope_unit_id === 'AZ-1142');

    assert.ok(f1088, 'AZ-1088 must exist in risk feed');
    assert.ok(f1142, 'AZ-1142 must exist in risk feed');

    // GOLDEN PROOF CASE: AZ-1088 has probability 0.95 but risk_level LOW!
    assert.equal(f1088.properties.probability, 0.95);
    assert.equal(f1088.properties.exposure_summary.population_estimate, 0);
    assert.equal(f1088.properties.risk_level, 'LOW', 'AZ-1088 with 0 exposure MUST be LOW risk');

    // SHOWCASE CASE: AZ-1142 has probability 0.72 and school/population -> HIGH risk!
    assert.equal(f1142.properties.probability, 0.72);
    assert.equal(f1142.properties.risk_level, 'HIGH');
    assert.ok(f1142.properties.exposure_summary.population_estimate > 0);

    // Three values are distinct
    assert.ok('probability' in f1142.properties);
    assert.ok('risk_level' in f1142.properties);
    assert.ok('verification_status' in f1142.properties);
  });

  test('BEAT 3: Human Verification Workflow (PATCH /api/v1/predictions/:id/verification)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/predictions/${az1142PredictionId}/verification`,
      headers: { authorization: `Bearer ${officerToken}` },
      payload: { status: 'CONFIRMED' },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.verification_status, 'CONFIRMED');
    assert.equal(body.verified_by_name, 'R. Lalhmachhuana');
    assert.ok(body.verified_at);

    // Probability was untouched
    const { rows } = await query(`SELECT probability, verification_status FROM prediction WHERE id = $1`, [az1142PredictionId]);
    assert.equal(Number(rows[0].probability), 0.72);
    assert.equal(rows[0].verification_status, 'CONFIRMED');
  });

  test('BEAT 4: Alert Draft & Safety Gate Enforcement', async () => {
    // 1. Draft alert starts in PENDING_AUTHORISATION
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/v1/alerts/draft',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        prediction_id: az1142PredictionId,
        severity: 'Severe',
        headline: 'Critical Landslide Danger in Melthum Ward',
        channels: ['SMS', 'APP', 'CAP'],
      },
    });

    assert.equal(draftRes.statusCode, 201);
    alertId = draftRes.json().id;
    assert.equal(draftRes.json().status, 'PENDING_AUTHORISATION');

    // 2. CRUCIAL SAFETY GATE TEST: Database rejects premature direct dispatch without authorizer
    await assert.rejects(
      async () => {
        await query(`UPDATE alert SET status = 'DISPATCHED', dispatched_at = now() WHERE id = $1`, [alertId]);
      },
      (err) => {
        assert.match(err.message, /alert_must_be_authorised_before_dispatch/);
        return true;
      },
    );
  });

  test('BEAT 5: Human Authorization, CAP 1.2 XML, and Mock SMS Dissemination', async () => {
    // 1. Officer authorizes alert
    const authRes = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/${alertId}/authorise`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { auto_dispatch: false },
    });

    assert.equal(authRes.statusCode, 200);
    assert.equal(authRes.json().status, 'AUTHORISED');
    assert.equal(authRes.json().authorised_by_name, 'Lalrinsanga Sailo');
    assert.equal(authRes.json().cap_xml_generated, true);

    // 2. Fetch CAP 1.2 XML
    const capRes = await app.inject({
      method: 'GET',
      url: `/api/v1/alerts/${alertId}/cap.xml`,
    });

    assert.equal(capRes.statusCode, 200);
    assert.match(capRes.headers['content-type'], /application\/xml/);
    const xml = capRes.body;
    assert.match(xml, /<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">/);
    assert.match(xml, /<status>Exercise<\/status>/);
    assert.match(xml, /<severity>Severe<\/severity>/);
    assert.match(xml, /<language>en-IN<\/language>/);
    assert.match(xml, /<language>hi-IN<\/language>/);
    assert.match(xml, /<language>lus-IN<\/language>/);

    // 3. Dispatch alert
    const dispatchRes = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/${alertId}/dispatch`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(dispatchRes.statusCode, 200);
    assert.equal(dispatchRes.json().status, 'DISPATCHED');

    // 4. Verify 3-language mock SMS delivered
    const smsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/alerts/${alertId}/sms`,
    });

    assert.equal(smsRes.statusCode, 200);
    const smsBody = smsRes.json();
    assert.equal(smsBody.is_dispatched, true);
    assert.equal(smsBody.dispatched_messages.length, 3);
    const langs = smsBody.dispatched_messages.map((m) => m.language).sort();
    assert.deepEqual(langs, ['en', 'hi', 'mizo']);
  });

  test('BEAT 6: Verifiable Immutable Audit Trail (GET /api/v1/audit-log)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/audit-log?limit=10`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.total >= 3);

    const actions = body.items.map((item) => item.action);
    assert.ok(actions.includes('PREDICTION_VERIFIED'));
    assert.ok(actions.includes('ALERT_AUTHORISED'));
    assert.ok(actions.includes('ALERT_DISPATCHED'));
  });
});
