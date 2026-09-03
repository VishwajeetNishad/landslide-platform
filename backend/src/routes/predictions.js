/**
 * src/routes/predictions.js -- ingesting the model's output.
 *
 *   POST /api/v1/predictions/ingest
 *
 * This is the seam between Rudra's Python and my database, and it is the
 * place where a wrong number is cheapest to stop. Once a row is in
 * `prediction`, the dashboard will draw it, an officer may act on it, and
 * V13 may put it in a CAP alert. So this endpoint is deliberately
 * suspicious of its input.
 *
 * WHAT VALIDATES WHERE, AND WHY IT IS SPLIT
 *
 * Three layers, each doing what only it can do:
 *
 *   1. The JSON Schema below. Shape, types, ranges, required fields. It
 *      runs BEFORE the handler, so a malformed body never reaches any of
 *      my code. It is also the /docs page, so there is one source of
 *      truth rather than a schema and a prose description that drift.
 *
 *   2. This handler. Everything the schema cannot express: whether a
 *      slope_unit_id actually exists, whether the confidence band
 *      contains its own point estimate, whether input_cutoff_ts is at or
 *      before run_ts. JSON Schema has no way to compare two fields.
 *
 *   3. The CHECK constraints in migration 004. The last line of defence.
 *      Layer 2 and layer 3 deliberately overlap: if I write a bug here,
 *      the database still refuses the row. The difference is the error a
 *      caller sees -- this handler gives Rudra a 422 naming the field,
 *      while the constraint alone would surface as a 500.
 *
 * WHY 422 AND NOT 400
 *
 * 400 means "I could not understand this request". 422 means "I
 * understood it and it is not acceptable". Rudra's body is well-formed
 * JSON and every key is spelled right -- it is the MEANING that is wrong
 * (a probability of 1.5, a slope unit that does not exist). 422 is what
 * docs/API_CONTRACT.md promises, and Riya's error handling is written
 * against it.
 *
 * Fastify answers 400 on a schema failure by default. app.js installs a
 * schemaErrorFormatter that turns body failures into 422 while leaving
 * querystring and path failures at 400 -- see the long note there.
 */

import { config } from '../core/config.js';
import { getPool, query, withTransaction } from '../db/pool.js';
import { calculateRiskLevel } from '../exposure/risk.js';

/**
 * Same 503 as the slope unit routes, and for the same reason: it agrees
 * with what /health already reports as `not_configured`, whereas a 500
 * would send whoever is debugging it looking for a bug in the SQL.
 */
function requireDatabase() {
  if (getPool() === null) {
    const err = new Error(
      'The database is not configured, so predictions cannot be ingested. ' +
        'Set DATABASE_URL (see .env.example) and run: npm run migrate && npm run load:slope-units',
    );
    err.statusCode = 503;
    throw err;
  }
}

/**
 * A 422 with the offending fields named.
 *
 * `details` is an array rather than one string because a single ingest
 * can be wrong in several places at once, and returning only the first
 * would mean Rudra fixes one thing, re-posts, and finds the next. The
 * schema layer already reports all of its errors at once; the handler
 * layer should not be worse.
 */
function unprocessable(details) {
  const err = new Error(
    `The forecast was understood but cannot be accepted: ${details.length} problem(s). ` +
      'Nothing was written -- the whole ingest is one transaction.',
  );
  err.statusCode = 422;
  err.details = details;
  return err;
}

// ---------------------------------------------------------------
// `_comment` keys
//
// data/sample/mock_ml_output.json documents itself with `_comment` keys
// INSIDE the objects that become JSONB columns -- inside `drivers`,
// inside `rainfall`, even inside a road segment. That file is the
// contract, so Rudra's real output may well carry them too.
//
// They must not be stored. `drivers` is rendered as a bar chart of SHAP
// contributions, so a `_comment` key would arrive at the frontend as a
// feature named "_comment" whose contribution is a sentence. Stripping
// them here is the only place it can be done once for every blob.
//
// Recursive, because the mock file has one nested inside an array
// element (`exposure.road_segments[0]._comment`).
// ---------------------------------------------------------------
function stripComments(value) {
  if (Array.isArray(value)) return value.map(stripComments);
  if (value === null || typeof value !== 'object') return value;

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('_')) continue;
    out[k] = stripComments(v);
  }
  return out;
}

