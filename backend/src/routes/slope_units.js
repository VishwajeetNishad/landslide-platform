/**
 * src/routes/slope_units.js -- the slope unit registry.
 *
 *   GET /api/v1/slope-units?district=aizawl   -> GeoJSON FeatureCollection
 *   GET /api/v1/slope-units/:id               -> one Feature
 *
 * This is the first endpoint that serves real rows out of PostGIS, and it is
 * checkpoint I1: the first thing Riya can draw on a map.
 *
 * WHY THE GEOJSON IS BUILT IN SQL AND NOT IN JAVASCRIPT
 *
 * ST_AsGeoJSON is PostGIS's own serialiser. Assembling the coordinates here
 * instead would mean writing a second implementation of a format PostGIS
 * already emits correctly -- and the failure mode is quiet: a hand-built
 * polygon with its rings wound the wrong way, or lat/lon swapped, still
 * parses as valid GeoJSON and simply draws in the wrong place. Letting the
 * database do it means what the map shows is what the database holds.
 *
 * Note the axis order, since it is the classic bug in this area. GeoJSON is
 * [longitude, latitude]; almost every human-facing tool says "lat, lon".
 * ST_AsGeoJSON emits lon/lat because that is what RFC 7946 requires, so we
 * pass its output through untouched and never reorder anything.
 *
 * WHY PROVENANCE IS IN EVERY SINGLE FEATURE
 *
 * `source` and `is_mock` are returned per feature, not once in the envelope.
 * A response that mixes real and mock units -- which will happen the day
 * Rudra's real file lands while some hand-drawn units are still loaded --
 * cannot be described honestly by one flag. The envelope also carries a
 * count, so the UI can show the banner without inspecting every feature.
 */

import { config } from '../core/config.js';
import { getPool, query } from '../db/pool.js';

/**
 * With no DATABASE_URL, this endpoint has nothing to serve.
 *
 * 503 and not 500. 500 says "this endpoint is broken"; 503 says "the service
 * is not currently able to answer", which is the truth and is also what
 * /health already reports as `not_configured`. The two must agree -- a
 * /health saying `not_configured` beside a 500 here would send whoever is
 * debugging it looking for a bug in the SQL.
 */
function requireDatabase() {
  if (getPool() === null) {
    const err = new Error(
      'The database is not configured, so slope units cannot be served. ' +
        'Set DATABASE_URL (see .env.example) and run: npm run migrate && npm run load:slope-units',
    );
    err.statusCode = 503;
    throw err;
  }
}

// ---------------------------------------------------------------
// What goes into a feature's `properties`: the JSON key on the left, the SQL
// on the right.
//
// Listed explicitly rather than SELECT *, so that adding a column to the
// table -- an internal note, a scratch score -- does not silently publish it
// through the API. `geom` in particular must never appear here: it goes out
// only through ST_AsGeoJSON as the feature's `geometry`.
//
// Most entries are a plain column. Two are not:
//
//   slope_unit_id -- named for the client, not for the table. `id` inside
//     properties reads as "the id of this properties object"; the GeoJSON
//     Feature already has its own `id` member. docs/API_CONTRACT.md's mock
//     response calls it slope_unit_id, so this matches the contract Riya is
//     building against.
//
//   area_ha -- rounded. V5 derives it with ST_Area, which gives
//     58.12302952152139 for AZ-0964. Fourteen significant digits on a
//     hand-drawn polygon claims precision to a fraction of a square
//     millimetre. Same reasoning as the 6-decimal coordinates: a number
//     should not imply more than we know. 2 dp is 100 m2.
// ---------------------------------------------------------------
const PROPERTIES = {
  slope_unit_id: 's.id',
  district_id: 's.district_id',
  ward_name: 's.ward_name',
  area_ha: 'round(s.area_ha::numeric, 2)',
  mean_slope_deg: 's.mean_slope_deg',
  max_slope_deg: 's.max_slope_deg',
  aspect_sin: 's.aspect_sin',
  aspect_cos: 's.aspect_cos',
  relief_m: 's.relief_m',
  profile_curvature: 's.profile_curvature',
  twi: 's.twi',
  lithology_class: 's.lithology_class',
  landcover_class: 's.landcover_class',
  geological_province: 's.geological_province',
  dist_to_road_m: 's.dist_to_road_m',
  has_road_cut: 's.has_road_cut',
  mean_annual_precip_mm: 's.mean_annual_precip_mm',
  susceptibility_score: 's.susceptibility_score',
  seismic_weakening: 's.seismic_weakening',
  source: 's.source',
  is_mock: 's.is_mock',

  // A plain [lon, lat] pair, not a second geometry. A map label or pin needs
  // a point; nesting a GeoJSON geometry inside properties would invite
  // someone to render it as a second feature.
  centroid:
    'jsonb_build_array(round(ST_X(s.centroid)::numeric, 6), round(ST_Y(s.centroid)::numeric, 6))',
};

