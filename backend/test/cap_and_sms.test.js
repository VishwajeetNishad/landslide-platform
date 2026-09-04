/**
 * test/cap_and_sms.test.js -- Common Alerting Protocol (CAP 1.2) XML & Multilingual SMS (Step V14).
 *
 * Verifies:
 * 1. Frozen SMS template rendering across English, Hindi, and Mizo (zero generative LLM drift).
 * 2. GeoJSON polygon conversion to CAP 1.2 "lat,lon lat,lon" coordinates.
 * 3. XML construction strictly conforming to OASIS CAP 1.2 schema with status="Exercise".
 * 4. GET /api/v1/alerts/:id/cap.xml endpoint serving application/xml.
 * 5. GET /api/v1/alerts/:id/sms endpoint serving 3-language previews.
 * 6. Alert dispatch writes 3 delivered records (en, hi, mizo) into mock_sms_dispatch table.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';
import { query } from '../src/db/pool.js';
import { geoJsonPolygonToCap, buildCap12Xml } from '../src/alerting/cap.js';
import { renderSmsTemplates } from '../src/alerting/templates.js';

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe('Step V14 -- Frozen SMS Templates & CAP 1.2 XML Unit Tests', () => {
  test('renderSmsTemplates renders safe deterministic strings for EN, HI, and MIZO', () => {
    const texts = renderSmsTemplates({
      severity: 'Severe',
      wardName: 'Melthum',
      districtName: 'Aizawl',
      validFrom: new Date('2026-09-04T20:00:00Z'),
      validTo: new Date('2026-09-05T08:00:00Z'),
    });

    // English checks
    assert.match(texts.en, /Landslide risk HIGH/);
    assert.match(texts.en, /Melthum/);
    assert.match(texts.en, /Aizawl/);
    assert.doesNotMatch(texts.en, /undefined/);
    assert.doesNotMatch(texts.en, /null/);

    // Hindi checks
    assert.match(texts.hi, /भूस्खलन जोखिम उच्च \/ गंभीर/);
    assert.match(texts.hi, /Melthum/);
    assert.doesNotMatch(texts.hi, /undefined/);

    // Mizo checks
    assert.match(texts.mizo, /Chhiatrupna hlauhawm hlauhawm tak/);
    assert.match(texts.mizo, /Melthum/);
    assert.doesNotMatch(texts.mizo, /undefined/);
  });

  test('geoJsonPolygonToCap converts [lon, lat] coordinates to CAP "lat,lon" sequence', () => {
    const geom = {
      type: 'Polygon',
      coordinates: [
        [
          [92.71, 23.72],
          [92.73, 23.72],
          [92.73, 23.74],
          [92.71, 23.72],
        ],
      ],
    };

    const capStr = geoJsonPolygonToCap(geom);
    assert.equal(capStr, '23.720000,92.710000 23.720000,92.730000 23.740000,92.730000 23.720000,92.710000');
  });

  test('buildCap12Xml produces valid OASIS CAP 1.2 XML with 3 info blocks', () => {
    const xml = buildCap12Xml(
      { id: 99, severity: 'Severe', headline: 'Critical Risk', body: 'Take care' },
      {
        status: 'Exercise',
        context: { ward_name: 'Melthum', district_id: 'aizawl' },
      },
    );

    assert.match(xml, /<\?xml version="1.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">/);
    assert.match(xml, /<status>Exercise<\/status>/);
    assert.match(xml, /<eventCode>\s*<valueName>SAME<\/valueName>\s*<value>LSW<\/value>\s*<\/eventCode>/);
    assert.match(xml, /<language>en-IN<\/language>/);
    assert.match(xml, /<language>hi-IN<\/language>/);
    assert.match(xml, /<language>lus-IN<\/language>/);
    assert.match(xml, /<\/alert>$/);
  });
});

describe('Step V14 -- CAP XML & Mock SMS Endpoints (database backed)', {
  skip: !HAS_DB && 'DATABASE_URL is not set -- run npm run test:db',
}, () => {
  let app;
  let adminToken;
  let predictionId;
  let alertId;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    // 1. Get token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin.aizawl@disaster.mz.gov.in',
        password: 'prototype2026!',
      },
    });
    adminToken = loginRes.json().token;

    // 2. Setup run and prediction
    const { rows: runRows } = await query(
      `INSERT INTO forecast_run (run_ts, input_cutoff_ts, model_version, is_demo_data)
       VALUES (now(), now(), 'test-v14', true)
       RETURNING id`,
    );
    const runId = runRows[0].id;

    const { rows: pRows } = await query(
      `INSERT INTO prediction (forecast_run_id, slope_unit_id, probability, risk_level,
                               valid_from, valid_to, verification_status)
       VALUES ($1, 'AZ-1142', 0.88, 'HIGH', now(), now() + interval '12 hours', 'PENDING_VERIFICATION')
       RETURNING id`,
      [runId],
    );
    predictionId = Number(pRows[0].id);

    // 3. Draft an alert
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/v1/alerts/draft',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        prediction_id: predictionId,
        severity: 'Severe',
        headline: 'Critical Landslide Alert for Melthum Ward',
        channels: ['SMS', 'APP', 'CAP'],
      },
    });
    alertId = draftRes.json().id;
  });

  after(async () => {
    if (HAS_DB) {
      await query(`DELETE FROM mock_sms_dispatch WHERE alert_id = $1`, [alertId]);
      await query(`DELETE FROM alert WHERE id = $1`, [alertId]);
      await query(`DELETE FROM prediction WHERE id = $1`, [predictionId]);
      await query(`DELETE FROM forecast_run WHERE model_version = 'test-v14'`);
    }
    await app.close();
  });

  test('GET /api/v1/alerts/:id/cap.xml returns OASIS CAP 1.2 XML with Content-Type application/xml', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/alerts/${alertId}/cap.xml`,
    });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /application\/xml/);
    const xml = res.body;

    assert.match(xml, /<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">/);
    assert.match(xml, /<status>Exercise<\/status>/);
    assert.match(xml, /<severity>Severe<\/severity>/);
    assert.match(xml, /<language>en-IN<\/language>/);
    assert.match(xml, /<language>hi-IN<\/language>/);
    assert.match(xml, /<language>lus-IN<\/language>/);
    assert.match(xml, /Melthum/);
  });

  test('GET /api/v1/alerts/:id/sms returns 3-language previews before dispatch', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/alerts/${alertId}/sms`,
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.alert_id, alertId);
    assert.equal(body.is_dispatched, false);
    assert.ok(body.previews.en.includes('Landslide risk HIGH'));
    assert.ok(body.previews.hi.includes('भूस्खलन जोखिम'));
    assert.ok(body.previews.mizo.includes('Chhiatrupna hlauhawm'));
    assert.equal(body.dispatched_messages.length, 0);
  });

  test('POST /api/v1/alerts/:id/authorise generates CAP XML and updates database', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/${alertId}/authorise`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { auto_dispatch: false },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, 'AUTHORISED');
    assert.equal(body.cap_xml_generated, true);

    // Verify in DB that cap_xml is saved
    const { rows } = await query(`SELECT cap_xml FROM alert WHERE id = $1`, [alertId]);
    assert.ok(rows[0].cap_xml.includes('urn:oasis:names:tc:emergency:cap:1.2'));
  });

  test('POST /api/v1/alerts/:id/dispatch executes mock SMS dispatch across 3 languages', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/${alertId}/dispatch`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, 'DISPATCHED');
    assert.ok(body.dispatched_at);

    // Verify 3 rows inserted in mock_sms_dispatch (en, hi, mizo)
    const { rows: smsRows } = await query(
      `SELECT language, recipient_group, message_text, status
       FROM mock_sms_dispatch
       WHERE alert_id = $1
       ORDER BY language ASC`,
      [alertId],
    );

    assert.equal(smsRows.length, 3);
    const langs = smsRows.map((r) => r.language);
    assert.deepEqual(langs.sort(), ['en', 'hi', 'mizo']);
    assert.ok(smsRows.every((r) => r.status === 'DELIVERED'));

    // Verify GET /api/v1/alerts/:id/sms now returns dispatched history
    const smsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/alerts/${alertId}/sms`,
    });
    const smsBody = smsRes.json();
    assert.equal(smsBody.is_dispatched, true);
    assert.equal(smsBody.dispatched_messages.length, 3);
  });
});
