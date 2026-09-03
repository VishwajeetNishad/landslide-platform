/**
 * test/slope_units.test.js -- the slope unit endpoints.
 *
 * TWO GROUPS, AND WHY
 *
 * The first group runs with no database at all, which is what `npm test`
 * gives us (the test script deliberately does not read .env). That is not a
 * limitation to work around -- "the database is missing" is a state the API
 * has to handle honestly, and V2 got it wrong by reporting 200 and "ok" when
 * nothing was connected. So those tests assert the 503.
 *
 * The second group needs real rows and is skipped when DATABASE_URL is
 * absent, so it never fails on Rudra's or Riya's machine. Run it with
 * `npm run test:db`, which does read .env.
 *
 * A skipped test that silently passes would be worse than no test, so the
 * skip reason is printed by the runner and the group asserts loudly if the
 * database is reachable but empty.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe('slope units with no database configured', () => {
  let app;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  // Only meaningful when DATABASE_URL really is unset, which is the case
  // under plain `npm test`.
  test('the collection answers 503, not 500', { skip: HAS_DB && 'DATABASE_URL is set' }, async () => {
    const res = await app.inject({ url: '/api/v1/slope-units' });

    // 503 says "the service cannot answer right now"; 500 would say "this
    // endpoint is broken". /health already reports not_configured, and the
    // two must agree.
    assert.equal(res.statusCode, 503);
    assert.match(res.json().message, /DATABASE_URL/);
  });

  test('the message says how to fix it', { skip: HAS_DB && 'DATABASE_URL is set' }, async () => {
    const res = await app.inject({ url: '/api/v1/slope-units/AZ-1088' });
    assert.equal(res.statusCode, 503);
    assert.match(res.json().message, /npm run migrate/);
  });

  // Validation happens before the handler, so these hold either way.
  test('a district id that is not an identifier is rejected with 400', async () => {
    const res = await app.inject({ url: '/api/v1/slope-units?district=AIZAWL;DROP TABLE' });
    assert.equal(res.statusCode, 400);
  });

  test('a slope unit id that is not an identifier is rejected with 400', async () => {
    const res = await app.inject({ url: '/api/v1/slope-units/..%2Fetc%2Fpasswd' });
    assert.equal(res.statusCode, 400);
  });
});

describe('slope units from the database', { skip: !HAS_DB && 'DATABASE_URL is not set -- run npm run test:db' }, () => {
  let app;
  let body;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({ url: '/api/v1/slope-units' });
    assert.equal(res.statusCode, 200, 'the collection must answer 200 when the database is up');
    body = res.json();

    // A reachable but empty database would make every assertion below pass
    // vacuously. Fail loudly instead.
    assert.ok(
      body.features.length > 0,
      'no slope units are loaded -- run: npm run migrate && npm run load:slope-units',
    );
  });

  after(async () => {
    await app.close();
  });

  test('it is a GeoJSON FeatureCollection MapLibre can consume directly', () => {
    assert.equal(body.type, 'FeatureCollection');
    assert.ok(Array.isArray(body.features));
    for (const f of body.features) {
      assert.equal(f.type, 'Feature');
      assert.equal(f.geometry.type, 'Polygon');
    }
  });

  // The bug this guards against is silent: geometry arriving as a JSON
  // *string* containing GeoJSON still looks right in a log line, and the map
  // simply stays empty. ST_AsGeoJSON returns text, so the ::jsonb cast in
  // the query is what makes this pass.
  test('geometry is a parsed object, not a string of JSON', () => {
    for (const f of body.features) {
      assert.equal(typeof f.geometry, 'object', `${f.id} geometry must not be a string`);
    }
  });

  // GeoJSON is [longitude, latitude]; nearly every human-facing tool says
  // "lat, lon". A swap keeps the file valid and draws the district in the
  // wrong hemisphere, so it is worth asserting rather than eyeballing.
  test('coordinates are [lon, lat] and land over Mizoram', () => {
    for (const f of body.features) {
      for (const [lon, lat] of f.geometry.coordinates[0]) {
        assert.ok(lon > 92 && lon < 94, `${f.id}: longitude ${lon} is not in Mizoram`);
        assert.ok(lat > 22 && lat < 25, `${f.id}: latitude ${lat} is not in Mizoram`);
      }
    }
  });

  test('every polygon ring is closed', () => {
    for (const f of body.features) {
      const ring = f.geometry.coordinates[0];
      assert.ok(ring.length >= 4, `${f.id}: a ring needs at least 4 positions`);
      assert.deepEqual(ring[0], ring[ring.length - 1], `${f.id}: ring is not closed`);
    }
  });

  // ---------- the honesty assertions ----------

  test('every feature carries its own source and is_mock', () => {
    for (const f of body.features) {
      assert.equal(typeof f.properties.is_mock, 'boolean', `${f.id} is_mock`);
      assert.ok(f.properties.source && f.properties.source.trim() !== '', `${f.id} source`);
    }
  });

  // The banner must follow the DATA, not the flag. Someone setting
  // DEMO_MODE=false on the morning of the demo while mock polygons are still
  // loaded is the obvious thing to do, and it must not switch the banner off.
  test('mock rows force is_demo_data true regardless of DEMO_MODE', () => {
    const mock = body.features.filter((f) => f.properties.is_mock).length;
    assert.equal(body.meta.mock_count, mock, 'mock_count must be counted from the rows');
    if (mock > 0) {
      assert.equal(body.meta.is_demo_data, true, 'mock rows must force is_demo_data true');
      assert.match(body.meta.disclaimer, /illustrative/);
    }
  });

  test('the internal geometry column is never published in properties', () => {
    for (const f of body.features) {
      assert.ok(!('geom' in f.properties), `${f.id}: geom must not appear in properties`);
      assert.ok(!('centroid_geom' in f.properties));
    }
  });

  // area_ha is derived by ST_Area and came out as 58.12302952152139 before
  // rounding. Fourteen significant digits on a hand-drawn polygon claims
  // precision to a fraction of a square millimetre.
  test('area_ha does not claim more precision than we have', () => {
    for (const f of body.features) {
      const decimals = String(f.properties.area_ha).split('.')[1] ?? '';
      assert.ok(decimals.length <= 2, `${f.id}: area_ha ${f.properties.area_ha} has too many decimals`);
    }
  });

  test('coordinates are capped at 6 decimal places (~11 cm)', () => {
    for (const f of body.features) {
      for (const pair of f.geometry.coordinates[0]) {
        for (const n of pair) {
          const decimals = String(n).split('.')[1] ?? '';
          assert.ok(decimals.length <= 6, `${f.id}: ${n} has too many decimals`);
        }
      }
    }
  });

  // ---------- ordering, single feature, and the two 404s ----------

  test('features come back in a stable order', async () => {
    const again = (await app.inject({ url: '/api/v1/slope-units' })).json();
    assert.deepEqual(
      again.features.map((f) => f.id),
      body.features.map((f) => f.id),
    );
  });

  test('a single slope unit is returned as a bare Feature', async () => {
    const id = body.features[0].id;
    const res = await app.inject({ url: `/api/v1/slope-units/${id}` });

    assert.equal(res.statusCode, 200);
    const f = res.json();
    assert.equal(f.type, 'Feature');
    assert.equal(f.properties.slope_unit_id, id);
    assert.deepEqual(f, body.features[0], 'the single feature must match the one in the collection');
  });

  test('an unknown slope unit id is 404', async () => {
    const res = await app.inject({ url: '/api/v1/slope-units/AZ-0000' });
    assert.equal(res.statusCode, 404);
  });

  // An unknown district and a district with nothing loaded are different
  // situations: "you asked for something that does not exist" versus
  // "nothing is loaded yet". An empty FeatureCollection for both would hide
  // a typo'd district id behind an empty map.
  test('an unknown district is 404, not an empty collection', async () => {
    const res = await app.inject({ url: '/api/v1/slope-units?district=notadistrict' });
    assert.equal(res.statusCode, 404);
    assert.match(res.json().message, /notadistrict/);
  });

  test('the pilot district is the default', async () => {
    const explicit = (await app.inject({ url: '/api/v1/slope-units?district=aizawl' })).json();
    assert.equal(explicit.meta.district_id, body.meta.district_id);
    assert.equal(explicit.meta.count, body.meta.count);
  });
});
