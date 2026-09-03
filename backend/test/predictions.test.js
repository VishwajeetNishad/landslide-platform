/**
 * test/predictions.test.js -- the ingest endpoint.
 *
 * Same two-group split as test/slope_units.test.js: what can be asserted
 * without a database runs under `npm test`, and what needs real slope unit
 * rows is skipped unless DATABASE_URL is set, so nothing here fails on
 * Rudra's or Riya's machine. `npm run test:db` runs the second group.
 *
 * WHAT IS WORTH TESTING HERE
 *
 * Not "does a valid body get stored" alone -- that is one test. The
 * interesting assertions are the refusals, because each one corresponds to
 * a specific way a wrong number could otherwise reach a district officer:
 *
 *   - a probability of 1.5 would make every slope catastrophic
 *   - an input_cutoff_ts after run_ts is temporal leakage, which makes
 *     hindcast accuracy fictional
 *   - a risk_level sent by the model would make the project's central
 *     claim false in code while true in the documentation
 *   - an invalid runout polygon intersects nothing, so exposure comes out
 *     zero and risk reads LOW on a populated hillside
 *
 * Every case below is built by mutating the shipped contract file rather
 * than by hand-writing a body. That way a change to the contract shows up
 * here as a failure instead of leaving these fixtures quietly testing a
 * shape nobody sends any more.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildApp } from '../src/app.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_FILE = path.resolve(HERE, '../../data/sample/mock_ml_output.json');
const URL_INGEST = '/api/v1/predictions/ingest';

const HAS_DB = Boolean(process.env.DATABASE_URL);

const contract = JSON.parse(await readFile(CONTRACT_FILE, 'utf8'));

/** A fresh deep copy, so one test's mutation cannot reach another. */
const body = () => JSON.parse(JSON.stringify(contract));

/**
 * A copy whose model_version is tagged `test-<name>`, so the after hook can
 * delete exactly the runs this file created and nothing else.
 *
 * Every test that can reach a 201 must use this, including the ones in the
 * DB-free group -- with DATABASE_URL set that group still runs, and a test
 * that posts an untagged valid body leaves a real-looking forecast_run
 * behind on every `npm run test:db`. That happened on the first run of this
 * file: two stray `tank-stageA-v0.1` runs, indistinguishable from the honest
 * ingest, which is the sort of row that later gets demoed by mistake.
 */
const tagged = (name) => {
  const b = body();
  b.forecast_run.model_version = `test-${name}`;
  return b;
};

