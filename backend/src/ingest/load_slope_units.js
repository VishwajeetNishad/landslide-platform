/**
 * src/ingest/load_slope_units.js -- loads a GeoJSON FeatureCollection of
 * slope units into the slope_unit table.
 *
 * Run it with:  npm run load:slope-units
 *               npm run load:slope-units -- ../data/sample/some_other.geojson
 *
 * WHY A LOADER AND NOT A SEED MIGRATION
 *
 * Migration 002 seeds the district row, because 'aizawl' / 'Aizawl' /
 * 'Mizoram' is a fact about the world that will never change. Slope units
 * are the opposite: today's file is hand-drawn mock geometry, and Rudra's R3
 * step will replace it with real WhiteboxTools output derived from a DEM.
 * Data that is expected to be replaced does not belong in the schema
 * history -- a migration cannot be re-run, so we would have no way to load
 * the real file when it arrives without inventing a migration 007 whose only
 * job is to undo 006's data.
 *
 * WHAT THIS LOADER GUARANTEES
 *
 *   1. Provenance comes from the FILE, never from this code. `source` and
 *      `is_mock` are read out of the GeoJSON's own _provenance block. If a
 *      file does not state where it came from, the loader refuses it rather
 *      than guessing -- see the note on isMock below, which is the single
 *      most important line in this file.
 *   2. All or none. One transaction, so a file that goes wrong at feature 4
 *      of 5 leaves the table exactly as it was. A partly loaded set of slope
 *      units would put polygons on the map with no predictions behind them.
 *   3. Geometry-derived quantities are measured, not copied. area_ha and
 *      centroid come from the polygon itself, so they cannot contradict the
 *      shape stored beside them. See DERIVED_AREA_SQL -- the mock file's
 *      own area figures were out by up to 224%.
 *   4. The database validates, not this script. Coordinates go to Postgres
 *      as GeoJSON via ST_GeomFromGeoJSON and the column type refuses
 *      anything that is not POLYGON in SRID 4326. Re-checking that here
 *      would be a second, weaker copy of a rule that already exists.
 *   5. Re-runnable. ON CONFLICT (id) DO UPDATE, so loading the same file
 *      twice is a no-op rather than a primary key error, and loading a
 *      corrected file updates the rows in place.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closePool, getPool, withTransaction } from '../db/pool.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.resolve(HERE, '../../../data/sample/mock_slope_units.geojson');

// The attribute columns we copy straight across from GeoJSON properties.
// Listed explicitly rather than looped over Object.keys(properties): a typo
// or an extra field in the file should be ignored, not turned into a column
// name in a generated INSERT.
// NOTE: area_ha is deliberately NOT in this list. It is derived from the
// geometry in SQL below, for the reason explained at DERIVED_AREA_SQL.
const ATTRIBUTES = [
  'ward_name',
  'mean_slope_deg',
  'max_slope_deg',
  'aspect_sin',
  'aspect_cos',
  'relief_m',
  'profile_curvature',
  'twi',
  'lithology_class',
  'landcover_class',
  'geological_province',
  'dist_to_road_m',
  'has_road_cut',
  'mean_annual_precip_mm',
  'susceptibility_score',
  'seismic_weakening',
];

/**
 * Pull `source` and `is_mock` out of the file itself.
 *
 * THE IMPORTANT PART: is_mock must be stated, not defaulted.
 *
 * The tempting shortcut is `is_mock: true` hardcoded here, since today's
 * file is mock. That breaks the day the real DEM-derived file arrives:
 * whoever loads it gets real slope units flagged as mock, sees the demo
 * banner, and "fixes" it by flipping the constant -- at which point mock
 * files load as real too. Defaulting the other way is worse, because then a
 * file with no provenance silently becomes real data.
 *
 * So there is no default. A file must say what it is.
 *
 * Exported so the tests can check the refusals without a database. These
 * are the rules most worth testing and the ones a database cannot enforce
 * for us, since by the time a row reaches Postgres the provenance decision
 * has already been made.
 */
export function readProvenance(fc, filePath) {
  const p = fc._provenance;

  if (!p || typeof p !== 'object') {
    throw new Error(
      `${path.basename(filePath)} has no "_provenance" block.\n` +
        'Every slope unit file must state where its geometry came from. Add:\n' +
        '  "_provenance": { "source": "<where this came from>", "is_mock": true|false }',
    );
  }

  if (typeof p.source !== 'string' || p.source.trim() === '') {
    throw new Error(`${path.basename(filePath)}: _provenance.source must be a non-empty string.`);
  }

  // Strictly boolean. The string "false" is truthy in JavaScript, and that
  // is exactly the sort of mistake that would mark mock data as real.
  if (typeof p.is_mock !== 'boolean') {
    throw new Error(
      `${path.basename(filePath)}: _provenance.is_mock must be true or false (a boolean, not a string).`,
    );
  }

  return { source: p.source.trim(), isMock: p.is_mock };
}

