import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculateRiskLevel,
  getExposureBand,
  getProbabilityBand,
} from '../src/exposure/risk.js';

describe('V8 -- risk level calculation (Risk = Likelihood x Consequence)', () => {
  describe('Probability bands', () => {
    it('categorizes probability < 0.30 as low', () => {
      assert.equal(getProbabilityBand(0.0), 'low');
      assert.equal(getProbabilityBand(0.15), 'low');
      assert.equal(getProbabilityBand(0.299), 'low');
    });

    it('categorizes 0.30 <= probability < 0.60 as med', () => {
      assert.equal(getProbabilityBand(0.30), 'med');
      assert.equal(getProbabilityBand(0.45), 'med');
      assert.equal(getProbabilityBand(0.599), 'med');
    });

    it('categorizes probability >= 0.60 as high', () => {
      assert.equal(getProbabilityBand(0.60), 'high');
      assert.equal(getProbabilityBand(0.72), 'high');
      assert.equal(getProbabilityBand(0.95), 'high');
      assert.equal(getProbabilityBand(1.0), 'high');
    });
  });

  describe('Exposure bands', () => {
    it('categorizes empty / zero exposure as low', () => {
      assert.equal(
        getExposureBand({
          population_estimate: 0,
          road_metres: 0,
          buildings_count: 0,
          critical_facilities: [],
        }),
        'low',
      );
      assert.equal(getExposureBand({}), 'low');
      assert.equal(getExposureBand(null), 'low');
    });

    it('categorizes small population or roads as med', () => {
      assert.equal(getExposureBand({ population_estimate: 15 }), 'med');
      assert.equal(getExposureBand({ road_metres: 100 }), 'med');
      assert.equal(getExposureBand({ buildings_count: 6 }), 'med');
      // camelCase support
      assert.equal(getExposureBand({ populationEstimate: 20 }), 'med');
      assert.equal(getExposureBand({ roadMetres: 50 }), 'med');
    });

    it('categorizes critical facilities or large population (>= 100) as high', () => {
      assert.equal(getExposureBand({ population_estimate: 100 }), 'high');
      assert.equal(getExposureBand({ population_estimate: 120 }), 'high');
      assert.equal(
        getExposureBand({
          critical_facilities: [{ type: 'school', name: 'Primary School' }],
        }),
        'high',
      );
      // camelCase support
      assert.equal(
        getExposureBand({
          criticalFacilities: [{ type: 'hospital', name: 'Civil Hospital' }],
        }),
        'high',
      );
    });
  });

  describe('The Full 9-Combination Risk Matrix', () => {
    it('(low likelihood, low exposure) -> LOW', () => {
      assert.equal(calculateRiskLevel(0.1, { population_estimate: 0 }), 'LOW');
    });

    it('(low likelihood, med exposure) -> LOW', () => {
      assert.equal(calculateRiskLevel(0.2, { population_estimate: 25 }), 'LOW');
    });

    it('(low likelihood, high exposure) -> MEDIUM', () => {
      assert.equal(calculateRiskLevel(0.2, { population_estimate: 200 }), 'MEDIUM');
    });

    it('(med likelihood, low exposure) -> LOW', () => {
      assert.equal(calculateRiskLevel(0.45, { population_estimate: 0 }), 'LOW');
    });

    it('(med likelihood, med exposure) -> MEDIUM', () => {
      assert.equal(calculateRiskLevel(0.45, { population_estimate: 30 }), 'MEDIUM');
    });

    it('(med likelihood, high exposure) -> HIGH', () => {
      assert.equal(calculateRiskLevel(0.45, { population_estimate: 150 }), 'HIGH');
    });

    it('(high likelihood, low exposure) -> LOW', () => {
      assert.equal(calculateRiskLevel(0.85, { population_estimate: 0 }), 'LOW');
    });

    it('(high likelihood, med exposure) -> HIGH', () => {
      assert.equal(calculateRiskLevel(0.70, { population_estimate: 20 }), 'HIGH');
    });

    it('(high likelihood, high exposure) -> HIGH', () => {
      assert.equal(calculateRiskLevel(0.75, { population_estimate: 150 }), 'HIGH');
    });
  });

  describe('Key Showcase Cases', () => {
    it('AZ-1088 Proof Case: probability 0.95 with zero exposure -> LOW', () => {
      // Core demo argument: A 0.95-probability failure on an empty ridge is LOW risk.
      const risk = calculateRiskLevel(0.95, {
        buildings_count: 0,
        population_estimate: 0,
        road_metres: 0,
        critical_facilities: [],
      });
      assert.equal(risk, 'LOW');
    });

    it('AZ-1142 Showcase Case: probability 0.72 with school & 120 pop -> HIGH', () => {
      const risk = calculateRiskLevel(0.72, {
        buildings_count: 17,
        population_estimate: 120,
        road_segments: [{ metres: 340 }],
        road_metres: 340,
        critical_facilities: [{ type: 'school', name: 'Primary School' }],
      });
      assert.equal(risk, 'HIGH');
    });

    it('AZ-1147 Showcase Case: probability 0.68 with 61 pop -> MEDIUM (or HIGH depending on road/pop)', () => {
      // 61 population is med exposure (>=10, <100), p=0.68 is high probability -> HIGH
      const risk = calculateRiskLevel(0.68, {
        buildings_count: 9,
        population_estimate: 61,
        road_metres: 0,
        critical_facilities: [],
      });
      assert.equal(risk, 'HIGH');
    });
  });

  describe('No exposure at all', () => {
    // The distinction the AZ-1088 case depends on. Above, zero exposure is a
    // FINDING: a runout envelope was drawn, intersected, and came out empty,
    // so LOW is true. Here nothing was computed, so there is no consequence
    // term and Risk = Likelihood x Consequence has no answer. Returning LOW
    // for both would make the two indistinguishable in the database and on
    // the map, and the one nobody has checked would be coloured green.
    it('returns null when no exposure argument is given', () => {
      assert.equal(calculateRiskLevel(0.95), null);
    });

    it('returns null for an explicit null exposure', () => {
      assert.equal(calculateRiskLevel(0.95, null), null);
    });

    it('still returns LOW for an exposure object that is present but empty', () => {
      // `{}` means "computed, found nothing" -- a different claim from
      // "not computed", and it keeps its band.
      assert.equal(calculateRiskLevel(0.95, {}), 'LOW');
    });

    it('refuses a non-numeric probability instead of banding it low', () => {
      // NaN used to fall through to the 'low' band, so a corrupt probability
      // produced a confident LOW that looked exactly like a real one.
      assert.throws(() => getProbabilityBand('very likely'), TypeError);
      assert.throws(() => getProbabilityBand(undefined), TypeError);
      assert.throws(() => calculateRiskLevel(NaN, { population_estimate: 0 }), TypeError);
    });
  });
});
