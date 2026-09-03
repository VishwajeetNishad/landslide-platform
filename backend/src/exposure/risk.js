/**
 * src/exposure/risk.js -- Risk Level Calculation Logic (Step V8).
 *
 * Core scientific rule:
 *   Risk = Likelihood x Consequence
 *
 * Model probability alone is NEVER risk.
 * - Slope AZ-1088: probability 0.95, 0 buildings, 0 population -> Risk LOW.
 * - Slope AZ-1142: probability 0.72, 120 population, 1 school -> Risk HIGH.
 *
 * Matrix specification defined in docs/ARCHITECTURE.md §13:
 *
 * Probability bands (Likelihood):
 *   - low:  p < 0.30
 *   - med:  0.30 <= p < 0.60
 *   - high: p >= 0.60
 *
 * Exposure bands (Consequence):
 *   - high: critical_facilities > 0 OR population_estimate >= 100
 *   - med:  population_estimate >= 10 OR road_metres > 0 (or buildings_count >= 5)
 *   - low:  everything below
 *
 * Matrix (p_band x e_band):
 *   ('low',  'low')  -> LOW,    ('low',  'med')  -> LOW,    ('low',  'high') -> MEDIUM
 *   ('med',  'low')  -> LOW,    ('med',  'med')  -> MEDIUM, ('med',  'high') -> HIGH
 *   ('high', 'low')  -> LOW,    ('high', 'med')  -> HIGH,   ('high', 'high') -> HIGH
 */

/**
 * Determine the qualitative exposure band ('low', 'med', 'high').
 * Accepts exposure object with either snake_case or camelCase properties.
 *
 * @param {object} [exposure={}]
 * @returns {'low' | 'med' | 'high'}
 */
export function getExposureBand(exposure = {}) {
  if (!exposure || typeof exposure !== 'object') {
    return 'low';
  }

  const population = Number(exposure.population_estimate ?? exposure.populationEstimate ?? 0);
  const roadMetres = Number(exposure.road_metres ?? exposure.roadMetres ?? 0);
  const buildings = Number(exposure.buildings_count ?? exposure.buildingsCount ?? 0);

  const criticalFacilities = exposure.critical_facilities ?? exposure.criticalFacilities ?? [];
  const hasCriticalFacilities = Array.isArray(criticalFacilities)
    ? criticalFacilities.length > 0
    : Boolean(criticalFacilities);

  if (hasCriticalFacilities || population >= 100) {
    return 'high';
  }

  if (population >= 10 || roadMetres > 0 || buildings >= 5) {
    return 'med';
  }

  return 'low';
}

/**
 * Determine the qualitative probability band ('low', 'med', 'high').
 *
 * @param {number} probability
 * @returns {'low' | 'med' | 'high'}
 */
export function getProbabilityBand(probability) {
  const p = Number(probability);
  if (isNaN(p) || p < 0.30) {
    return 'low';
  }
  if (p < 0.60) {
    return 'med';
  }
  return 'high';
}

const RISK_MATRIX = {
  'low:low': 'LOW',
  'low:med': 'LOW',
  'low:high': 'MEDIUM',
  'med:low': 'LOW',
  'med:med': 'MEDIUM',
  'med:high': 'HIGH',
  'high:low': 'LOW',
  'high:med': 'HIGH',
  'high:high': 'HIGH',
};

/**
 * Calculate the risk level from failure probability and exposure.
 *
 * @param {number} probability - Failure probability (0.0 to 1.0)
 * @param {object} [exposure={}] - Exposure metrics (population, roads, buildings, critical facilities)
 * @returns {'LOW' | 'MEDIUM' | 'HIGH'}
 */
export function calculateRiskLevel(probability, exposure = {}) {
  const pBand = getProbabilityBand(probability);
  const eBand = getExposureBand(exposure);
  return RISK_MATRIX[`${pBand}:${eBand}`] ?? 'LOW';
}