export function parseFeatureCollection(text, filePath) {
  let fc;
  try {
    fc = JSON.parse(text);
  } catch (err) {
    throw new Error(`${path.basename(filePath)} is not valid JSON: ${err.message}`);
  }

  if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new Error(`${path.basename(filePath)} is not a GeoJSON FeatureCollection.`);
  }
  if (fc.features.length === 0) {
    throw new Error(`${path.basename(filePath)} contains no features.`);
  }

  return fc;
}

/**
 * Turn one GeoJSON feature into the values for one row.
 *
 * Only three things are checked here, and all three are things the database
 * genuinely cannot check for us: that an id exists at all (a missing id
 * would otherwise become the confusing error "null value in column id"),
 * that a geometry exists, and that district_id is present so the foreign
 * key gets something to complain about by name. Ranges, SRID, geometry
 * type and the not-blank rules are all left to the constraints in
 * migration 003, which apply to every write from every code path.
 */
export function toRow(feature, index, filePath) {
  const where = `${path.basename(filePath)} feature ${index}`;
  const props = feature.properties ?? {};

  if (typeof props.id !== 'string' || props.id.trim() === '') {
    throw new Error(`${where}: properties.id is missing or empty.`);
  }
  if (typeof props.district_id !== 'string' || props.district_id.trim() === '') {
    throw new Error(`${where} (${props.id}): properties.district_id is missing.`);
  }
  if (!feature.geometry) {
    throw new Error(`${where} (${props.id}): geometry is missing.`);
  }

  return {
    id: props.id.trim(),
    districtId: props.district_id.trim(),
    // Passed to Postgres as a JSON string. ST_GeomFromGeoJSON parses it,
    // which means PostGIS decides what is a valid polygon -- not us.
    geometryJson: JSON.stringify(feature.geometry),
    attributes: ATTRIBUTES.map((name) => props[name] ?? null),
    // Kept only so the loader can report where the file's own figure
    // disagrees with its geometry. Never written to the database.
    statedAreaHa: typeof props.area_ha === 'number' ? props.area_ha : null,
  };
}

// The polygon, in the form the column requires.
//
// ST_SetSRID because GeoJSON carries no SRID of its own. RFC 7946 fixes
// GeoJSON coordinates as WGS 84 lon/lat, which IS 4326, but PostGIS returns
// SRID 0 from ST_GeomFromGeoJSON and the column would reject it. Stating
// 4326 explicitly is the honest form of that fact.
const GEOM_SQL = 'ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)';

/**
 * area_ha is MEASURED FROM THE GEOMETRY, not copied from the file.
 *
 * This was not the original plan. The loader first copied properties.area_ha
 * across, and the first thing I did after loading was compare the stated
 * figure against the polygon: every one of the five was out by 135-224%.
 * AZ-1147 says 5.1 ha and its polygon is 16.5 ha. The properties in a
 * hand-drawn mock file were written independently of the coordinates, so
 * they simply do not describe the same shapes.
 *
 * Storing the file's number would put a quantity in the database that
 * contradicts the geometry sitting next to it in the same row -- and area
 * feeds exposure, which feeds risk. Measuring it means the number is always
 * true of the polygon we actually hold, for mock and real data alike.
 *
 * ST_Transform to EPSG:32646 (UTM 46N, correct for Mizoram) first, because
 * ST_Area in 4326 returns square DEGREES, which is not an area of anything.
 * / 10000 converts m2 to hectares.
 */
const DERIVED_AREA_SQL = `ST_Area(ST_Transform(${GEOM_SQL}, 32646)) / 10000.0`;

// $1..$3 are id, district and the GeoJSON string; the attributes follow
// from $4, then the two provenance values.
const ATTRIBUTE_PLACEHOLDERS = ATTRIBUTES.map((_, i) => `$${i + 4}`).join(', ');
const PROVENANCE_PLACEHOLDERS = `$${ATTRIBUTES.length + 4}, $${ATTRIBUTES.length + 5}`;

const INSERT_SQL = `
  INSERT INTO slope_unit (
    id, district_id, geom, centroid, area_ha,
    ${ATTRIBUTES.join(', ')},
    source, is_mock
  )
  VALUES (
    $1, $2,
    ${GEOM_SQL},
    -- Centroid is DERIVED too, never read from the file. If the file
    -- carried its own centroid it could disagree with its own polygon, and
    -- then the map pin and the map shape would point at different
    -- hillsides.
    ST_Centroid(${GEOM_SQL}),
    ${DERIVED_AREA_SQL},
    ${ATTRIBUTE_PLACEHOLDERS},
    ${PROVENANCE_PLACEHOLDERS}
  )
  ON CONFLICT (id) DO UPDATE SET
    district_id = EXCLUDED.district_id,
    geom        = EXCLUDED.geom,
    centroid    = EXCLUDED.centroid,
    area_ha     = EXCLUDED.area_ha,
    ${ATTRIBUTES.map((name) => `${name} = EXCLUDED.${name}`).join(',\n    ')},
    source      = EXCLUDED.source,
    is_mock     = EXCLUDED.is_mock
  RETURNING id, (xmax = 0) AS inserted, area_ha
`;