describe('ingest with no database configured', () => {
  let app;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('a valid body answers 503, not 500', { skip: HAS_DB && 'DATABASE_URL is set' }, async () => {
    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: tagged('no-db') });
    assert.equal(res.statusCode, 503);
    assert.match(res.json().message, /DATABASE_URL/);
  });

  // These run either way: the schema layer sits in front of the handler,
  // so it never reaches requireDatabase().
  test('the body schema runs before the database is touched', async () => {
    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: { nonsense: true } });
    assert.equal(res.statusCode, 422);
  });

  // The reason app.js has a schemaErrorFormatter at all. Fastify answers
  // 400 by default, docs/API_CONTRACT.md promises 422, and Riya's error
  // handling is written against 422.
  test('a schema failure is 422, not Fastify\'s default 400', async () => {
    const b = body();
    b.predictions[0].probability = 1.5;

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.equal(res.json().error, 'Unprocessable Entity');
  });

  // Without this the 422 would carry a count and no content -- the actual
  // fields would only exist in the server log, which Rudra does not have.
  test('the response names the offending field', async () => {
    const b = body();
    b.predictions[0].probability = 1.5;

    const { details } = (await app.inject({ method: 'POST', url: URL_INGEST, payload: b })).json();
    assert.ok(Array.isArray(details));
    assert.match(details[0], /predictions\[0\]\.probability/);
  });

  // Several wrong things at once must all be reported. Returning only the
  // first would mean fixing one, re-posting, and finding the next.
  test('every problem is reported at once, not just the first', async () => {
    const b = body();
    b.predictions[0].probability = 1.5;
    b.predictions[1].probability = 2.5;

    const { details } = (await app.inject({ method: 'POST', url: URL_INGEST, payload: b })).json();
    assert.ok(details.length >= 2, `expected at least 2 problems, got ${details.length}`);
  });

  // The promotion to 422 applies to the BODY only. V6's querystring and
  // path validations must stay at 400 -- a bad URL is a request that was
  // not understood, not one whose meaning is wrong.
  test('querystring failures stay 400', async () => {
    const res = await app.inject({ url: '/api/v1/slope-units?district=AIZAWL;DROP TABLE' });
    assert.equal(res.statusCode, 400);
  });

  test('path parameter failures stay 400', async () => {
    const res = await app.inject({ url: '/api/v1/slope-units/..%2Fetc%2Fpasswd' });
    assert.equal(res.statusCode, 400);
  });

  // ---------- refusals the schema alone can express ----------

  test('an empty predictions array is refused', async () => {
    const b = body();
    b.predictions = [];

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
  });

  test('a missing input_cutoff_ts is refused', async () => {
    const b = body();
    delete b.forecast_run.input_cutoff_ts;

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.match(JSON.stringify(res.json().details), /input_cutoff_ts/);
  });

  // A bare "2026-09-03T10:00:00" is ambiguous, and for input_cutoff_ts an
  // ambiguous instant is a hole in the leakage argument: IST is +05:30, so
  // reading it as UTC silently moves the cutoff 5.5 hours later -- exactly
  // the direction that would let future rainfall in.
  test('a timestamp with no UTC offset is refused', async () => {
    const b = body();
    b.forecast_run.run_ts = '2026-09-03T10:00:00';

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.match(JSON.stringify(res.json().details), /date-time/);
  });

  test('a runout with no source_citation is refused', async () => {
    const b = body();
    delete b.predictions[0].runout.source_citation;

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.match(JSON.stringify(res.json().details), /source_citation/);
  });

  // ---------- the two fields the model does not get to set ----------
  //
  // Refused by NAME rather than dropped. Fastify's AJV runs with
  // removeAdditional: true, so `additionalProperties: false` would strip
  // these silently -- Rudra would send a risk_level, the backend would
  // discard it, and he would believe it was honoured.

  test('a risk_level sent by the model is refused, not silently dropped', async () => {
    const b = body();
    b.predictions[0].risk_level = 'HIGH';

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.match(JSON.stringify(res.json().details), /risk_level is computed by the backend/);
  });

  test('a verification_status sent by the model is refused', async () => {
    const b = body();
    b.predictions[0].verification_status = 'CONFIRMED';

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.match(JSON.stringify(res.json().details), /named officer/);
  });

  test('an is_demo_data asserted by the caller is refused', async () => {
    const b = body();
    b.predictions[0].is_demo_data = false;

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
  });

  // ---------- cross-field rules, which JSON Schema cannot express ----------

  test('input_cutoff_ts after run_ts is refused as temporal leakage', async () => {
    const b = body();
    b.forecast_run.input_cutoff_ts = '2026-09-04T09:00:00+05:30'; // a day AFTER the run

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.match(JSON.stringify(res.json().details), /temporal leakage/);
  });

  test('an inverted confidence band is refused', async () => {
    const b = body();
    b.predictions[0].confidence_lower = 0.9;
    b.predictions[0].confidence_upper = 0.5;

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
  });

  // Worse than an inverted band, because it looks like honest uncertainty
  // while being arithmetically impossible, and it would be drawn on a
  // chart without anyone noticing.
  test('a probability outside its own confidence band is refused', async () => {
    const b = body();
    b.predictions[0].probability = 0.99; // band is [0.58, 0.84]

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.match(JSON.stringify(res.json().details), /outside its own confidence band/);
  });

  test('valid_to at or before valid_from is refused', async () => {
    const b = body();
    b.predictions[0].valid_to = b.predictions[0].valid_from;

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
  });

  // `drivers` is left open in the schema because the feature set is
  // Rudra's to change, so the values are checked here instead. A string
  // contribution would reach the frontend as a bar chart bar of height
  // "high".
  test('a SHAP contribution that is not a number is refused', async () => {
    const b = body();
    b.predictions[0].drivers.swi_mm = 'high';

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.match(JSON.stringify(res.json().details), /finite number/);
  });

  // The project rule, enforced in the endpoint so the caller gets a 422
  // naming the field rather than a 500 from the CHECK constraint.
  test('a population figure with no source is refused', async () => {
    const b = body();
    delete b.predictions[0].exposure.population_source; // population_estimate is 120

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.match(JSON.stringify(res.json().details), /population_source is missing/);
  });

  // Zero is exempt. "Nobody is exposed" is a finding, not an estimate, and
  // AZ-1088 -- probability 0.95, exposure zero, risk LOW -- depends on
  // being able to record exactly that.
  // The only test in this group that can reach a 201 when DATABASE_URL is
  // set, so it is tagged and the DB group's after hook removes it.
  test('a population of zero needs no source', async () => {
    const b = tagged('zero-population');
    const az1088 = b.predictions.find((p) => p.slope_unit_id === 'AZ-1088');
    assert.equal(az1088.exposure.population_estimate, 0, 'the contract file must keep this case');
    delete az1088.exposure.population_source;

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.notEqual(res.statusCode, 422, 'zero exposure must not require a source');
  });

  test('two predictions for the same slope unit in one run are refused', async () => {
    const b = body();
    b.predictions[1].slope_unit_id = b.predictions[0].slope_unit_id;

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.match(JSON.stringify(res.json().details), /same slope unit/);
  });
});

