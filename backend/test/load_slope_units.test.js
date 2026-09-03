/**
 * test/load_slope_units.test.js -- the loader's provenance rules.
 *
 * WHY THESE PARTICULAR RULES ARE TESTED HERE
 *
 * Everything about geometry, ranges and SRID is enforced by the constraints
 * in migrations 003 and 007, and is verified against a real database by
 * src/db/schema_constraints_test.sql. Re-asserting those here would be a
 * second, weaker copy.
 *
 * What CANNOT be pushed down to the database is provenance. By the time a
 * row reaches Postgres, `source` and `is_mock` are already decided -- the
 * column can only insist they are present, not that they are true. The
 * decision is made in readProvenance(), so that is what these tests guard.
 *
 * These run with no database and no network, so they run on Rudra's and
 * Riya's machines whether or not Docker is up.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readProvenance, parseFeatureCollection, toRow } from '../src/ingest/load_slope_units.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOCK_FILE = path.resolve(HERE, '../../data/sample/mock_slope_units.geojson');

const FILE = 'test.geojson';

describe('slope unit loader -- provenance', () => {
  test('a file with no _provenance block is refused', () => {
    assert.throws(() => readProvenance({}, FILE), /_provenance/);
  });

  // The one that matters most. `is_mock: "false"` is a truthy string in
  // JavaScript, so a loose check would read it as "this is mock data" while
  // the file author meant the opposite -- or, with a `Boolean()` cast,
  // silently mark mock polygons as real.
  test('is_mock given as the STRING "false" is refused, not coerced', () => {
    assert.throws(
      () => readProvenance({ _provenance: { source: 'somewhere', is_mock: 'false' } }, FILE),
      /boolean, not a string/,
    );
  });

  test('is_mock given as the string "true" is refused too', () => {
    assert.throws(
      () => readProvenance({ _provenance: { source: 'somewhere', is_mock: 'true' } }, FILE),
      /boolean, not a string/,
    );
  });

  // No default in either direction. Defaulting to true mislabels the real
  // DEM output when it arrives; defaulting to false turns an unattributed
  // file into real data.
  test('a missing is_mock is refused rather than defaulted', () => {
    assert.throws(() => readProvenance({ _provenance: { source: 'somewhere' } }, FILE), /is_mock/);
  });

  test('a blank source is refused (NOT NULL alone would accept it)', () => {
    assert.throws(
      () => readProvenance({ _provenance: { source: '   ', is_mock: true } }, FILE),
      /non-empty string/,
    );
  });

  test('both booleans are accepted and returned as given', () => {
    assert.deepEqual(readProvenance({ _provenance: { source: ' MOCK ', is_mock: true } }, FILE), {
      source: 'MOCK',
      isMock: true,
    });
    assert.deepEqual(readProvenance({ _provenance: { source: 'CartoDEM v3 R1', is_mock: false } }, FILE), {
      source: 'CartoDEM v3 R1',
      isMock: false,
    });
  });
});

describe('slope unit loader -- file shape', () => {
  test('invalid JSON is reported as invalid JSON', () => {
    assert.throws(() => parseFeatureCollection('{ not json', FILE), /not valid JSON/);
  });

  test('a bare Feature is not a FeatureCollection', () => {
    assert.throws(() => parseFeatureCollection('{"type":"Feature"}', FILE), /FeatureCollection/);
  });

  test('an empty FeatureCollection is refused', () => {
    assert.throws(
      () => parseFeatureCollection('{"type":"FeatureCollection","features":[]}', FILE),
      /no features/,
    );
  });
});

describe('slope unit loader -- per feature', () => {
  const good = {
    type: 'Feature',
    properties: { id: 'AZ-1', district_id: 'aizawl' },
    geometry: { type: 'Polygon', coordinates: [[[92.7, 23.7], [92.8, 23.7], [92.8, 23.8], [92.7, 23.7]]] },
  };

  test('a missing id names the feature index, not a null column', () => {
    assert.throws(() => toRow({ ...good, properties: { district_id: 'aizawl' } }, 3, FILE), /feature 3/);
  });

  test('a missing district_id is refused', () => {
    assert.throws(() => toRow({ ...good, properties: { id: 'AZ-1' } }, 0, FILE), /district_id/);
  });

  test('a missing geometry is refused', () => {
    assert.throws(() => toRow({ ...good, geometry: undefined }, 0, FILE), /geometry is missing/);
  });

  // The loader deliberately does NOT validate the geometry itself -- it
  // hands the GeoJSON to PostGIS, which is the only thing that really knows
  // what a valid polygon is. So a LineString passes through here and is
  // refused by the column type instead.
  test('geometry is passed through untouched for PostGIS to judge', () => {
    const row = toRow({ ...good, geometry: { type: 'LineString', coordinates: [] } }, 0, FILE);
    assert.equal(JSON.parse(row.geometryJson).type, 'LineString');
  });

  test('the file\'s own area_ha is kept aside for reporting, not for storing', () => {
    const row = toRow({ ...good, properties: { ...good.properties, area_ha: 8.4 } }, 0, FILE);
    assert.equal(row.statedAreaHa, 8.4);
    assert.ok(!('area_ha' in row), 'area_ha must not be among the values written to the database');
  });
});

describe('the shipped mock file', () => {
  test('declares itself mock, so it can never load as real data', async () => {
    const fc = parseFeatureCollection(await readFile(MOCK_FILE, 'utf8'), MOCK_FILE);
    const { source, isMock } = readProvenance(fc, MOCK_FILE);

    assert.equal(isMock, true, 'the shipped sample file must be flagged as mock');
    assert.match(source, /MOCK/, 'its source must say so in words too, for anyone reading a row');
  });

  test('every feature parses, so the demo load cannot fail on a typo', async () => {
    const fc = parseFeatureCollection(await readFile(MOCK_FILE, 'utf8'), MOCK_FILE);
    const rows = fc.features.map((f, i) => toRow(f, i, MOCK_FILE));

    assert.equal(rows.length, 5);
    assert.equal(new Set(rows.map((r) => r.id)).size, 5, 'ids must be unique');
    for (const row of rows) assert.equal(row.districtId, 'aizawl');
  });
});
