/**
 * src/alerting/cap.js -- OASIS Common Alerting Protocol (CAP 1.2) XML generator (Step V14).
 *
 * Implements ARCHITECTURE.md §14.4, §20 and IMPLEMENTATION_STEPS.md V14.
 *
 * Standards-compliant XML generator for integration with India's national
 * emergency alert pipeline (SACHET / NDMA).
 *
 * ZERO HARDCODING:
 * - Jurisdictions, state names, districts, sender authorities, and coordinate bounds
 *   are dynamically resolved from the database.
 * - Coordinates are converted from GeoJSON [lon, lat] to standard CAP "lat,lon" sequence.
 */

import { renderSmsTemplates } from './templates.js';

/**
 * Escape special characters for safe XML output.
 */
export function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert GeoJSON polygon coordinates [ [ [lon, lat], [lon, lat], ... ] ]
 * into CAP 1.2 XML polygon format: "lat,lon lat,lon lat,lon ...".
 *
 * CAP 1.2 explicitly requires Latitude first, then comma, then Longitude.
 */
export function geoJsonPolygonToCap(geom) {
  if (!geom || !geom.coordinates) return '';

  let ring = [];
  if (geom.type === 'Polygon' && geom.coordinates.length > 0) {
    ring = geom.coordinates[0];
  } else if (geom.type === 'MultiPolygon' && geom.coordinates.length > 0) {
    ring = geom.coordinates[0][0];
  }

  if (!Array.isArray(ring) || ring.length === 0) return '';

  return ring
    .map(([lon, lat]) => `${Number(lat).toFixed(6)},${Number(lon).toFixed(6)}`)
    .join(' ');
}

/**
 * Build a valid CAP 1.2 XML document string with dynamic parameters.
 *
 * @param {Object} alert - Database alert record
 * @param {Object} [options]
 * @param {string} [options.status='Exercise'] - 'Exercise' (demo safety) or 'Actual'
 * @param {string} [options.sender] - Custom sender URI / authority
 * @param {Object} [options.geometry] - GeoJSON Polygon of the affected slope unit / runout
 * @param {Object} [options.context] - Dynamic hazard context from DB (district, state, ward, etc.)
 * @returns {string} Fully-formed XML string
 */
