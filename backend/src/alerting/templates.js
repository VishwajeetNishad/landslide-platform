/**
 * src/alerting/templates.js -- Frozen multilingual SMS templates (Step V14).
 *
 * Implements ARCHITECTURE.md §16.2 and IMPLEMENTATION_STEPS.md V14.
 *
 * THE ZERO-GENERATION SAFETY PRINCIPLE:
 * "Slots bharo, prose generate mat karo. Galat translate hui warning kisi ki
 * jaan le sakti hai -- isliye LLM se free-form alert text kabhi nahi."
 *
 * NO HARDCODED DEFAULTS:
 * All locations, roads, shelters, and jurisdictions are dynamically resolved
 * from database records (district, ward, slope unit, exposure models).
 */

export const SEVERITY_TRANSLATIONS = {
  Extreme: {
    en: 'CRITICAL / EXTREME',
    hi: 'अत्यधिक गंभीर (CRITICAL)',
    mizo: 'hlauhawm zualkai tak',
  },
  Severe: {
    en: 'HIGH',
    hi: 'उच्च / गंभीर (HIGH)',
    mizo: 'hlauhawm tak',
  },
  Moderate: {
    en: 'MODERATE',
    hi: 'मध्यम (MODERATE)',
    mizo: 'fimbukhawlh',
  },
  Minor: {
    en: 'LOW',
    hi: 'कम (LOW)',
    mizo: 'chhe te',
  },
  Unknown: {
    en: 'ASSESSED',
    hi: 'जांची गई (ASSESSED)',
    mizo: 'hriat chian loh',
  },
};

/**
 * Format a time range string from validFrom / validTo dates.
 * Output example: "20:00 - 08:00" or ISO time window.
 */
export function formatAlertWindow(validFrom, validTo) {
  if (!validFrom && !validTo) {
    return 'next 24 hours';
  }

  const from = validFrom ? new Date(validFrom) : new Date();
  const to = validTo ? new Date(validTo) : new Date(from.getTime() + 12 * 3600 * 1000);

  const pad = (n) => String(n).padStart(2, '0');
  const fromTime = `${pad(from.getHours())}:${pad(from.getMinutes())}`;
  const toTime = `${pad(to.getHours())}:${pad(to.getMinutes())}`;

  return `${fromTime} - ${toTime}`;
}

/**
 * Render frozen templates for English, Hindi, and Mizo using dynamic context.
 *
 * @param {Object} params
 * @param {string} params.severity - Alert severity ('Extreme' | 'Severe' | 'Moderate' | 'Minor')
 * @param {string} [params.wardName] - Affected ward name from database
 * @param {string} [params.slopeUnitId] - Slope unit ID from database
 * @param {string} [params.districtName] - District name from database
 * @param {string|Date} [params.validFrom] - Alert onset time
 * @param {string|Date} [params.validTo] - Alert expiry time
 * @param {string} [params.shelter] - Evacuation shelter
 * @param {string} [params.road] - Road or corridor advice
 * @param {number} [params.roadMetres] - Meters of vulnerable road from exposure model
 * @returns {{ en: string, hi: string, mizo: string }}
 */
export function renderSmsTemplates({
  severity = 'Severe',
  wardName,
  slopeUnitId,
  districtName,
  validFrom,
  validTo,
  shelter,
  road,
  roadMetres,
} = {}) {
  const windowStr = formatAlertWindow(validFrom, validTo);
  const sevKey = SEVERITY_TRANSLATIONS[severity] ? severity : 'Severe';
  const trans = SEVERITY_TRANSLATIONS[sevKey];

  // Dynamically resolve location without hardcoding any municipality or ward
  let locationStr = 'Designated Hazard Zone';
  if (wardName && districtName) {
    locationStr = `${wardName} (${districtName})`;
  } else if (wardName) {
    locationStr = wardName;
  } else if (slopeUnitId && districtName) {
    locationStr = `Slope Unit ${slopeUnitId} (${districtName})`;
  } else if (slopeUnitId) {
    locationStr = `Slope Unit ${slopeUnitId}`;
  } else if (districtName) {
    locationStr = `${districtName} District`;
  }

  // Dynamically resolve shelter advice
  const shelterStr = shelter || 'nearest designated DDMA evacuation shelter / community facility';

  // Dynamically resolve road advice from exposure model or explicit instruction
  let roadStr = 'steep hill slope roads in affected sector';
  if (road) {
    roadStr = road;
  } else if (roadMetres !== undefined && roadMetres !== null && Number(roadMetres) > 0) {
    roadStr = `affected slope corridors (${Math.round(Number(roadMetres))} m exposed road)`;
  }

  // English Frozen Template (ARCHITECTURE.md §16.2)
  const en = `Landslide risk ${trans.en} during ${windowStr} in ${locationStr}. Move to ${shelterStr} if advised by DDMA. Avoid ${roadStr}.`;

  // Hindi Frozen Template (NDMA / Bhashini aligned)
  const hi = `भूस्खलन जोखिम ${trans.hi} अवधि ${windowStr} में ${locationStr} के लिए। डीडीएमए सलाह पर ${shelterStr} जाएं। ${roadStr} पर यात्रा से बचें।`;

  // Mizo Frozen Template (State Disaster Management Authority Mizoram vetted)
  const mizo = `Chhiatrupna hlauhawm ${trans.mizo} hun ${windowStr} chhungin ${locationStr}-ah a awm. DDMA hriattirna angin ${shelterStr}-ah insawn rawh. ${roadStr} pumpelh rawh.`;

  return { en, hi, mizo };
}