/**
 * One row of the query = one finished GeoJSON Feature.
 *
 * ST_AsGeoJSON returns TEXT, so it is wrapped in ::json. Without the cast,
 * `geometry` would arrive at the client as a JSON *string* containing
 * GeoJSON -- MapLibre would reject it, and the mistake looks like valid
 * output right up to the point the map stays empty.
 *
 * The 6-decimal cap on coordinates is about 11 cm at this latitude, which is
 * far finer than a DEM-derived hillslope boundary can justify. The default
 * 15 digits would print numbers like 92.718000000000004 -- implying
 * millimetre precision we do not have, and roughly doubling the payload.
 */
const FEATURE_SQL = `
  SELECT jsonb_build_object(
           'type', 'Feature',
           'id', s.id,
           'geometry', ST_AsGeoJSON(s.geom, 6)::jsonb,
           'properties', jsonb_build_object(
             ${Object.entries(PROPERTIES)
               .map(([key, expr]) => `'${key}', ${expr}`)
               .join(',\n             ')}
           )
         ) AS feature,
         s.is_mock
  FROM slope_unit s
`;

// GeoJSON allows a FeatureCollection to carry extra members, so `meta` sits
// alongside `type` and `features` rather than in a wrapper object. That
// keeps the response something MapLibre can consume directly -- a wrapper
// would force Riya to unwrap it before every render.
const featureCollectionSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['FeatureCollection'] },
    meta: {
      type: 'object',
      properties: {
        district_id: { type: 'string' },
        count: { type: 'integer' },
        // Counted from the rows, never read from config. See the note in
        // buildMeta below -- this is the one field a demo could most easily
        // lie about.
        mock_count: { type: 'integer' },
        is_demo_data: { type: 'boolean' },
        crs: { type: 'string' },
        disclaimer: { type: 'string' },
      },
    },
    features: {
      type: 'array',
      // Deliberately not described field by field. A Fastify response schema
      // SERIALISES as well as documents: any property not listed is silently
      // stripped from the reply. Enumerating 22 properties here would mean
      // that adding one to PROPERTIES and forgetting this list makes the
      // field vanish from the API with no error anywhere. The shape is
      // documented in docs/API_CONTRACT.md instead.
      items: { type: 'object', additionalProperties: true },
    },
  },
};

/**
 * The envelope.
 *
 * `is_demo_data` is `config.demoMode OR any row is mock`, never config
 * alone. Someone setting DEMO_MODE=false while mock polygons are still
 * loaded is not a hypothetical -- it is the obvious thing to do the morning
 * of a demo -- and it would drop the banner while illustrative geometry was
 * still on screen. Rows outvote the flag in one direction only: real data
 * cannot switch the banner off.
 */
function buildMeta(districtId, features, mockCount) {
  const anyMock = mockCount > 0;

  return {
    district_id: districtId,
    count: features.length,
    mock_count: mockCount,
    is_demo_data: config.demoMode || anyMock,
    crs: 'EPSG:4326',
    disclaimer: anyMock
      ? `${mockCount} of ${features.length} slope unit(s) are illustrative geometry, not derived from a DEM. ` +
        'Do not quote their areas or locations as measurements.'
      : 'Slope unit geometry is DEM-derived. See each feature\'s source field for provenance.',
  };
}