/**
 * Load one file. Exported so a test can call it directly.
 * Returns { inserted, updated, source, isMock }.
 */
export async function loadSlopeUnits(filePath) {
  const text = await readFile(filePath, 'utf8');
  const fc = parseFeatureCollection(text, filePath);
  const { source, isMock } = readProvenance(fc, filePath);

  // Parse every feature BEFORE opening the transaction. A file with a typo
  // in feature 5 should be rejected without touching the database at all.
  const rows = fc.features.map((f, i) => toRow(f, i, filePath));

  const ids = new Set();
  for (const row of rows) {
    if (ids.has(row.id)) {
      // ON CONFLICT DO UPDATE cannot handle the same id twice in one
      // statement, and beyond that a duplicated id means the file is wrong.
      throw new Error(`${path.basename(filePath)}: duplicate slope unit id ${row.id}.`);
    }
    ids.add(row.id);
  }

  return withTransaction(async (client) => {
    let inserted = 0;
    let updated = 0;
    const areaDisagreements = [];

    for (const row of rows) {
      let result;
      try {
        result = await client.query(INSERT_SQL, [
          row.id,
          row.districtId,
          row.geometryJson,
          ...row.attributes,
          source,
          isMock,
        ]);
      } catch (err) {
        // Name the row. Postgres reports the constraint, not which of five
        // features tripped it, and "slope_unit_slope_range violated" alone
        // sends you reading the whole file.
        throw new Error(`slope unit ${row.id} was rejected: ${err.message}`);
      }

      const returned = result.rows[0];

      // xmax = 0 on the returned row means this was an INSERT rather than
      // the UPDATE branch of ON CONFLICT -- the standard way to tell the
      // two apart, since RETURNING looks identical otherwise.
      if (returned.inserted) inserted += 1;
      else updated += 1;

      // Report, don't fix and don't fail. The measured value is what gets
      // stored either way; a loud disagreement tells Rudra his file's
      // attributes and its coordinates were written independently, which is
      // worth knowing before those attributes feed a model. 5% absorbs
      // ordinary rounding.
      if (row.statedAreaHa !== null && row.statedAreaHa > 0) {
        const measured = Number(returned.area_ha);
        const pct = (100 * (measured - row.statedAreaHa)) / row.statedAreaHa;
        if (Math.abs(pct) > 5) {
          areaDisagreements.push({
            id: row.id,
            stated: row.statedAreaHa,
            measured: Number(measured.toFixed(2)),
            pct: Math.round(pct),
          });
        }
      }
    }

    return { inserted, updated, source, isMock, areaDisagreements };
  });
}

async function main() {
  const arg = process.argv[2];
  const filePath = arg ? path.resolve(process.cwd(), arg) : DEFAULT_FILE;

  if (getPool() === null) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
    process.exitCode = 1;
    return;
  }

  const { inserted, updated, source, isMock, areaDisagreements } = await loadSlopeUnits(filePath);

  console.log(`Loaded ${path.relative(process.cwd(), filePath)}`);
  console.log(`  ${inserted} inserted, ${updated} updated`);
  console.log(`  source:  ${source}`);

  if (areaDisagreements.length > 0) {
    console.warn(
      `\n  NOTE: ${areaDisagreements.length} feature(s) state an area_ha that its own polygon does not support.\n` +
        '  The MEASURED value was stored. The file\'s figure was not used.',
    );
    for (const d of areaDisagreements) {
      const sign = d.pct > 0 ? '+' : '';
      console.warn(`    ${d.id}: file says ${d.stated} ha, polygon measures ${d.measured} ha (${sign}${d.pct}%)`);
    }
    console.warn('');
  }

  // Printed loudly, and last, because it is the line that decides whether
  // anything downstream may be quoted as a measurement.
  if (isMock) {
    console.log('  is_mock: TRUE -- these are illustrative polygons, not real slope units.');
  } else {
    console.log('  is_mock: false -- loaded as real data.');
  }
}

// Only run when this file is the program, not when a test imports it for
// the pure functions above. Without this guard, `npm test` would try to
// load slope units into whatever database happened to be configured.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (err) {
    console.error(`\nLOAD FAILED\n${err.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