export function buildCap12Xml(alert, {
  status = 'Exercise',
  sender = null,
  geometry = null,
  context = {},
} = {}) {
  const sentDate = alert.authorised_at || alert.created_at || new Date();
  const sentIso = new Date(sentDate).toISOString();

  const onsetDate = context.valid_from ? new Date(context.valid_from) : new Date(sentDate);
  const expiresDate = context.valid_to
    ? new Date(context.valid_to)
    : new Date(onsetDate.getTime() + 12 * 3600 * 1000);

  const districtId = (context.district_id || 'district').toLowerCase();
  const districtName = context.district_name || districtId.toUpperCase();
  const stateName = context.state_name || 'India';
  const stateCode = context.state_name ? context.state_name.substring(0, 2).toUpperCase() : 'IN';
  const distCode = districtId.substring(0, 4).toUpperCase();

  const identifier = `IN-${stateCode}-${distCode}-ALERT-${alert.id}-${Date.parse(sentIso)}`;
  const senderEmail = sender || `ddma-${districtId}@disaster.gov.in`;
  const senderName = `${districtName} District Disaster Management Authority (DDMA)`;

  const severity = alert.severity || 'Severe';
  const wardName = context.ward_name;
  const slopeUnitId = context.slope_unit_id;

  const polygonStr = geometry ? geoJsonPolygonToCap(geometry) : '';

  // Render dynamic multi-language instructions
  const smsTexts = renderSmsTemplates({
    severity,
    wardName,
    slopeUnitId,
    districtName,
    validFrom: onsetDate,
    validTo: expiresDate,
    roadMetres: context.road_metres,
  });

  const locationDescriptor = wardName
    ? `${wardName}, ${districtName}, ${stateName}`
    : (slopeUnitId ? `Slope Unit ${slopeUnitId}, ${districtName}, ${stateName}` : `${districtName}, ${stateName}`);

  const headlineEn = alert.headline || `Landslide Risk Warning - ${wardName || slopeUnitId || districtName}`;
  const headlineHi = `भूस्खलन जोखिम चेतावनी - ${wardName || slopeUnitId || districtName}`;
  const headlineMizo = `Leimin Hlauhawm Hriattirna - ${wardName || slopeUnitId || districtName}`;

  const xmlParts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">',
    `  <identifier>${escapeXml(identifier)}</identifier>`,
    `  <sender>${escapeXml(senderEmail)}</sender>`,
    `  <sent>${escapeXml(sentIso)}</sent>`,
    `  <status>${escapeXml(status)}</status>`,
    '  <msgType>Alert</msgType>',
    '  <scope>Public</scope>',
    '  <note>Internal prototype early warning drill alert - not an operational agency broadcast</note>',

    // --- Language 1: English (en-IN) ---
    '  <info>',
    '    <language>en-IN</language>',
    '    <category>Geo</category>',
    '    <event>Landslide Hazard Warning</event>',
    '    <urgency>Expected</urgency>',
    `    <severity>${escapeXml(severity)}</severity>`,
    '    <certainty>Likely</certainty>',
    '    <eventCode>',
    '      <valueName>SAME</valueName>',
    '      <value>LSW</value>',
    '    </eventCode>',
    `    <onset>${escapeXml(onsetDate.toISOString())}</onset>`,
    `    <expires>${escapeXml(expiresDate.toISOString())}</expires>`,
    `    <senderName>${escapeXml(senderName)}</senderName>`,
    `    <headline>${escapeXml(headlineEn)}</headline>`,
    `    <description>${escapeXml(alert.body || smsTexts.en)}</description>`,
    `    <instruction>${escapeXml(smsTexts.en)}</instruction>`,
    '    <area>',
    `      <areaDesc>${escapeXml(locationDescriptor)}</areaDesc>`,
  ];

  if (polygonStr) {
    xmlParts.push(`      <polygon>${polygonStr}</polygon>`);
  }

  xmlParts.push(
    '    </area>',
    '  </info>',

    // --- Language 2: Hindi (hi-IN) ---
    '  <info>',
    '    <language>hi-IN</language>',
    '    <category>Geo</category>',
    '    <event>भूस्खलन चेतावनी (Landslide Warning)</event>',
    '    <urgency>Expected</urgency>',
    `    <severity>${escapeXml(severity)}</severity>`,
    '    <certainty>Likely</certainty>',
    '    <eventCode>',
    '      <valueName>SAME</valueName>',
    '      <value>LSW</value>',
    '    </eventCode>',
    `    <onset>${escapeXml(onsetDate.toISOString())}</onset>`,
    `    <expires>${escapeXml(expiresDate.toISOString())}</expires>`,
    `    <senderName>${escapeXml(senderName)}</senderName>`,
    `    <headline>${escapeXml(headlineHi)}</headline>`,
    `    <description>${escapeXml(smsTexts.hi)}</description>`,
    `    <instruction>${escapeXml(smsTexts.hi)}</instruction>`,
    '    <area>',
    `      <areaDesc>${escapeXml(locationDescriptor)}</areaDesc>`,
  );

  if (polygonStr) {
    xmlParts.push(`      <polygon>${polygonStr}</polygon>`);
  }

  xmlParts.push(
    '    </area>',
    '  </info>',

    // --- Language 3: Mizo (lus-IN) ---
    '  <info>',
    '    <language>lus-IN</language>',
    '    <category>Geo</category>',
    '    <event>Leimin Hlauhawm Hriattirna</event>',
    '    <urgency>Expected</urgency>',
    `    <severity>${escapeXml(severity)}</severity>`,
    '    <certainty>Likely</certainty>',
    '    <eventCode>',
    '      <valueName>SAME</valueName>',
    '      <value>LSW</value>',
    '    </eventCode>',
    `    <onset>${escapeXml(onsetDate.toISOString())}</onset>`,
    `    <expires>${escapeXml(expiresDate.toISOString())}</expires>`,
    `    <senderName>${escapeXml(senderName)}</senderName>`,
    `    <headline>${escapeXml(headlineMizo)}</headline>`,
    `    <description>${escapeXml(smsTexts.mizo)}</description>`,
    `    <instruction>${escapeXml(smsTexts.mizo)}</instruction>`,
    '    <area>',
    `      <areaDesc>${escapeXml(locationDescriptor)}</areaDesc>`,
  );

  if (polygonStr) {
    xmlParts.push(`      <polygon>${polygonStr}</polygon>`);
  }

  xmlParts.push(
    '    </area>',
    '  </info>',
    '</alert>',
  );

  return xmlParts.join('\n');
}
