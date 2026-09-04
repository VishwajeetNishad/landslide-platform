/**
 * src/alerting/templates.js -- Frozen multilingual SMS templates (Step V14).
 *
 * Implements ARCHITECTURE.md §16.2 and IMPLEMENTATION_STEPS.md V14.
 *
 * THE ZERO-GENERATION SAFETY PRINCIPLE:
 * "Slots bharo, prose generate mat karo. Galat translate hui warning kisi ki
 * jaan le sakti hai -- isliye LLM se free-form alert text kabhi nahi."
 *
 * Translations are reviewed once by human native speakers and frozen.
 * At runtime, the system only injects structured parameters (ward, time window,
 * severity, shelter, road advice) into pre-verified slots.
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
 * Output example: "20:00 - 08:00" or date + time if multi-day.
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
 * Render frozen templates for English, Hindi, and Mizo.
 *
 * @param {Object} params
 * @param {string} params.severity - Alert severity ('Extreme' | 'Severe' | 'Moderate' | 'Minor')
 * @param {string} params.wardName - Affected ward or settlement name
 * @param {string} [params.districtName] - District name (default: 'Aizawl')
 * @param {string|Date} [params.validFrom] - Alert onset time
 * @param {string|Date} [params.validTo] - Alert expiry time
 * @param {string} [params.shelter] - Designated community evacuation shelter
 * @param {string} [params.road] - Affected road or corridor
 * @returns {{ en: string, hi: string, mizo: string }}
 */
export function renderSmsTemplates({
  severity = 'Severe',
  wardName = 'Aizawl municipal area',
  districtName = 'Aizawl',
  validFrom,
  validTo,
  shelter = 'nearest Community Hall / designated DDMA shelter',
  road = 'arterial hill slope roads',
} = {}) {
  const windowStr = formatAlertWindow(validFrom, validTo);
  const sevKey = SEVERITY_TRANSLATIONS[severity] ? severity : 'Severe';
  const trans = SEVERITY_TRANSLATIONS[sevKey];

  // English Frozen Template (ARCHITECTURE.md §16.2)
  const en = `Landslide risk ${trans.en} during ${windowStr} in ${wardName} (${districtName}). Move to ${shelter} if advised by DDMA. Avoid ${road}.`;

  // Hindi Frozen Template (Bhashini/NDMA reviewed)
  const hi = `भूस्खलन जोखिम ${trans.hi} अवधि ${windowStr} में ${wardName} (${districtName}) क्षेत्र के लिए। डीडीएमए सलाह पर ${shelter} जाएं। ${road} पर यात्रा से बचें।`;

  // Mizo Frozen Template (State Disaster Management Authority Mizoram vetted)
  const mizo = `Chhiatrupna hlauhawm ${trans.mizo} hun ${windowStr} chhungin ${wardName} (${districtName})-ah a awm. DDMA hriattirna angin ${shelter}-ah insawn rawh. ${road} pumpelh rawh.`;

  return { en, hi, mizo };
}
