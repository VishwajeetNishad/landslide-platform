import {
  RiskDashboardResponse,
  SlopeUnitsResponse,
  SlopeUnitFeature,
  MLPrediction,
  SlopeUnitTerrainFeature,
  VerificationStatus,
  CapAlertMessage,
  SlopeUnit
} from '../types';
import riskCurrentSample from '../data/risk_current.json';
import terrainSample from '../data/mock_slope_units_aizawl.json';
import predictionsSample from '../data/predictions.json';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// Get API base URL from Vite environment variable, fallback to localhost:8000
const API_BASE_URL = ((import.meta as any).env?.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// Data source mode: 'live' (default) or 'mock'
let currentDataSource: 'live' | 'mock' = 
  (localStorage.getItem('terraguard_data_source') as 'live' | 'mock') || 'live';

// Local in-memory store for demo actions (verification, notes, etc.)
let localOverrides: Record<string, Partial<SlopeUnitFeature['properties']>> = {};

type Listener = () => void;
const listeners = new Set<Listener>();
function notifyListeners() {
  listeners.forEach((cb) => cb());
}

async function fetchFromBackend<T>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new ApiError(404, 'District or slope unit not found on backend (404)');
      }
      if (response.status === 503) {
        throw new ApiError(503, 'Landslide risk telemetry data unavailable (503)');
      }
      throw new ApiError(response.status, `Backend request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Network failure / Connection refused
    throw new ApiError(0, `Cannot connect to live backend at ${API_BASE_URL}. Ensure the backend server is running.`);
  }
}

export const api = {
  getDataSource: () => currentDataSource,
  setDataSource: (source: 'live' | 'mock') => {
    currentDataSource = source;
    localStorage.setItem('terraguard_data_source', source);
    notifyListeners();
  },

  getBaseUrl: () => API_BASE_URL,

  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * 1. Fetch slope units GeoJSON from GET /api/v1/slope-units?district=aizawl
   */
  getSlopeUnitsGeoJson: async (district: string = 'aizawl'): Promise<SlopeUnitsResponse> => {
    if (currentDataSource === 'mock') {
      return terrainSample as unknown as SlopeUnitsResponse;
    }
    return fetchFromBackend<SlopeUnitsResponse>(`/api/v1/slope-units?district=${encodeURIComponent(district)}`);
  },

  /**
   * 2. Fetch risk data from GET /api/v1/risk/current?district=aizawl
   */
  getRiskData: async (district: string = 'aizawl'): Promise<RiskDashboardResponse> => {
    let data: RiskDashboardResponse;

    if (currentDataSource === 'mock') {
      data = JSON.parse(JSON.stringify(riskCurrentSample)) as RiskDashboardResponse;
    } else {
      data = await fetchFromBackend<RiskDashboardResponse>(`/api/v1/risk/current?district=${encodeURIComponent(district)}`);
    }

    // Apply any local human verification overrides for officer interactive review
    if (data && data.features) {
      data.features = data.features.map((feature) => {
        const id = feature.properties?.slope_unit_id;
        if (id && localOverrides[id]) {
          return {
            ...feature,
            properties: {
              ...feature.properties,
              ...localOverrides[id],
            },
          };
        }
        return feature;
      });
    }

    return data;
  },

  /**
   * 3. Fetch combined slope units + risk data.
   * Merges /api/v1/slope-units GeoJSON with /api/v1/risk/current properties by slope_unit_id.
   * Unassessed units receive null risk_level (rendering grey/not assessed on map).
   */
  getMergedSlopeUnits: async (district: string = 'aizawl'): Promise<{
    riskDashboard: RiskDashboardResponse;
    slopeUnits: SlopeUnitsResponse;
    mergedFeatures: SlopeUnitFeature[];
  }> => {
    const [riskData, slopeUnitsData] = await Promise.all([
      api.getRiskData(district),
      api.getSlopeUnitsGeoJson(district).catch((err) => {
        console.warn('Slope units endpoint error, using risk data geometry fallback:', err);
        return { type: 'FeatureCollection' as const, features: [] };
      }),
    ]);

    const riskByUnitId = new Map<string, SlopeUnitFeature>();
    (riskData.features || []).forEach((f) => {
      if (f.properties?.slope_unit_id) {
        riskByUnitId.set(f.properties.slope_unit_id, f);
      }
    });

    // If slopeUnitsData returned features, ensure every slope unit is present
    let mergedFeatures: SlopeUnitFeature[] = [];

    if (slopeUnitsData.features && slopeUnitsData.features.length > 0) {
      mergedFeatures = slopeUnitsData.features.map((suFeature) => {
        const suId = suFeature.properties?.slope_unit_id;
        const riskFeature = suId ? riskByUnitId.get(suId) : undefined;

        if (riskFeature) {
          // Merge terrain metadata with authoritative risk properties
          return {
            ...suFeature,
            id: suId,
            geometry: suFeature.geometry || riskFeature.geometry,
            properties: {
              ...suFeature.properties,
              ...riskFeature.properties,
              // Apply any local review overrides
              ...(suId && localOverrides[suId] ? localOverrides[suId] : {}),
            },
          };
        }

        // Unit not assessed yet
        return {
          ...suFeature,
          id: suId,
          properties: {
            ...suFeature.properties,
            risk_level: null, // "Not assessed"
            verification_status: 'PENDING_VERIFICATION',
            ...(suId && localOverrides[suId] ? localOverrides[suId] : {}),
          },
        };
      });

      // Also add any risk features that weren't in slope-units
      (riskData.features || []).forEach((rf) => {
        const rfId = rf.properties?.slope_unit_id;
        if (rfId && !mergedFeatures.some((mf) => mf.properties?.slope_unit_id === rfId)) {
          mergedFeatures.push(rf);
        }
      });
    } else {
      // Use risk features directly
      mergedFeatures = riskData.features || [];
    }

    return {
      riskDashboard: riskData,
      slopeUnits: slopeUnitsData,
      mergedFeatures,
    };
  },

  /**
   * 4. ML Predictions
   */
  getPredictions: async (): Promise<MLPrediction[]> => {
    return JSON.parse(JSON.stringify(predictionsSample.predictions)) as MLPrediction[];
  },

  /**
   * 5. Terrain data
   */
  getTerrainData: async () => {
    return JSON.parse(JSON.stringify(terrainSample));
  },

  /**
   * 6. Human Officer Verification Action (Updates local triage state)
   */
  updateVerificationStatus: async (
    id: string,
    status: VerificationStatus,
    officerName: string = 'Officer L. Ralte (NDMA Field Geotechnical)',
    notes?: string
  ): Promise<SlopeUnitFeature['properties']> => {
    localOverrides[id] = {
      ...localOverrides[id],
      verification_status: status,
      verified_by: officerName,
      verified_at: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' IST',
      ...(notes ? { officer_notes: notes } : {}),
    };

    notifyListeners();
    return localOverrides[id] as SlopeUnitFeature['properties'];
  },

  /**
   * 7. Alert Authorization Action (Prepares OASIS CAP 1.2 XML payload)
   */
  authorizeAlert: async (
    id: string,
    officerName: string = 'Authorized District Officer'
  ): Promise<CapAlertMessage> => {
    localOverrides[id] = {
      ...localOverrides[id],
      authorized: true,
      authorized_at: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' IST',
    };

    const capMessage: CapAlertMessage = {
      identifier: `CAP-IN-MZ-AIZ-${id}-${Date.now().toString().slice(-6)}`,
      sender: 'ndma-operations@nic.in',
      sent: new Date().toISOString(),
      status: 'AUTHORIZED',
      msgType: 'Alert',
      scope: 'Public',
      event: 'Landslide Warning',
      urgency: 'Immediate',
      severity: 'Severe',
      certainty: 'Observed',
      areaDesc: `Aizawl District, Mizoram - Sector ${id}`,
      headline: `NDMA LANDSLIDE WARNING: Slope instability verified for Sector ${id}`,
      description: `Geotechnical monitoring and verified sensor telemetry indicate critical slope threshold crossed. Precautionary transit diversion and designated evacuation advised.`,
      instruction: 'Do not approach designated downslope ravines. Follow local SDRF and District Disaster Management Authority evacuation directions.',
      slopeUnitId: id,
      riskLevel: 'HIGH',
      targetPopulation: 'Downslope residential and transit corridor',
    };

    notifyListeners();
    return capMessage;
  },

  /**
   * Backward-compatibility helper for legacy components
   */
  getSlopeUnits: async (): Promise<SlopeUnit[]> => {
    const { mergedFeatures } = await api.getMergedSlopeUnits('aizawl').catch(() => {
      // Fallback
      return {
        mergedFeatures: riskCurrentSample.features as unknown as SlopeUnitFeature[],
        riskDashboard: riskCurrentSample as unknown as RiskDashboardResponse,
        slopeUnits: terrainSample as unknown as SlopeUnitsResponse,
      };
    });

    return mergedFeatures.map((f) => {
      const p = f.properties || ({} as any);
      const coords = (f.geometry?.coordinates?.[0] || []) as [number, number][];
      const lons = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      const centerLon = lons.length ? lons.reduce((a, b) => a + b, 0) / lons.length : 92.72;
      const centerLat = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : 23.73;

      const prob = p.probability != null ? (p.probability <= 1 ? Math.round(p.probability * 100) : Math.round(p.probability)) : 0;

      return {
        slope_unit_id: p.slope_unit_id,
        name: p.ward_name || `Sector ${p.slope_unit_id}`,
        ridge: `${p.ward_name || p.slope_unit_id} Ridge Sector`,
        risk_level: p.risk_level ?? null, // Can be null for not assessed!
        failure_probability: prob,
        population: p.exposure_summary?.estimated_population ?? 0,
        buildings: p.exposure_summary?.buildings_count ?? 0,
        verification_status: p.verification_status || 'PENDING_VERIFICATION',
        rainfall_mm: 84,
        soil_wetness: 80,
        drivers: p.why || [],
        coordinates: coords,
        centroid: [centerLon, centerLat],
        slopeGradientDeg: p.mean_slope_deg || 34,
        area_ha: p.area_ha,
        mean_slope_deg: p.mean_slope_deg,
        susceptibility_score: p.susceptibility_score,
        verificationNotes: p.officer_notes,
        verifiedBy: p.verified_by,
        verifiedAt: p.verified_at,
        authorized: p.authorized,
        authorizedAt: p.authorized_at,
      };
    });
  },
};
