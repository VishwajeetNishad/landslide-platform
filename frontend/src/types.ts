export type NavigationTab = 
  | 'overview'
  | 'monitoring'
  | 'analytics'
  | 'risk-map'
  | 'verification-queue'
  | 'alerts-decisions'
  | 'history'
  | 'reports'
  | 'settings'
  | 'admin'
  | 'dashboard'; // alias for overview

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | null;

export type VerificationStatus = 
  | 'PENDING_VERIFICATION'
  | 'CONFIRMED'
  | 'FALSE_POSITIVE'
  | 'NEEDS_REVIEW';

// Exact Risk Dashboard JSON Contract Types
export interface RiskDashboardMeta {
  district?: string;
  district_id?: string;
  district_name?: string;
  run_ts: string;
  valid_from?: string;
  valid_to?: string;
  model_version: string;
  is_demo_data: boolean;
}

export interface RiskDashboardSummary {
  total_slope_units: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  high_risk_exposed_population?: number;
  pending_verification_count?: number;
  lead_time_hours?: number;
}

export interface SlopeUnitContributingFactor {
  feature: string;
  contribution: number;
}

export interface SlopeUnitRisk {
  slope_unit_id: string;
  ward_name: string;
  risk_level: RiskLevel;
  failure_probability: number;
  susceptibility_score: number;
  exposed_population: number;
  critical_infrastructure_count: number;
  top_contributing_factors?: SlopeUnitContributingFactor[];
  verification_status: VerificationStatus;
  verified_by?: string | null;
  verified_at?: string | null;
  verification_notes?: string | null;
}

export interface ExposureSummary {
  estimated_population: number;
  buildings_count: number;
  road_metres: number;
  critical_facility_count: number;
}

export interface DataQuality {
  nearest_gauge_km: number;
  rainfall_confidence: 'HIGH' | 'MODERATE' | 'LOW';
  label: string;
}

export interface SnakeLineCriticalCurvePoint {
  x: number;
  y: number;
}

export interface SnakeLineTrajectoryPoint {
  ts: string;
  x: number;
  y: number;
  crossed: boolean;
  is_forecast: boolean;
}

export interface SnakeLineData {
  x_label: string;
  y_label: string;
  critical_curve: SnakeLineCriticalCurvePoint[];
  trajectory: SnakeLineTrajectoryPoint[];
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface SlopeUnitProperties {
  slope_unit_id: string;
  ward_name?: string;
  area_ha?: number;
  mean_slope_deg?: number;
  susceptibility_score?: number;
  probability?: number; // e.g. 0.72
  confidence_lower?: number; // e.g. 0.58
  confidence_upper?: number; // e.g. 0.84
  risk_level?: RiskLevel;
  verification_status?: VerificationStatus;
  exposure_summary?: ExposureSummary;
  why?: string[];
  counterfactual?: string;
  data_quality?: DataQuality;
  has_field_report?: boolean;
  field_report_count?: number;
  runout_envelope?: GeoJsonPolygon | null;
  snake_line?: SnakeLineData | null;
  // Local state extensions for demo review actions
  officer_notes?: string;
  verified_by?: string;
  verified_at?: string;
  authorized?: boolean;
  authorized_at?: string;
}

export interface SlopeUnitFeature {
  type: 'Feature';
  id?: string;
  geometry: GeoJsonPolygon;
  properties: SlopeUnitProperties;
}

export interface RiskDashboardResponse {
  type?: 'FeatureCollection';
  meta: RiskDashboardMeta;
  summary: RiskDashboardSummary;
  features?: SlopeUnitFeature[];
  data?: SlopeUnitRisk[];
}

// Slope Units GeoJSON endpoint response from /api/v1/slope-units?district=aizawl
export interface SlopeUnitsResponse {
  type: 'FeatureCollection';
  features: SlopeUnitFeature[];
  meta?: Partial<RiskDashboardMeta>;
}

// ML Prediction JSON Contract
export interface MLDriver {
  feature: string;
  shap_value: number;
}

export interface MLPrediction {
  slope_unit_id: string;
  valid_from?: string;
  valid_to?: string;
  susceptibility_score: number;
  probability: number;
  confidence_lower?: number;
  confidence_upper?: number;
  tank_state?: {
    S1: number;
    S2: number;
    S3: number;
    SWI: number;
  };
  rainfall?: {
    observed_24h: number;
    forecast_24h: number;
    fraction_of_map: number;
  };
  drivers?: MLDriver[];
  counterfactual?: string;
  data_quality?: DataQuality;
  runout?: {
    available: boolean;
    length_m?: number;
    area_sqm?: number;
  };
  exposure?: ExposureSummary;
}

// Slope Unit Terrain GeoJSON Properties
export interface SlopeUnitTerrainProperties {
  slope_unit_id: string;
  ward_name: string;
  area?: string;
  mean_slope?: string;
  maximum_slope?: string;
  relief?: string;
  twi?: string;
  lithology?: string;
  land_cover?: string;
  geological_province?: string;
  distance_to_road?: string;
  road_cut?: string;
  mean_annual_precipitation?: string;
  area_ha?: number;
  mean_slope_deg?: number;
  susceptibility_score?: number;
}

export interface SlopeUnitTerrainFeature {
  type: 'Feature';
  id?: string;
  properties: SlopeUnitTerrainProperties;
  geometry: GeoJsonPolygon;
}

export interface SlopeUnit {
  slope_unit_id: string; // e.g. 'AZ-1088'
  name: string; // e.g. 'Durtlang North Escarpment'
  ridge: string; // e.g. 'Durtlang - Selesih Ridge'
  risk_level: RiskLevel; // MANDATORY: model/backend authoritative (probability * consequence)
  failure_probability: number; // ML failure probability % (e.g. 95)
  population: number; // Potential exposure, e.g. 0 or 75
  buildings: number; // Exposed structures, e.g. 0 or 12
  verification_status: VerificationStatus;
  rainfall_mm: number; // Recent short-term cumulative rainfall
  soil_wetness: number; // Long-term soil wetness index (%)
  drivers: string[]; // Geological and precipitation drivers
  coordinates: [number, number][]; // [lon, lat] coordinates defining polygon
  centroid: [number, number]; // [lon, lat] center
  tankSoilWaterIndex?: {
    tank1Surface: number; // mm
    tank2Intermediate: number; // mm
    tank3Deep: number; // mm
    totalSwi: number; // mm
  };
  slopeGradientDeg: number;
  area_ha?: number;
  mean_slope_deg?: number;
  susceptibility_score?: number;
  verificationNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  authorized?: boolean;
  authorizedAt?: string;
}

export interface SnakeChartPoint {
  timeStep: string;
  hour: string;
  shortTermRainfall: number; // mm
  longTermSoilWetness: number; // %
  isObserved: boolean;
  crossed?: boolean;
}

export interface CapAlertMessage {
  identifier: string;
  sender: string;
  sent: string;
  status: 'AUTHORIZED' | 'PENDING' | 'DISPATCHED';
  msgType: 'Alert';
  scope: 'Public';
  event: string;
  urgency: 'Immediate' | 'Expected';
  severity: 'Severe' | 'Moderate' | 'Minor';
  certainty: 'Observed' | 'Likely';
  areaDesc: string;
  headline: string;
  description: string;
  instruction: string;
  slopeUnitId: string;
  riskLevel: RiskLevel;
  targetPopulation: string;
}

export type UserRole = 'super-admin' | 'state-lead' | 'field-officer' | 'observer';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  designation: string;
  clearanceLevel: number;
  badgeNumber: string;
  stateZone: string;
  lastActive?: string;
  status?: 'Active' | 'On Leave' | 'Suspended';
}