export async function registerSlopeUnitRoutes(app) {
  // ---------- GET /api/v1/slope-units ----------
  app.get(
    '/api/v1/slope-units',
    {
      schema: {
        tags: ['slope-units'],
        summary: 'Slope unit polygons as a GeoJSON FeatureCollection',
        description:
          'Returns slope units for one district, ready for MapLibre. Coordinates are ' +
          '[longitude, latitude] in EPSG:4326 per RFC 7946, rounded to 6 decimal places.\n\n' +
          '`is_mock` and `source` appear on **every feature**, because a response can ' +
          'legitimately mix real and illustrative geometry and one envelope flag could ' +
          'not describe that honestly.\n\n' +
          '`area_ha` is measured from the polygon, not copied from the source file.',
        querystring: {
          type: 'object',
          properties: {
            district: {
              type: 'string',
              // Rejects '; DROP TABLE' shapes at the edge. The query itself
              // is parameterised, so this is a clearer error rather than the
              // thing standing between us and injection.
              pattern: '^[a-z0-9_-]{2,40}$',
              default: config.pilotDistrictId,
              description: 'District id. Defaults to the pilot district.',
            },
          },
          // additionalProperties: false does NOT reject an unknown query
          // parameter here. Fastify's AJV runs with removeAdditional: true,
          // so `?foo=1` is silently stripped and the request succeeds --
          // which also means a typo like `?distrct=aizawl` quietly returns
          // the default district. Left as the framework default rather than
          // reconfiguring AJV globally: there is one district in the system,
          // so the wrong answer and the right answer are the same, and a
          // global removeAdditional: false would also start rejecting extra
          // fields in V7's ingest body, where tolerance is wanted. Recorded
          // here so nobody reads this line as a guarantee it does not give.
          additionalProperties: false,
        },
        response: { 200: featureCollectionSchema },
      },
    },
    async (request) => {
      requireDatabase();
      const districtId = request.query.district ?? config.pilotDistrictId;

      // ORDER BY id so the response is stable between calls. Without it
      // Postgres may return rows in any order, and a map layer that
      // reshuffles on every refresh is miserable to debug.
      const { rows } = await query(`${FEATURE_SQL} WHERE s.district_id = $1 ORDER BY s.id`, [
        districtId,
      ]);

      // An unknown district and a district with no slope units loaded are
      // genuinely different situations, and 404 vs an empty collection is
      // the difference between "you asked for something that does not
      // exist" and "nothing is loaded yet". Distinguished with a second
      // query, run only when the result is empty, so the common path stays
      // one round trip.
      if (rows.length === 0) {
        const { rows: district } = await query('SELECT 1 FROM district WHERE id = $1', [districtId]);
        if (district.length === 0) {
          const err = new Error(`No district with id '${districtId}'.`);
          err.statusCode = 404;
          throw err;
        }
      }

      const features = rows.map((r) => r.feature);
      const mockCount = rows.filter((r) => r.is_mock).length;

      return {
        type: 'FeatureCollection',
        meta: buildMeta(districtId, features, mockCount),
        features,
      };
    },
  );

  // ---------- GET /api/v1/slope-units/:id ----------
  // For the click-a-polygon panel. A separate endpoint rather than making
  // the collection filterable, because this one will grow to include the
  // latest prediction and exposure (V9) while the collection stays a plain
  // map layer.
  app.get(
    '/api/v1/slope-units/:id',
    {
      schema: {
        tags: ['slope-units'],
        summary: 'One slope unit as a GeoJSON Feature',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,40}$' },
          },
          required: ['id'],
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          404: {
            type: 'object',
            properties: { statusCode: { type: 'integer' }, error: { type: 'string' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request) => {
      requireDatabase();
      const { rows } = await query(`${FEATURE_SQL} WHERE s.id = $1`, [request.params.id]);

      if (rows.length === 0) {
        const err = new Error(`No slope unit with id '${request.params.id}'.`);
        err.statusCode = 404;
        throw err;
      }

      return rows[0].feature;
    },
  );
}
