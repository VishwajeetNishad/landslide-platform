/**
 * src/alerting/cap.js -- OASIS Common Alerting Protocol (CAP 1.2) XML generator (Step V14).
 *
 * Implements ARCHITECTURE.md §14.4, §20 and IMPLEMENTATION_STEPS.md V14.
 *
 * Standards-compliant XML generator for integration with India's national
 * emergency alert pipeline (SACHET / NDMA).
 *
 * Conforms strictly to OASIS CAP v1.2 specification:
 * - Namespace: urn:oasis:names:tc:emergency:cap:1.2
 * - Safe status flag: 'Exercise' for prototype demonstrations
 * - Coordinates formatted as "lat,lon lat,lon ..." (note: lat first in CAP standard)
 * - Multi-lingual <info> blocks for English (en-IN), Hindi (hi-IN), and Mizo (lus-IN)
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
 * Build a valid CAP 1.2 XML document string.
 *
 * @param {Object} alert - Database alert record
 * @param {Object} [options]
 * @param {string} [options.status='Exercise'] - 'Exercise' (demo safety) or 'Actual'
 * @param {string} [options.sender] - Sender URI / authority
 * @param {Object} [options.geometry] - GeoJSON Polygon of the affected slope unit / runout
 * @param {Object} [options.context] - Additional hazard context (ward, district, probability, etc.)
 * @returns {string} Fully-formed XML string
 */
export function buildCap12Xml(alert, {
  status = 'Exercise',
  sender = 'ddma-aizawl@disaster.mz.gov.in',
  geometry = null,
  context = {},
} = {}) {
  const sentDate = alert.authorised_at || alert.created_at || new Date();
  const sentIso = new Date(sentDate).toISOString();

  const onsetDate = context.valid_from ? new Date(context.valid_from) : new Date(sentDate);
  const expiresDate = context.valid_to
    ? new Date(context.valid_to)
    : new Date(onsetDate.getTime() + 12 * 3600 * 1000);

  const identifier = `IN-MZ-DDMA-ALERT-${alert.id}-${Date.parse(sentIso)}`;
  const severity = alert.severity || 'Severe';
  const wardName = context.ward_name || 'Melthum';
  const districtName = (context.district_id || 'aizawl').toUpperCase();
  const senderName = `${context.district_name || 'Aizawl'} District Disaster Management Authority (DDMA)`;

  const polygonStr = geometry ? geoJsonPolygonToCap(geometry) : '';

  // Render frozen multi-language instructions
  const smsTexts = renderSmsTemplates({
    severity,
    wardName,
    districtName: context.district_name || 'Aizawl',
    validFrom: onsetDate,
    validTo: expiresDate,
  });

  const xmlParts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">',
    `  <identifier>${escapeXml(identifier)}</identifier>`,
    `  <sender>${escapeXml(sender)}</sender>`,
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
    `    <headline>${escapeXml(alert.headline || `Landslide Risk Warning - ${wardName}`)}</headline>`,
    `    <description>${escapeXml(alert.body || smsTexts.en)}</description>`,
    `    <instruction>${escapeXml(smsTexts.en)}</instruction>`,
    '    <area>',
    `      <areaDesc>${escapeXml(`${wardName}, ${districtName}, Mizoram`)}</areaDesc>`,
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
    `    <headline>${escapeXml(`भूस्खलन जोखिम चेतावनी - ${wardName}`)}</headline>`,
    `    <description>${escapeXml(smsTexts.hi)}</description>`,
    `    <instruction>${escapeXml(smsTexts.hi)}</instruction>`,
    '    <area>',
    `      <areaDesc>${escapeXml(`${wardName}, ${districtName}, Mizoram`)}</areaDesc>`,
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
    `    <headline>${escapeXml(`Leimin Hlauhawm Hriattirna - ${wardName}`)}</headline>`,
    `    <description>${escapeXml(smsTexts.mizo)}</description>`,
    `    <instruction>${escapeXml(smsTexts.mizo)}</instruction>`,
    '    <area>',
    `      <areaDesc>${escapeXml(`${wardName}, ${districtName}, Mizoram`)}</areaDesc>`,
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
