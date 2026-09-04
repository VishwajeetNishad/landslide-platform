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
 *   - med:  population_estimate >= 10 OR road_metres > 0 OR buildings_count >= 5
 *   - low:  everything below
 *
 * The `buildings_count >= 5` clause is an addition to ARCHITECTURE.md §13,
 * which lists only population and road metres for the med band. It is kept
 * because a cluster of houses with no population figure attached is still a
 * consequence, but §13 is the specification and has not been amended yet --
 * see docs/PROGRESS.md, V8 Pending.
 *
 * Matrix (p_band x e_band):
 *   ('low',  'low')  -> LOW,    ('low',  'med')  -> LOW,    ('low',  'high') -> MEDIUM
 *   ('med',  'low')  -> LOW,    ('med',  'med')  -> MEDIUM, ('med',  'high') -> HIGH
 *   ('high', 'low')  -> LOW,    ('high', 'med')  -> HIGH,   ('high', 'high') -> HIGH
 *
 * And one value that is not in the matrix at all: NULL, for a prediction
 * whose exposure has never been computed. See calculateRiskLevel().
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
 * Throws on a non-numeric probability rather than returning a band. The
 * earlier version returned 'low' for NaN, which is the worst available
 * default: a corrupt probability would have produced a confident LOW that
 * looks exactly like a real one. The route's schema already requires a
 * number in [0, 1], so this can only fire for a caller that skipped
 * validation -- and that caller should hear about it.
 *
 * @param {number} probability
 * @returns {'low' | 'med' | 'high'}
 */
export function getProbabilityBand(probability) {
  const p = Number(probability);
  if (!Number.isFinite(p)) {
    throw new TypeError(
      `probability must be a finite number, received ${JSON.stringify(probability)}. ` +
        'Refusing to guess a band.',
    );
  }
  if (p < 0.30) {
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
 * Returns null when there is no exposure to combine with. This is the
 * difference between "we looked and nobody is below" and "nobody has
 * looked", and the two must not share a value. getExposureBand({}) returns
 * 'low' for both, so the decision has to be made here, above it: with no
 * exposure argument there is no consequence term, and Risk = Likelihood x
 * Consequence has no answer. Migration 004 defines the NULL column that
 * stores this, and callers must render it as "not assessed", never as LOW.
 *
 * @param {number} probability - Failure probability (0.0 to 1.0)
 * @param {object} [exposure] - Exposure metrics. Omit only if none was computed.
 * @returns {'LOW' | 'MEDIUM' | 'HIGH' | null}
 */
export function calculateRiskLevel(probability, exposure) {
  if (exposure === null || exposure === undefined) {
    return null;
  }
  const pBand = getProbabilityBand(probability);
  const eBand = getExposureBand(exposure);
  return RISK_MATRIX[`${pBand}:${eBand}`] ?? 'LOW';
}