// ---------------------------------------------------------------
// The request body schema.
//
// Note what is NOT here: `additionalProperties: false` on a prediction.
// Fastify's AJV runs with removeAdditional: true, which means
// additionalProperties: false STRIPS an unknown field instead of
// rejecting it. For `risk_level` and `verification_status` that would be
// the worst outcome available: Rudra sends a risk_level, the backend
// silently drops it, and he believes it was honoured. So those two are
// left to reach the handler, which refuses them by name. See the check in
// rejectFieldsThatAreNotHisToSet().
// ---------------------------------------------------------------

// ISO 8601 with an offset. `format: 'date-time'` requires the offset
// (Z or +hh:mm), and that is the point -- "2026-09-03T10:00:00" is
// ambiguous, and for input_cutoff_ts an ambiguous instant is a hole in
// the leakage argument. IST is +05:30, so a bare timestamp read as UTC
// silently moves the cutoff 5.5 hours later, which is exactly the
// direction that would let future rainfall in.
const timestamp = { type: 'string', format: 'date-time' };

const forecastRunSchema = {
  type: 'object',
  required: ['run_ts', 'input_cutoff_ts', 'model_version', 'is_hindcast'],
  properties: {
    run_ts: timestamp,
    input_cutoff_ts: timestamp,
    model_version: { type: 'string', minLength: 1 },
    is_hindcast: { type: 'boolean' },
  },
};

const predictionSchema = {
  type: 'object',
  required: [
    'slope_unit_id',
    'valid_from',
    'valid_to',
    'probability',
    'confidence_lower',
    'confidence_upper',
    'tank_state',
    'rainfall',
    'drivers',
    'counterfactual',
    'data_quality',
  ],
  properties: {
    slope_unit_id: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,40}$' },
    valid_from: timestamp,
    valid_to: timestamp,

    // A probability, not a percentage. A model that starts emitting 72
    // instead of 0.72 would otherwise make every slope catastrophic, and
    // the map would be entirely red with no error anywhere.
    probability: { type: 'number', minimum: 0, maximum: 1 },
    susceptibility_score: { type: 'number', minimum: 0, maximum: 1 },

    // Required, not optional. A bare point estimate is the thing this
    // project has decided not to publish: "0.72" reads as knowledge,
    // "0.72 (0.58-0.84), nearest gauge 11 km" reads as a measurement with
    // its own limits, which is what a district officer actually needs.
    confidence_lower: { type: 'number', minimum: 0, maximum: 1 },
    confidence_upper: { type: 'number', minimum: 0, maximum: 1 },

    tank_state: {
      type: 'object',
      required: ['s1_mm', 's2_mm', 's3_mm', 'swi_mm'],
      properties: {
        s1_mm: { type: 'number', minimum: 0 },
        s2_mm: { type: 'number', minimum: 0 },
        s3_mm: { type: 'number', minimum: 0 },
        swi_mm: { type: 'number', minimum: 0 },
      },
    },

    rainfall: {
      type: 'object',
      required: ['observed_24h_mm', 'forecast_24h_mm'],
      properties: {
        observed_24h_mm: { type: 'number', minimum: 0 },
        forecast_24h_mm: { type: 'number', minimum: 0 },
        // forecast_24h / mean_annual_precip. 100 mm in a day is a
        // disaster in a dry valley and an ordinary day at Sohra, so the
        // absolute figure is not comparable across the NER.
        fraction_of_map: { type: 'number', minimum: 0 },
      },
    },

    // SHAP contributions, feature name -> number. Left open because the
    // feature set is Rudra's to decide and will change as the model does.
    // The handler checks the values are numbers once `_comment` is gone.
    drivers: { type: 'object', minProperties: 1 },

    counterfactual: { type: 'string', minLength: 1 },

    data_quality: {
      type: 'object',
      required: ['nearest_gauge_km', 'rainfall_confidence'],
      properties: {
        nearest_gauge_km: { type: 'number', minimum: 0 },
        rainfall_confidence: { type: 'string', enum: ['LOW', 'MODERATE', 'HIGH'] },
      },
    },

    // Optional. A prediction with no runout is still a valid prediction.
    // But if it IS present, source_citation is required -- the angle of
    // reach decides how far downhill we tell people debris may travel,
    // which decides who gets warned. A number like that does not enter
    // the database without the source that produced it.
    runout: {
      type: 'object',
      required: ['method', 'source_citation', 'envelope_geojson'],
      properties: {
        method: { type: 'string', minLength: 1 },
        angle_of_reach_deg: { type: 'number', minimum: 0, maximum: 90 },
        source_citation: { type: 'string', minLength: 1 },
        envelope_geojson: {
          type: 'object',
          required: ['type', 'coordinates'],
          properties: {
            // Passed to ST_GeomFromGeoJSON untouched beyond this. PostGIS
            // is the only thing that really knows what a valid polygon
            // is -- same decision as the V5 loader.
            type: { type: 'string', enum: ['Polygon'] },
            coordinates: { type: 'array' },
          },
        },
      },
    },

    exposure: {
      type: 'object',
      properties: {
        buildings_count: { type: 'integer', minimum: 0 },
        population_estimate: { type: 'integer', minimum: 0 },
        population_source: { type: 'string' },
        road_metres: { type: 'number', minimum: 0 },
        road_segments: { type: 'array' },
        critical_facilities: { type: 'array' },
        is_estimate: { type: 'boolean' },
      },
    },
  },
};

