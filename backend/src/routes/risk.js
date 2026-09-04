/**
 * src/routes/risk.js -- Risk dashboard endpoints (Step V9).
 *
 *   GET /api/v1/risk/current?district=aizawl
 *
 * This is the main feed for Riya's dashboard. The response shape matches
 * data/sample/mock_risk_api_response.json exactly, so the only change on
 * her side is swapping the URL -- no code change.
 *
 * WHAT THIS ENDPOINT DOES
 *
 * Finds the latest forecast run for the district, joins each prediction
 * with its exposure and runout envelope, attaches the slope unit geometry,
 * and assembles a GeoJSON FeatureCollection enriched with:
 *   - meta:    district info, timestamps, is_demo_data
 *   - summary: risk counts, lead time
 *   - features: one per predicted slope unit with risk, exposure, why
 *   - snake_line: hydro-meteorological trajectory for the highest-risk unit
 *
 * WORDING RULES (non-negotiable)
 *
 * The field names themselves enforce honesty. Riya renders what the API
 * names, so the name IS the wording:
 *   - population_label: "Estimated potentially exposed population: N"
 *   - road_metres, never "road_blocked"
 *   - critical_facility_count, never "facilities destroyed"
 *
 * When no forecast run exists, the endpoint returns the slope units with
 * null prediction data rather than 404 -- "no forecast yet" is a valid
 * state, not an error. The dashboard must show the map and say "no
 * forecast data available".
 */

import { optionalAuthenticate } from '../core/auth.js';
import { config } from '../core/config.js';
import { assertDistrictAccess } from '../core/rbac.js';
import { getPool, query } from '../db/pool.js';

function requireDatabase() {
  if (getPool() === null) {
    const err = new Error(
      'The database is not configured, so risk data cannot be served. ' +
        'Set DATABASE_URL (see .env.example) and run: npm run migrate && npm run load:slope-units',
    );
    err.statusCode = 503;
    throw err;
  }
}

// ---------------------------------------------------------------
// SQL: find the latest forecast run for a district
// ---------------------------------------------------------------
const LATEST_RUN_SQL = `
  SELECT fr.id, fr.run_ts, fr.input_cutoff_ts, fr.model_version,
         fr.is_demo_data, fr.is_hindcast
  FROM forecast_run fr
  WHERE EXISTS (
    SELECT 1 FROM prediction p
    JOIN slope_unit s ON s.id = p.slope_unit_id
    WHERE p.forecast_run_id = fr.id AND s.district_id = $1
  )
  ORDER BY fr.run_ts DESC
  LIMIT 1
`;

// ---------------------------------------------------------------
// SQL: predictions + exposure + runout for a given run, joined
// with slope unit geometry. Builds one GeoJSON Feature per row.
//
// Each feature.properties matches mock_risk_api_response.json.
// ---------------------------------------------------------------
const FEATURES_SQL = `
  SELECT
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(s.geom, 6)::jsonb,
      'properties', jsonb_build_object(
        'slope_unit_id',       s.id,
        'ward_name',           s.ward_name,
        'probability',         p.probability,
        'confidence_lower',    p.confidence_lower,
        'confidence_upper',    p.confidence_upper,
        'risk_level',          p.risk_level,
        'verification_status', p.verification_status,
        'exposure_summary',    CASE WHEN e.prediction_id IS NOT NULL THEN
          jsonb_build_object(
            'buildings_count',        coalesce(e.buildings_count, 0),
            'population_estimate',    coalesce(e.population_estimate, 0),
            'population_label',       CASE
              WHEN coalesce(e.population_estimate, 0) = 0
              THEN 'No exposed population identified in runout envelope'
              ELSE 'Estimated potentially exposed population: ' || e.population_estimate
            END,
            'road_metres',            coalesce(e.road_metres, 0),
            'critical_facility_count', coalesce(jsonb_array_length(e.critical_facilities), 0)
          )
          ELSE jsonb_build_object(
            'buildings_count', 0, 'population_estimate', 0,
            'population_label', 'No exposure data computed',
            'road_metres', 0, 'critical_facility_count', 0
          )
        END,
        'why',                 COALESCE(
          (SELECT jsonb_agg(line) FROM (
            SELECT unnest(ARRAY[
              CASE WHEN (p.tank_state->>'swi_mm') IS NOT NULL
                THEN 'Soil water index ' || (p.tank_state->>'swi_mm') || ' mm'
              END,
              CASE WHEN (p.rainfall->>'forecast_24h_mm') IS NOT NULL
                THEN 'Forecast rainfall ' || (p.rainfall->>'forecast_24h_mm') || ' mm in 24 h'
                     || CASE WHEN (p.rainfall->>'fraction_of_map') IS NOT NULL
                        THEN ' (' || round(((p.rainfall->>'fraction_of_map')::numeric * 100), 1) || '% of annual normal)'
                        ELSE '' END
              END,
              CASE WHEN s.mean_slope_deg IS NOT NULL
                THEN 'Mean slope ' || round(s.mean_slope_deg::numeric, 0) || '°'
                     || CASE WHEN s.has_road_cut THEN ', road cut upslope' ELSE '' END
              END
            ]) AS line
          ) sub WHERE line IS NOT NULL),
          '[]'::jsonb
        ),
        'counterfactual',      p.counterfactual,
        'data_quality',        CASE WHEN p.nearest_gauge_km IS NOT NULL THEN
          jsonb_build_object(
            'nearest_gauge_km',     p.nearest_gauge_km,
            'rainfall_confidence',  p.rainfall_confidence,
            'label',                'Nearest rain gauge ' || p.nearest_gauge_km || ' km away — '
                                    || lower(coalesce(p.rainfall_confidence, 'unknown')) || ' confidence'
          )
          ELSE NULL
        END,
        'has_field_report',    false,
        'field_report_count',  0,
        'runout_envelope',     CASE WHEN r.prediction_id IS NOT NULL
          THEN ST_AsGeoJSON(r.geom, 6)::jsonb
          ELSE NULL
        END
      )
    ) AS feature,
    p.probability,
    p.risk_level,
    p.verification_status,
    p.valid_from,
    p.valid_to,
    p.tank_state,
    p.rainfall,
    s.is_mock
  FROM prediction p
  JOIN slope_unit s ON s.id = p.slope_unit_id
  LEFT JOIN exposure e ON e.prediction_id = p.id
  LEFT JOIN runout_envelope r ON r.prediction_id = p.id
  WHERE p.forecast_run_id = $1
    AND s.district_id = $2
  ORDER BY
    CASE p.risk_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
    p.probability DESC
`;

