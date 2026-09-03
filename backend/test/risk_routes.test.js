/**
 * test/risk_routes.test.js -- the risk dashboard endpoint.
 *
 * Same two-group split as the other test files: what can be tested without
 * a database runs under `npm test`, and the DB-backed group needs
 * `npm run test:db`.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';

const HAS_DB = Boolean(process.env.DATABASE_URL);
const URL_RISK = '/api/v1/risk/current';

describe('risk dashboard with no database configured', () => {
  let app;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('answers 503 when database is not configured', { skip: HAS_DB && 'DATABASE_URL is set' }, async () => {
    const res = await app.inject({ method: 'GET', url: URL_RISK });
    assert.equal(res.statusCode, 503);
    assert.match(res.json().message, /DATABASE_URL/);
  });

  test('the message says how to fix it', { skip: HAS_DB && 'DATABASE_URL is set' }, async () => {
    const res = await app.inject({ method: 'GET', url: URL_RISK });
    assert.match(res.json().message, /npm run migrate/);
  });

  test('a district id that is not an identifier is rejected with 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${URL_RISK}?district=AIZAWL;DROP+TABLE`,
    });
    assert.equal(res.statusCode, 400);
  });
});

describe('risk dashboard from the database', {
  skip: !HAS_DB && 'DATABASE_URL is not set -- run npm run test:db',
}, () => {
  let app;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('returns a valid GeoJSON FeatureCollection shape', async () => {
    const res = await app.inject({ method: 'GET', url: URL_RISK });

    // Either 200 with data or 200 with empty features (no forecast run yet)
    assert.equal(res.statusCode, 200);

    const body = res.json();
    assert.equal(body.type, 'FeatureCollection');
    assert.ok(body.meta, 'response must have a meta object');
    assert.ok(body.summary, 'response must have a summary object');
    assert.ok(Array.isArray(body.features), 'features must be an array');

    // meta shape
    assert.equal(typeof body.meta.district_id, 'string');
    assert.equal(typeof body.meta.district_name, 'string');
    assert.equal(typeof body.meta.is_demo_data, 'boolean');
  });

  test('summary counts are consistent with features', async () => {
    const res = await app.inject({ method: 'GET', url: URL_RISK });
    const body = res.json();

    if (body.features.length > 0) {
      const { summary, features } = body;

      assert.equal(
        summary.total_slope_units,
        features.length,
        'total_slope_units must equal features count',
      );

      let high = 0;
      let medium = 0;
      let low = 0;
      for (const f of features) {
        const rl = f.properties.risk_level;
        if (rl === 'HIGH') high++;
        else if (rl === 'MEDIUM') medium++;
        else low++;
      }

      assert.equal(summary.high_risk_count, high);
      assert.equal(summary.medium_risk_count, medium);
      assert.equal(summary.low_risk_count, low);
    }
  });

  test('each feature has the three separate fields', async () => {
    const res = await app.inject({ method: 'GET', url: URL_RISK });
    const body = res.json();

    for (const f of body.features) {
      const p = f.properties;
      assert.ok('probability' in p, `${p.slope_unit_id}: missing probability`);
      assert.ok('risk_level' in p, `${p.slope_unit_id}: missing risk_level`);
      assert.ok('verification_status' in p, `${p.slope_unit_id}: missing verification_status`);

      // risk_level is one of the three valid values or null
      assert.ok(
        [null, 'LOW', 'MEDIUM', 'HIGH'].includes(p.risk_level),
        `${p.slope_unit_id}: unexpected risk_level '${p.risk_level}'`,
      );
    }
  });

  test('each feature has an exposure_summary', async () => {
    const res = await app.inject({ method: 'GET', url: URL_RISK });
    const body = res.json();

    for (const f of body.features) {
      const p = f.properties;
      assert.ok(p.exposure_summary, `${p.slope_unit_id}: missing exposure_summary`);

      const es = p.exposure_summary;
      assert.ok('buildings_count' in es, 'missing buildings_count');
      assert.ok('population_estimate' in es, 'missing population_estimate');
      assert.ok('population_label' in es, 'missing population_label');
      assert.ok('road_metres' in es, 'missing road_metres');
      assert.ok('critical_facility_count' in es, 'missing critical_facility_count');

      // The wording rule: label must say "Estimated potentially exposed"
      // or "No exposed population"
      assert.ok(
        es.population_label.includes('potentially exposed') ||
          es.population_label.includes('No exposed population') ||
          es.population_label.includes('No exposure data'),
        `${p.slope_unit_id}: population_label violates wording rule: "${es.population_label}"`,
      );
    }
  });

  test('an unknown district returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${URL_RISK}?district=nonexistent`,
    });
    assert.equal(res.statusCode, 404);
  });

  test('lead_time_hours is a non-negative number or null', async () => {
    const res = await app.inject({ method: 'GET', url: URL_RISK });
    const body = res.json();

    const lt = body.summary.lead_time_hours;
    assert.ok(lt === null || (typeof lt === 'number' && lt >= 0), `lead_time_hours = ${lt}`);
  });
});