describe('ingest against the database', { skip: !HAS_DB && 'DATABASE_URL is not set -- run npm run test:db' }, () => {
  let app;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    // Every run this group creates is removed again, so the database is
    // left exactly as it was. ON DELETE CASCADE takes the predictions,
    // runouts and exposures with it.
    await app.inject({ url: '/health' }); // make sure the pool is up
    const { query } = await import('../src/db/pool.js');
    await query("DELETE FROM forecast_run WHERE model_version LIKE 'test-%'");
    await app.close();
  });

  test('the shipped contract file is accepted', async () => {
    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: tagged('accepts') });

    assert.equal(res.statusCode, 201, JSON.stringify(res.json()));
    const out = res.json();
    assert.equal(out.predictions_stored, 3);
    assert.equal(out.runouts_stored, 3);
    assert.equal(out.exposures_stored, 3);
    assert.ok(out.forecast_run_id > 0);
  });

  // The whole point of the endpoint. risk_level must be NULL until V8
  // computes it from probability and exposure, and NULL must be returned
  // explicitly rather than omitted -- a missing key could be read as
  // "risk was computed and came out fine".
  test('nothing is stored with a risk_level', async () => {
    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: tagged('null-risk') });
    assert.equal(res.json().risk_level, null);

    const { query } = await import('../src/db/pool.js');
    const { rows } = await query(
      `SELECT p.risk_level, p.verification_status, p.verified_by, p.verified_at
       FROM prediction p JOIN forecast_run f ON f.id = p.forecast_run_id
       WHERE f.model_version = 'test-null-risk'`,
    );

    assert.equal(rows.length, 3);
    for (const r of rows) {
      assert.equal(r.risk_level, null, 'risk_level must be NULL until exposure is known');
      assert.equal(r.verification_status, 'PENDING_VERIFICATION');
      assert.equal(r.verified_by, null);
      assert.equal(r.verified_at, null);
    }
  });

  test('an unknown slope_unit_id is 422 naming the id, not a 500 from the foreign key', async () => {
    const b = tagged('unknown-unit');
    b.predictions[0].slope_unit_id = 'AZ-9999';

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.match(JSON.stringify(res.json().details), /AZ-9999/);
  });

  // ---------- geometry, judged by PostGIS ----------

  test('an unclosed ring is refused with the position count', async () => {
    const b = tagged('unclosed-ring');
    b.predictions[0].runout.envelope_geojson.coordinates = [
      [[92.74, 23.75], [92.745, 23.75], [92.745, 23.746]],
    ];

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.match(JSON.stringify(res.json().details), /at least 4 positions/);
  });

  // A bowtie: closed, 5 positions, passes every count check, invalid
  // because it crosses itself. This is what an envelope built from badly
  // ordered vertices actually looks like, and before migration 008 it was
  // stored happily with ST_IsValid false.
  test('a self-intersecting envelope is refused with the crossing point', async () => {
    const b = tagged('bowtie');
    b.predictions[0].runout.envelope_geojson.coordinates = [
      [[92.74, 23.75], [92.745, 23.746], [92.745, 23.75], [92.74, 23.746], [92.74, 23.75]],
    ];

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);
    assert.match(JSON.stringify(res.json().details), /Self-intersection/);
  });

  // ---------- all or nothing ----------
  //
  // A body that is valid for two predictions and wrong on the third must
  // write none of them. A half-ingested run would render as a partial
  // forecast rather than a failed one, and nothing downstream could tell
  // the difference.
  test('a failure on the last prediction stores none of the earlier ones', async () => {
    const { query } = await import('../src/db/pool.js');
    const before = await query('SELECT count(*)::int AS n FROM forecast_run');

    const b = tagged('all-or-none');
    b.predictions[2].probability = 0.99; // outside its band [0.88, 0.98]

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 422);

    const after = await query('SELECT count(*)::int AS n FROM forecast_run');
    assert.equal(after.rows[0].n, before.rows[0].n, 'no forecast_run row may survive a refusal');

    const probe = await query(
      "SELECT count(*)::int AS n FROM forecast_run WHERE model_version = 'test-all-or-none'",
    );
    assert.equal(probe.rows[0].n, 0);
  });

  // ---------- honesty ----------

  test('is_demo_data is forced true by mock slope units', async () => {
    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: tagged('demo-flag') });
    const out = res.json();

    // The shipped slope units are mock, so this holds whatever DEMO_MODE
    // says. Same rule as V6's envelope: rows outvote the flag in one
    // direction only.
    if (out.mock_slope_units > 0) {
      assert.equal(out.is_demo_data, true, 'mock slope units must force is_demo_data true');
    }

    const { query } = await import('../src/db/pool.js');
    const { rows } = await query(
      "SELECT is_demo_data FROM forecast_run WHERE model_version = 'test-demo-flag'",
    );
    assert.equal(rows[0].is_demo_data, out.is_demo_data, 'the stored flag must match the reply');
  });

  // A placeholder citation satisfies both NOT NULL and btrim(...) <> '',
  // so the database cannot catch it. Rejecting it would block the shipped
  // contract file, which DEMO_PLAN.md plans to post during the demo. So it
  // is accepted and named.
  test('a placeholder citation is accepted but reported as a warning', async () => {
    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: tagged('warnings') });

    assert.equal(res.statusCode, 201);
    const { warnings } = res.json();
    assert.ok(
      warnings.some((w) => /source_citation reads like a placeholder/.test(w)),
      'the shipped file\'s PLACEHOLDER citations must be reported',
    );
    assert.ok(
      warnings.some((w) => /must not be quoted as a measurement/.test(w)),
      'a mock population_source must be reported',
    );
  });

  // `_comment` keys live inside the objects that become JSONB columns --
  // inside drivers, inside rainfall, inside a road segment. Stored, a
  // _comment in `drivers` would reach the frontend as a SHAP feature named
  // "_comment" whose contribution is a sentence.
  test('_comment keys are stripped from every stored JSONB blob', async () => {
    await app.inject({ method: 'POST', url: URL_INGEST, payload: tagged('no-comments') });

    const { query } = await import('../src/db/pool.js');
    const { rows } = await query(
      `SELECT p.drivers, p.rainfall, p.tank_state, e.road_segments, e.critical_facilities
       FROM prediction p
       LEFT JOIN exposure e ON e.prediction_id = p.id
       JOIN forecast_run f ON f.id = p.forecast_run_id
       WHERE f.model_version = 'test-no-comments'`,
    );

    assert.ok(rows.length > 0);
    for (const row of rows) {
      const asText = JSON.stringify(row);
      assert.ok(!asText.includes('"_comment"'), `a _comment survived: ${asText.slice(0, 200)}`);
      assert.ok(!/"_[a-z]/.test(asText), `an underscore key survived: ${asText.slice(0, 200)}`);
    }
  });

  // is_estimate is forced true rather than taken from the caller. Every
  // figure here comes out of a model runout envelope, not a survey, and
  // is_estimate: false would let a modelled count be presented as a count.
  test('exposure is always stored as an estimate', async () => {
    const b = tagged('is-estimate');
    b.predictions[0].exposure.is_estimate = false;

    const res = await app.inject({ method: 'POST', url: URL_INGEST, payload: b });
    assert.equal(res.statusCode, 201);

    const { query } = await import('../src/db/pool.js');
    const { rows } = await query(
      `SELECT e.is_estimate FROM exposure e
       JOIN prediction p ON p.id = e.prediction_id
       JOIN forecast_run f ON f.id = p.forecast_run_id
       WHERE f.model_version = 'test-is-estimate'`,
    );

    for (const r of rows) {
      assert.equal(r.is_estimate, true, 'a modelled count is never a survey');
    }
  });

  // A NULL road_metres beside a listed road segment would make the UI
  // print "0 m of road" next to a road it is naming.
  test('road_metres is summed from the segments when it is not given', async () => {
    const { query } = await import('../src/db/pool.js');
    await app.inject({ method: 'POST', url: URL_INGEST, payload: tagged('road-metres') });

    const { rows } = await query(
      `SELECT p.slope_unit_id, e.road_metres, e.road_segments FROM exposure e
       JOIN prediction p ON p.id = e.prediction_id
       JOIN forecast_run f ON f.id = p.forecast_run_id
       WHERE f.model_version = 'test-road-metres' AND jsonb_array_length(e.road_segments) > 0`,
    );

    assert.ok(rows.length > 0, 'the contract file must keep at least one road segment');
    for (const r of rows) {
      const summed = r.road_segments.reduce((s, seg) => s + Number(seg.metres || 0), 0);
      assert.equal(Number(r.road_metres), summed, `${r.slope_unit_id}: road_metres must match its segments`);
    }
  });

  test('the runout envelope is stored in EPSG:4326 and valid', async () => {
    const { query } = await import('../src/db/pool.js');
    await app.inject({ method: 'POST', url: URL_INGEST, payload: tagged('geom-srid') });

    const { rows } = await query(
      `SELECT ST_SRID(r.geom) AS srid, ST_IsValid(r.geom) AS valid, ST_GeometryType(r.geom) AS gtype
       FROM runout_envelope r
       JOIN prediction p ON p.id = r.prediction_id
       JOIN forecast_run f ON f.id = p.forecast_run_id
       WHERE f.model_version = 'test-geom-srid'`,
    );

    assert.equal(rows.length, 3);
    for (const r of rows) {
      assert.equal(r.srid, 4326);
      assert.equal(r.valid, true);
      assert.equal(r.gtype, 'ST_Polygon');
    }
  });
});