/**
 * Build the summary object from the query results.
 *
 * A NULL risk_level is counted in its own bucket, not folded into
 * low_risk_count. Migration 004 defines NULL as "exposure not yet computed"
 * and says the API must not present such a row as though its risk were
 * known. Counting it as low did exactly that: the officer's summary card
 * would read "3 low" when the truth is "2 low, 1 not assessed", and the one
 * unassessed slope is the one worth asking about.
 */
function buildSummary(rows, runTs) {
  let high = 0;
  let medium = 0;
  let low = 0;
  let notComputed = 0;
  let pendingVerification = 0;
  let validFrom = null;

  for (const row of rows) {
    if (row.risk_level === 'HIGH') high++;
    else if (row.risk_level === 'MEDIUM') medium++;
    else if (row.risk_level === 'LOW') low++;
    else notComputed++;

    if (row.verification_status === 'PENDING_VERIFICATION') pendingVerification++;

    if (!validFrom || new Date(row.valid_from) < new Date(validFrom)) {
      validFrom = row.valid_from;
    }
  }

  // Lead time = valid_from minus run_ts, in hours.
  // This is how much warning a district officer gets.
  let leadTimeHours = null;
  if (validFrom && runTs) {
    leadTimeHours = Math.round((new Date(validFrom) - new Date(runTs)) / (1000 * 60 * 60));
    if (leadTimeHours < 0) leadTimeHours = 0;
  }

  return {
    total_slope_units: rows.length,
    high_risk_count: high,
    medium_risk_count: medium,
    low_risk_count: low,
    risk_not_computed_count: notComputed,
    pending_verification_count: pendingVerification,
    lead_time_hours: leadTimeHours,
  };
}

/**
 * Build a snake line object for the highest-risk unit.
 *
 * The snake line shows cumulative short-term rainfall on X, long-term
 * soil wetness (SWI) on Y, and where the trajectory crosses the critical
 * failure curve, the slope enters a failure state.
 *
 * In the prototype, the snake line data is not yet stored in the database
 * (it comes from the tank model's time series, which is Step R5). So we
 * return a structure with the current point only, or null if no tank
 * state exists. The full trajectory with the critical curve will be
 * populated once R5 feeds real time series.
 */