export interface StateSurveillance {
  state: string;
  code: string;
  riskScore: number;
  status: 'Critical' | 'Elevated' | 'Moderate' | 'Nominal';
  activeSensors: number;
  totalSensors: number;
  ndrfBattalion: string;
  evacuationStatus: 'Standby' | 'Enforced' | 'None';
  rainfall24h: number;
  lastIncidentReport: string;
}

export interface DronePatrol {
  id: string;
  callsign: string;
  sector: string;
  state: string;
  battery: number;
  status: 'Airborne' | 'Charging' | 'Deploying' | 'Telemetry Sync';
  cameraFeedActive: boolean;
  assignedOperator: string;
  gpsCoords: string;
}

export interface SystemAuditLog {
  id: string;
  timestamp: string;
  officer: string;
  role: string;
  action: string;
  module: string;
  status: 'Authorized' | 'Flagged' | 'System Override';
  ipAddress: string;
}

export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Elevated';

export interface RiskMarker {
  id: string;
  name: string;
  state: string;
  lat: number;
  long: number;
  severity: 'High' | 'Medium' | 'Low';
  probability: number;
  currentRainfall: string;
  soilCondition: string;
  slopeAngle: string;
  lastUpdate: string;
  xPercent: number; // For map positioning
  yPercent: number;
  isConfirmed?: boolean;
}

export interface AlertItem {
  id: string;
  alertId: string;
  location: string;
  state: string;
  timestamp: string;
  probability: number;
  severity: 'High' | 'Medium' | 'Low';
  status: 'Active' | 'Under Review' | 'Dispatched' | 'Resolved';
}

export interface SensorNode {
  id: string;
  code: string;
  location: string;
  state: string;
  status: 'Elevated Risk' | 'Nominal' | 'Alert' | 'Offline';
  rainfall: number; // mm/hr
  soilMoisture: number; // %
  surfaceDisplacement?: number; // mm
  tiltSlope?: number; // deg
  porePressure?: number; // kPa
  lastUpdate: string;
}

export interface PredictionItem {
  id: string;
  location: string;
  state: string;
  predictedDate: string;
  riskLevel: 'Critical' | 'Elevated' | 'Low' | 'Medium';
  probability: number;
  confidence: 'High' | 'Medium' | 'Low';
  rainfallMm: number;
  status: 'Pending' | 'Confirmed True' | 'Marked False' | 'Under Verification';
}

export interface HistoricalIncident {
  id: string;
  incidentId: string;
  date: string;
  location: string;
  districtState: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  cause: string;
  predictionStatus: 'Predicted' | 'Unpredicted';
  impact: string;
}

export interface GeneratedReport {
  id: string;
  title: string;
  category: 'Incident Analysis' | 'Monthly Summary' | 'Risk Audit' | 'Sensor Health';
  status: 'Completed' | 'Generating' | 'Scheduled';
  dateOrStarted: string;
  authorOrFrequency: string;
  progressPercent?: number;
}

export type SlopeUnitFeatureCollection = SlopeUnitsResponse;
export interface IncidentHistoryItem {
  id: string;
  location: string;
  state: string;
  date: string;
  type: string;
  rainfallTrigger: string;
  impact: string;
}