const ingestBodySchema = {
  type: 'object',
  required: ['forecast_run', 'predictions'],
  properties: {
    forecast_run: forecastRunSchema,
    // minItems 1. An ingest with an empty array would answer 200 and
    // write a forecast_run with nothing in it, which the dashboard would
    // render as "the model ran and nothing is at risk" -- a much worse
    // outcome than an error.
    predictions: { type: 'array', minItems: 1, items: predictionSchema },
  },
};

const ingestResponseSchema = {
  type: 'object',
  properties: {
    forecast_run_id: { type: 'integer' },
    predictions_stored: { type: 'integer' },
    runouts_stored: { type: 'integer' },
    exposures_stored: { type: 'integer' },
    is_demo_data: { type: 'boolean' },
    mock_slope_units: { type: 'integer' },
    risk_level: { type: ['string', 'null'] },
    note: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
};

/**
 * The two fields Rudra does not get to set, refused by name rather than
 * dropped.
 *
 * `risk_level` is probability combined with exposure, computed by V8. If
 * the model could set it, the project's central claim -- that risk is not
 * confidence -- would be false in the code while true in the
 * documentation. AZ-1088 is the case that proves it matters: probability
 * 0.95 and risk LOW, because nothing is below it.
 *
 * `verification_status` is set by a named human through V11. A model
 * marking its own output CONFIRMED is the failure this whole project is
 * built to prevent.
 */
function rejectFieldsThatAreNotHisToSet(predictions, details) {
  const notHis = {
    risk_level:
      'risk_level is computed by the backend from probability and exposure, never sent by the model. ' +
      'See docs/API_CONTRACT.md section 5.',
    verification_status:
      'verification_status is set by a named officer through the verification endpoint, never by the model. ' +
      'Every prediction starts at PENDING_VERIFICATION.',
    verified_by: 'verified_by is set only by the verification endpoint.',
    is_demo_data:
      'is_demo_data is derived by the backend from DEMO_MODE and from whether the slope units are mock. ' +
      'It cannot be asserted by the caller.',
  };

  predictions.forEach((p, i) => {
    for (const [field, why] of Object.entries(notHis)) {
      if (field in p) details.push(`predictions[${i}].${field}: ${why}`);
    }
  });
}

/**
 * Everything JSON Schema cannot express, because it compares two fields
 * to each other rather than one field to a constant.
 */
function checkCrossFieldRules(body, details) {
  const run = body.forecast_run;

  // THE temporal leakage check. input_cutoff_ts means "nothing recorded
  // after this instant was used as input". A cutoff AFTER the run
  // timestamp claims the model used data from after it ran, which is not
  // a typo to tolerate -- it is the exact shape of the mistake that makes
  // hindcast accuracy fictional.
  if (new Date(run.input_cutoff_ts) > new Date(run.run_ts)) {
    details.push(
      `forecast_run.input_cutoff_ts (${run.input_cutoff_ts}) is after run_ts (${run.run_ts}). ` +
        'That claims the model used data recorded after it ran. This is temporal leakage.',
    );
  }

  // Duplicate ids inside one body would trip
  // prediction_one_per_unit_per_run as a 500. Caught here instead.
  //
  // This needs no database -- it is one body compared against itself -- so
  // it belongs in this function rather than next to the existence check.
  const seen = new Set();
  const duplicated = new Set();
  for (const p of body.predictions) {
    if (seen.has(p.slope_unit_id)) duplicated.add(p.slope_unit_id);
    seen.add(p.slope_unit_id);
  }
  if (duplicated.size > 0) {
    details.push(
      `Two predictions for the same slope unit in one run: ${[...duplicated].join(', ')}. ` +
        'One run produces one prediction per slope unit.',
    );
  }

  body.predictions.forEach((p, i) => {
    if (new Date(p.valid_to) <= new Date(p.valid_from)) {
      details.push(`predictions[${i}]: valid_to must be after valid_from.`);
    }

    // An inverted band is meaningless. A band that does not contain its
    // own point estimate is worse: it looks like honest uncertainty while
    // being arithmetically impossible, and it would be drawn on a chart
    // without anyone noticing.
    if (p.confidence_lower > p.confidence_upper) {
      details.push(
        `predictions[${i}]: confidence_lower (${p.confidence_lower}) is above ` +
          `confidence_upper (${p.confidence_upper}).`,
      );
    } else if (p.probability < p.confidence_lower || p.probability > p.confidence_upper) {
      details.push(
        `predictions[${i}]: probability ${p.probability} lies outside its own confidence band ` +
          `[${p.confidence_lower}, ${p.confidence_upper}].`,
      );
    }

    // SHAP contributions must be numbers. Checked after `_comment` keys
    // are gone, since the contract file puts one inside `drivers`.
    const drivers = stripComments(p.drivers);
    if (Object.keys(drivers).length === 0) {
      details.push(`predictions[${i}].drivers: no drivers left once _comment keys are removed.`);
    }
    for (const [feature, contribution] of Object.entries(drivers)) {
      if (typeof contribution !== 'number' || !Number.isFinite(contribution)) {
        details.push(
          `predictions[${i}].drivers.${feature}: a SHAP contribution must be a finite number, ` +
            `got ${JSON.stringify(contribution)}.`,
        );
      }
    }

    // The population rule, checked here so the caller gets a 422 naming
    // the field rather than a 500 from exposure_population_needs_a_source.
    // Zero is exempt: "nobody is exposed" is a finding, not an estimate,
    // and AZ-1088 depends on being able to record exactly that.
    const ex = p.exposure;
    if (ex && typeof ex.population_estimate === 'number' && ex.population_estimate > 0) {
      if (!ex.population_source || ex.population_source.trim() === '') {
        details.push(
          `predictions[${i}].exposure: population_estimate is ${ex.population_estimate} but ` +
            'population_source is missing. A population figure does not enter this system ' +
            'without the assumption that produced it written down next to it.',
        );
      }
    }
  });
}

/**
 * Runout geometry, judged by PostGIS before the transaction opens.
 *
 * WHY POSTGIS AND NOT A CHECK IN JAVASCRIPT
 *
 * Whether a polygon is valid is not a question JavaScript should be
 * answering. A self-intersecting ring, a hole outside its shell, a ring
 * wound the wrong way -- these are decided by GEOS, and writing a second
 * opinion here would be a worse implementation of something the database
 * already does correctly. Same reasoning as the V5 loader.
 *
 * WHY IT IS CHECKED BEFORE THE TRANSACTION RATHER THAN RELIED ON
 *
 * Migration 008 constrains both these tables with ST_IsValid, so an
 * invalid envelope cannot be stored either way. But a constraint
 * violation surfaces as a 500, and a 500 tells Rudra "the server broke"
 * when the truth is "your polygon is not closed". Asking PostGIS first
 * turns that into a 422 that names the prediction and quotes
 * ST_IsValidReason, which points at the actual coordinate.
 *
 * V7 found this hole by accident: before 008, a three-position unclosed
 * ring was accepted, stored with ST_IsValid false, and answered 201. That
 * matters because the envelope is the input to the exposure
 * intersection -- ST_Intersection on an invalid polygon returns empty
 * rather than raising, so the buildings under the slope would have come
 * out as zero and the risk step would have answered LOW on a populated
 * hillside, with nothing in the log.
 */
const VALIDATE_GEOM_SQL = `
  WITH g AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom)
  SELECT ST_IsValid(geom)        AS is_valid,
         ST_IsValidReason(geom)  AS reason,
         ST_NPoints(geom)        AS npoints
  FROM g
`;

async function checkRunoutGeometry(predictions, details) {
  for (const [i, p] of predictions.entries()) {
    if (!p.runout) continue;

    const geojson = JSON.stringify(p.runout.envelope_geojson);
    let row;

    try {
      ({
        rows: [row],
      } = await query(VALIDATE_GEOM_SQL, [geojson]));
    } catch (err) {
      // ST_GeomFromGeoJSON itself refused it -- malformed coordinates, a
      // nesting depth that is not a polygon. Its message is specific and
      // worth passing on verbatim.
      details.push(
        `predictions[${i}] (${p.slope_unit_id}).runout.envelope_geojson: PostGIS could not read ` +
          `this geometry -- ${err.message}`,
      );
      continue;
    }

    // A ring needs 4 positions: three corners plus the first repeated as
    // the last. Named separately because forgetting to repeat the first
    // position is the common mistake when a polygon is built in a loop,
    // and "must have at least 4 positions" says that far more plainly
    // than ST_IsValidReason's output does.
    if (row.npoints < 4) {
      details.push(
        `predictions[${i}] (${p.slope_unit_id}).runout.envelope_geojson: a polygon ring needs at ` +
          `least 4 positions and this has ${row.npoints}. The first position must be repeated as ` +
          'the last to close the ring.',
      );
      continue;
    }

    if (!row.is_valid) {
      details.push(
        `predictions[${i}] (${p.slope_unit_id}).runout.envelope_geojson: not a valid polygon -- ` +
          `${row.reason}. An invalid runout envelope would intersect nothing, so the exposure ` +
          'beneath the slope would come out as zero and the risk would read LOW.',
      );
    }
  }
}

/**
 * Things that are accepted but worth saying out loud in the response.
 *
 * A placeholder citation is the interesting case. It satisfies both the
 * NOT NULL and the btrim(...) <> '' constraint while not being a
 * citation, so the database cannot catch it. Rejecting it would block the
 * shipped mock file, which docs/DEMO_PLAN.md plans to post during the
 * demo. Accepting it silently would let an uncited angle of reach decide
 * how far downhill we warn people.
 *
 * So: accept, and name it. The run is already flagged is_demo_data, and
 * this list tells Rudra exactly what to replace before the presentation.
 */
const PLACEHOLDER = /placeholder|todo|tbd|fixme|xxx|needs citation/i;

function collectWarnings(body) {
  const warnings = [];

  body.predictions.forEach((p, i) => {
    if (p.runout && PLACEHOLDER.test(p.runout.source_citation)) {
      warnings.push(
        `predictions[${i}] (${p.slope_unit_id}): runout.source_citation reads like a placeholder ` +
          `-- "${p.runout.source_citation}". The angle of reach decides who gets warned, so this ` +
          'must be a real literature citation before any presentation.',
      );
    }
    if (p.runout && p.runout.angle_of_reach_deg === undefined) {
      warnings.push(
        `predictions[${i}] (${p.slope_unit_id}): a runout envelope with no angle_of_reach_deg. ` +
          'The envelope is stored but its derivation is not recorded.',
      );
    }

    const ex = p.exposure;
    if (ex && ex.population_source && /mock|placeholder|fake/i.test(ex.population_source)) {
      warnings.push(
        `predictions[${i}] (${p.slope_unit_id}): population_source says "${ex.population_source}". ` +
          'This figure must not be quoted as a measurement.',
      );
    }
    if (ex && ex.population_estimate > 0 && ex.is_estimate === false) {
      warnings.push(
        `predictions[${i}] (${p.slope_unit_id}): exposure.is_estimate is false for a population ` +
          'figure. Stored as an estimate anyway -- a modelled count is never a census.',
      );
    }
  });

  return warnings;
}

// ---------------------------------------------------------------
// The inserts.
// ---------------------------------------------------------------

const INSERT_RUN = `
  INSERT INTO forecast_run (run_ts, input_cutoff_ts, model_version, is_hindcast, is_demo_data)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING id
`;

// risk_level is deliberately absent from this list, so the column stays
// NULL. NULL means "exposure not yet computed" -- V8 fills it in. A
// default of 'LOW' would be a lie that reads as reassurance, and a
// default of 'HIGH' would be a lie that reads as an alarm.
const INSERT_PREDICTION = `
  INSERT INTO prediction (
    forecast_run_id, slope_unit_id, valid_from, valid_to,
    susceptibility_score, probability, confidence_lower, confidence_upper,
    tank_state, rainfall, drivers, counterfactual,
    nearest_gauge_km, rainfall_confidence
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  RETURNING id
`;

const INSERT_RUNOUT = `
  INSERT INTO runout_envelope (prediction_id, geom, method, angle_of_reach_deg, source_citation)
  VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3, $4, $5)
`;

const INSERT_EXPOSURE = `
  INSERT INTO exposure (
    prediction_id, buildings_count, population_estimate, population_source,
    road_metres, road_segments, critical_facilities, is_estimate
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;

const UPDATE_PREDICTION_RISK = `
  UPDATE prediction
  SET risk_level = $1
  WHERE id = $2
`;

export async function registerPredictionRoutes(app) {
  app.post(
    '/api/v1/predictions/ingest',
    {
      schema: {
        tags: ['predictions'],
        summary: "Ingest one forecast run and its predictions",
        description:
          'Takes the model output described in `docs/API_CONTRACT.md` section 3 and stores it ' +
          'in `forecast_run` and `prediction`, with optional `runout_envelope` and `exposure`.\n\n' +
          '**Everything or nothing.** The whole body is one transaction, so a body that is ' +
          'valid for four predictions and wrong on the fifth writes none of them. A half-ingested ' +
          'run would render as a partial forecast rather than a failed one.\n\n' +
          '**Answers 422, not 400**, when the body is well-formed JSON whose meaning is wrong ' +
          '(a probability of 1.5, an unknown `slope_unit_id`, a confidence band that does not ' +
          'contain its own estimate).\n\n' +
          '**`risk_level` is never accepted from the caller** and is left NULL for V8 to compute ' +
          'from probability and exposure. `verification_status` starts at `PENDING_VERIFICATION` ' +
          'and only a named officer can change it.',
        body: ingestBodySchema,
        response: { 201: ingestResponseSchema },
      },
    },
    async (request, reply) => {
      const body = request.body;

      // ---------- validation the schema could not do ----------
      //
      // WHY THIS RUNS BEFORE requireDatabase()
      //
      // These checks need nothing but the body. A probability of 1.5, an
      // inverted confidence band, an input_cutoff_ts after run_ts, a
      // risk_level the model does not get to set -- all of those are wrong
      // whether or not Postgres is reachable, and answering 503 to them
      // would be a worse answer than the true one. It also means Rudra can
      // check the shape of his output against the real endpoint without
      // running Docker.
      //
      // The order matters in the other direction too: refusing early means
      // a malformed body never reaches the database at all.
      const details = [];
      rejectFieldsThatAreNotHisToSet(body.predictions, details);
      checkCrossFieldRules(body, details);
      if (details.length > 0) throw unprocessable(details);

      // Past this line every remaining check needs the database.
      requireDatabase();

      // A slope unit that does not exist would be an orphan prediction --
      // there is a foreign key, but hitting it would surface as a 500.
      // Checking it here means Rudra gets a 422 that names the id, which
      // is usually a typo or a stale slope unit file on his side.
      const requested = [...new Set(body.predictions.map((p) => p.slope_unit_id))];
      const { rows: known } = await query(
        'SELECT id, is_mock FROM slope_unit WHERE id = ANY($1::text[])',
        [requested],
      );

      const knownIds = new Set(known.map((r) => r.id));
      const unknown = requested.filter((id) => !knownIds.has(id));
      if (unknown.length > 0) {
        details.push(
          `Unknown slope_unit_id: ${unknown.join(', ')}. ` +
            'A prediction cannot be stored without the slope unit it describes. ' +
            'Load them first with: npm run load:slope-units',
        );
      }

      // PostGIS judges the runout polygons. Done here, before the
      // transaction opens, so an invalid ring is a 422 naming the
      // coordinate rather than a 500 from migration 008's constraint.
      await checkRunoutGeometry(body.predictions, details);

      if (details.length > 0) throw unprocessable(details);

      // ---------- is_demo_data, derived and not asserted ----------
      // Same rule as V6's envelope: the flag OR the data. A run whose
      // predictions sit on hand-drawn polygons is illustrative whatever
      // DEMO_MODE says, and setting DEMO_MODE=false on the morning of the
      // demo must not turn that off. Rows outvote the flag in one
      // direction only -- real slope units cannot switch the banner off.
      const mockUnits = known.filter((r) => r.is_mock).length;
      const isDemoData = config.demoMode || mockUnits > 0;

      const warnings = collectWarnings(body);

      // ---------- one transaction ----------
      const stored = await withTransaction(async (client) => {
        const { rows: runRows } = await client.query(INSERT_RUN, [
          body.forecast_run.run_ts,
          body.forecast_run.input_cutoff_ts,
          body.forecast_run.model_version,
          body.forecast_run.is_hindcast,
          isDemoData,
        ]);
        const runId = runRows[0].id;

        let runouts = 0;
        let exposures = 0;

        for (const p of body.predictions) {
          const { rows: predRows } = await client.query(INSERT_PREDICTION, [
            runId,
            p.slope_unit_id,
            p.valid_from,
            p.valid_to,
            p.susceptibility_score ?? null,
            p.probability,
            p.confidence_lower,
            p.confidence_upper,
            stripComments(p.tank_state),
            stripComments(p.rainfall),
            stripComments(p.drivers),
            p.counterfactual,
            p.data_quality.nearest_gauge_km,
            p.data_quality.rainfall_confidence,
          ]);
          const predictionId = predRows[0].id;

          if (p.runout) {
            await client.query(INSERT_RUNOUT, [
              predictionId,
              JSON.stringify(p.runout.envelope_geojson),
              p.runout.method,
              p.runout.angle_of_reach_deg ?? null,
              p.runout.source_citation,
            ]);
            runouts += 1;
          }

          if (p.exposure) {
            const ex = p.exposure;
            const segments = stripComments(ex.road_segments ?? []);

            // road_metres derived by SUMMING the segments when it is not
            // given, because a NULL beside a listed road makes the UI
            // print "0 m of road" next to a road it is naming. This is
            // arithmetic on what was sent, not a PostGIS measurement --
            // the exposure step will recompute it in EPSG:32646 later.
            const roadMetres =
              ex.road_metres ??
              (segments.length > 0
                ? segments.reduce((sum, s) => sum + (Number(s.metres) || 0), 0)
                : null);

            await client.query(INSERT_EXPOSURE, [
              predictionId,
              ex.buildings_count ?? null,
              ex.population_estimate ?? null,
              ex.population_source ?? null,
              roadMetres,
              JSON.stringify(segments),
              JSON.stringify(stripComments(ex.critical_facilities ?? [])),
              // Forced true. Every figure here comes out of a model
              // runout envelope, not a survey. is_estimate: false would
              // let a modelled count be presented as a census.
              true,
            ]);
            exposures += 1;
          }

          // Step V8: Calculate risk level from probability x exposure
          // and update prediction.risk_level in the database.
          const riskLevel = calculateRiskLevel(p.probability, p.exposure);
          await client.query(UPDATE_PREDICTION_RISK, [riskLevel, predictionId]);
        }

        return { runId, runouts, exposures };
      });

      reply.code(201);

      return {
        forecast_run_id: Number(stored.runId),
        predictions_stored: body.predictions.length,
        runouts_stored: stored.runouts,
        exposures_stored: stored.exposures,
        is_demo_data: isDemoData,
        mock_slope_units: mockUnits,

        // Stored with risk_level computed from probability and exposure
        risk_level: null,
        note:
          'Stored with risk_level computed from probability and exposure, and verification_status PENDING_VERIFICATION. ' +
          'Verification requires a named officer.',
        warnings,
      };
    },
  );
}