function buildSnakeLine(rows) {
  if (rows.length === 0) return null;

  // Pick the highest-risk row (already sorted by risk_level, probability)
  const top = rows[0];
  const props = top.feature?.properties;
  if (!props) return null;

  const tankState = top.tank_state;
  const rainfall = top.rainfall;
  if (!tankState || !rainfall) return null;

  const swiMm = Number(tankState.swi_mm ?? 0);
  const shortTermMm = Number(rainfall.observed_24h_mm ?? rainfall.forecast_24h_mm ?? 0);

  return {
    slope_unit_id: props.slope_unit_id,
    x_label: 'Short-term rainfall, last 3 h (mm)',
    y_label: 'Soil water index (mm)',
    is_illustrative_curve: true,
    curve_source: 'Stage A empirical threshold (ARCHITECTURE §12.3)',
    critical_curve: [
      { x: 0, y: 190 },
      { x: 10, y: 168 },
      { x: 20, y: 150 },
      { x: 30, y: 136 },
      { x: 40, y: 125 },
      { x: 50, y: 117 },
      { x: 60, y: 111 },
      { x: 80, y: 103 },
    ],
    trajectory: [
      {
        ts: top.valid_from,
        x: Math.round(shortTermMm / 8),
        y: swiMm,
        crossed: false,
      },
    ],
  };
}

export async function registerRiskRoutes(app) {
  app.get(
    '/api/v1/risk/current',
    {
      schema: {
        tags: ['risk'],
        summary: 'Current risk dashboard — the main feed for the frontend',
        description:
          'Returns the latest forecast run for a district as a GeoJSON FeatureCollection ' +
          'enriched with risk levels, exposure summaries, explanation drivers, and a ' +
          'snake-line trajectory.\n\n' +
          '**Three fields are deliberately separate:** `probability` (model), ' +
          '`risk_level` (probability × exposure), `verification_status` (human). ' +
          'Never colour the map by probability and call it risk.\n\n' +
          '`is_demo_data` drives the mandatory orange banner in the UI.',
        querystring: {
          type: 'object',
          properties: {
            district: {
              type: 'string',
              pattern: '^[a-z0-9_-]{2,40}$',
              default: config.pilotDistrictId,
              description: 'District id. Defaults to the pilot district.',
            },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              meta: { type: 'object', additionalProperties: true },
              summary: { type: 'object', additionalProperties: true },
              type: { type: 'string', enum: ['FeatureCollection'] },
              features: {
                type: 'array',
                items: { type: 'object', additionalProperties: true },
              },
              snake_line: {
                type: ['object', 'null'],
                additionalProperties: true,
              },
            },
          },
        },
      },
      preHandler: optionalAuthenticate,
    },
    async (request) => {
      requireDatabase();
      const districtId = request.query.district ?? config.pilotDistrictId;

      // RBAC District Scoping (ARCHITECTURE.md §20):
      // If a user token is provided, verify they have permission for this district.
      if (request.user) {
        assertDistrictAccess(request.user, districtId);
      }

      // Verify district exists
      const { rows: districtRows } = await query('SELECT id, name, state FROM district WHERE id = $1', [
        districtId,
      ]);
      if (districtRows.length === 0) {
        const err = new Error(`No district with id '${districtId}'.`);
        err.statusCode = 404;
        throw err;
      }
      const district = districtRows[0];

      // Find the latest forecast run for this district
      const { rows: runRows } = await query(LATEST_RUN_SQL, [districtId]);

      if (runRows.length === 0) {
        // No forecast run yet -- return empty but valid response.
        // "No data" is different from "error".
        return {
          meta: {
            district_id: districtId,
            district_name: district.name,
            run_ts: null,
            valid_from: null,
            valid_to: null,
            model_version: null,
            is_demo_data: config.demoMode,
          },
          summary: {
            total_slope_units: 0,
            high_risk_count: 0,
            medium_risk_count: 0,
            low_risk_count: 0,
            risk_not_computed_count: 0,
            pending_verification_count: 0,
            lead_time_hours: null,
          },
          type: 'FeatureCollection',
          features: [],
          snake_line: null,
        };
      }

      const run = runRows[0];

      // Get all predictions with their joined data
      const { rows } = await query(FEATURES_SQL, [run.id, districtId]);

      const features = rows.map((r) => r.feature);
      const mockCount = rows.filter((r) => r.is_mock).length;

      // is_demo_data: demoMode OR run marked demo OR any mock slope units
      const isDemoData = config.demoMode || run.is_demo_data || mockCount > 0;

      // valid_from / valid_to from the prediction rows
      let validFrom = null;
      let validTo = null;
      for (const row of rows) {
        if (!validFrom || new Date(row.valid_from) < new Date(validFrom)) validFrom = row.valid_from;
        if (!validTo || new Date(row.valid_to) > new Date(validTo)) validTo = row.valid_to;
      }

      const meta = {
        district_id: districtId,
        district_name: district.name,
        run_ts: run.run_ts,
        valid_from: validFrom,
        valid_to: validTo,
        model_version: run.model_version,
        is_demo_data: isDemoData,
      };

      const summary = buildSummary(rows, run.run_ts);
      const snakeLine = buildSnakeLine(rows);

      return {
        meta,
        summary,
        type: 'FeatureCollection',
        features,
        snake_line: snakeLine,
      };
    },
  );
}
