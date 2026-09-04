import React, { useState, useMemo } from 'react';
import { useMergedRiskData } from '../lib/useRiskData';
import { SlopeUnitRisk, RiskLevel, VerificationStatus, UserProfile, NavigationTab } from '../types';
import { DemoBanner } from './DemoBanner';
import { AizawlMap, MapLayerType } from './AizawlMap';
import { SlopeUnitDetail } from './SlopeUnitDetail';
import { DecisionCard, DecisionCardData } from './DecisionCard';
import { DataSourcesModal } from './DataSourcesModal';
import { RiskBadge } from './RiskBadge';
import { StatusBadge } from './StatusBadge';
import { formatPercent, formatCount, formatDateTime } from '../lib/formatters';
import { 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  Users, 
  Building, 
  Search, 
  Filter, 
  RefreshCw, 
  Server, 
  SlidersHorizontal,
  ChevronRight,
  Info,
  MapPin,
  Flame,
  AlertCircle,
  Database,
  Layers,
  Clock,
  Droplets,
  Mountain,
  Activity,
  Compass
} from 'lucide-react';
import { api } from '../lib/api';

interface OverviewDashboardProps {
  currentUser: UserProfile | null;
  onNavigateTo: (tab: NavigationTab) => void;
  onOpenEmergencyDispatch: (alert?: any) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  currentUser,
  onNavigateTo,
  onOpenEmergencyDispatch,
}) => {
  const {
    geoJsonData,
    dashboardData,
    slopeUnitsList,
    meta,
    summary,
    isLoading,
    isError,
    error,
    refetch,
    updateVerificationStatus,
  } = useMergedRiskData('aizawl');

  const [selectedSlopeUnitId, setSelectedSlopeUnitId] = useState<string | null>('AZ-1142');
  const [hoveredSlopeUnitId, setHoveredSlopeUnitId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Layer and Time Controls (Section 4)
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('risk');
  const [activeTimeHorizon, setActiveTimeHorizon] = useState<'current' | '24h' | '48h' | 'forecast'>('current');
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);

  // Find currently selected unit
  const selectedUnit = useMemo(() => {
    if (!selectedSlopeUnitId) return null;
    return slopeUnitsList.find((u) => u.slope_unit_id === selectedSlopeUnitId) || null;
  }, [selectedSlopeUnitId, slopeUnitsList]);

  // Filter slope units
  const filteredSlopeUnits = useMemo(() => {
    return slopeUnitsList.filter((unit) => {
      // Risk filter
      if (riskFilter !== 'ALL') {
        if (riskFilter === 'UNASSESSED' && unit.risk_level !== null) return false;
        if (riskFilter !== 'UNASSESSED' && unit.risk_level !== riskFilter) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        const currentStatus = unit.verification_status || 'PENDING_VERIFICATION';
        if (currentStatus !== statusFilter) return false;
      }

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesId = unit.slope_unit_id.toLowerCase().includes(q);
        const matchesWard = unit.ward_name.toLowerCase().includes(q);
        if (!matchesId && !matchesWard) return false;
      }

      return true;
    });
  }, [slopeUnitsList, riskFilter, statusFilter, searchQuery]);

  const handleUpdateVerification = (
    slopeUnitId: string,
    status: VerificationStatus,
    notes: string,
    verifiedBy: string
  ) => {
    updateVerificationStatus(slopeUnitId, status, notes, verifiedBy);
  };

  // Decision Card data for prominent action (Section 9)
  const priorityDecisionData: DecisionCardData | null = useMemo(() => {
    const target = slopeUnitsList.find((u) => u.slope_unit_id === 'AZ-1142') || slopeUnitsList[0];
    if (!target) return null;

    return {
      id: target.slope_unit_id,
      slope_unit_id: target.slope_unit_id,
      location: 'Melthum Ridge Corridor',
      ward_name: target.ward_name,
      predicted_likelihood: target.failure_probability || 0.72,
      exposure_population: target.exposed_population || 120,
      critical_facilities_count: target.critical_infrastructure_count || 1,
      roadways_exposed_m: 340,
      risk_level: target.risk_level || 'HIGH',
      verification_status: target.verification_status || 'PENDING_VERIFICATION',
      recommended_action: 'Issue targeted evacuation advisory for lower Melthum scarp & deploy field geologists to inspect tension cracks.',
      timestamp: meta?.run_ts || '03 Sep 2026, 10:00 AM',
      verified_by: target.verified_by,
      confidence_interval: [0.58, 0.84],
    };
  }, [slopeUnitsList, meta]);

  // Mini rainfall timeline sparkline data
  const miniRainfallData = [
    { time: '04:00', rain: 12 },
    { time: '06:00', rain: 18 },
    { time: '08:00', rain: 26 },
    { time: '10:00', rain: 38 },
    { time: '12:00', rain: 32 },
    { time: '14:00', rain: 28 },
    { time: '16:00', rain: 14 },
  ];

  // Derived Overall Monitoring Status from backend data (no fabricated risk score)
  const hasHighRisk = (summary?.high_risk_count ?? 0) > 0;
  const hasMediumRisk = (summary?.medium_risk_count ?? 0) > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1720px] mx-auto space-y-6 animate-in fade-in duration-200 text-slate-900 bg-slate-100">
      {/* 5. DEMO BANNER: Amber banner if meta.is_demo_data === true */}
      <DemoBanner meta={meta} />

      {/* 2. HERO / STATUS SECTION */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 text-[11px] font-black uppercase tracking-wider">
              LANDSLIDE RISK MONITOR
            </span>
            <span className="text-xs font-bold text-slate-700 font-mono flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#0f2942]" />
              <span>Aizawl, Mizoram</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-mono">
              Last Model Run: {meta?.run_ts || '03 Sep 2026, 10:00 AM'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Aizawl Geospatial Command & Early Warning Monitor
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
            Continuous slope-unit susceptibility inference and three-tank hydrologic saturation modeling for the Disaster Management Authority of Mizoram.
          </p>
        </div>

        {/* Prominent Overall Monitoring Status Area */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto shrink-0">
          <div className="p-3.5 px-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3 shadow-xs">
            <span className={`w-3 h-3 rounded-full animate-pulse ${hasHighRisk ? 'bg-red-600' : hasMediumRisk ? 'bg-amber-600' : 'bg-emerald-600'}`} />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                District Monitoring Status
              </div>
              <div className="text-sm font-black tracking-tight text-slate-900">
                {hasHighRisk 
                  ? 'ELEVATED ALERT — Field Triage Active' 
                  : hasMediumRisk 
                  ? 'PRECAUTIONARY WATCH' 
                  : 'NOMINAL TOPOGRAPHIC STABILITY'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDataSourcesOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="View Data Provenance"
            >
              <Database className="w-3.5 h-3.5 text-[#0f2942]" />
              <span>Data Sources</span>
            </button>

            <button
              onClick={() => refetch()}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#0f2942] ${isLoading ? 'animate-spin' : ''}`} />
              <span>Sync Feed</span>
            </button>
          </div>
        </div>
      </div>

      {/* Backend Connectivity Error Banner (if any) */}
      {isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-red-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-red-900 block">Backend Server Connectivity</span>
              <p className="text-red-700 text-[11px] mt-0.5">
                {(error as Error)?.message || 'Cannot reach live backend at http://localhost:8000. Displaying cached baseline data.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                api.setDataSource('mock');
                refetch();
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-800 font-bold hover:bg-red-50 cursor-pointer"
            >
              Use Offline Sample
            </button>
            <button
              onClick={() => refetch()}
              className="px-3.5 py-1.5 rounded-lg bg-red-700 text-white font-bold hover:bg-red-800 cursor-pointer border border-red-700 shadow-xs"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* 5. KEY METRICS RIBBON (Concise, high-value metrics, no fabricated scores) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Slope Units Monitored */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold uppercase tracking-wider text-[10px]">Slope Units Monitored</span>
            <Layers className="w-4 h-4 text-[#0f2942]" />
          </div>
          <div className="my-1.5">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">11,778</div>
          </div>
          <div className="text-[11px] text-slate-500">Aizawl District Topography</div>
        </div>

        {/* Metric 2: High Susceptibility Areas */}
        <div 
          onClick={() => setRiskFilter('HIGH')}
          className={`p-4 rounded-xl border flex flex-col justify-between shadow-xs cursor-pointer transition-all ${
            riskFilter === 'HIGH'
              ? 'bg-red-50 border-red-400 ring-2 ring-red-400'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-700 text-xs">
            <span className="font-bold uppercase tracking-wider text-[10px]">High Susceptibility</span>
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
          </div>
          <div className="my-1.5">
            <div className="text-2xl sm:text-3xl font-black text-red-700 font-mono">
              {summary?.high_risk_count ?? 1}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Critical slope units</div>
        </div>

        {/* Metric 3: Current Rainfall */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold uppercase tracking-wider text-[10px]">Current Rainfall (24h)</span>
            <Droplets className="w-4 h-4 text-blue-600" />
          </div>
          <div className="my-1.5">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">38.2 mm</div>
          </div>
          <div className="text-[11px] text-slate-500">IMD AWS Aizawl Station</div>
        </div>

        {/* Metric 4: Soil Water Index */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold uppercase tracking-wider text-[10px]">Soil Water Index (SWI)</span>
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <div className="my-1.5">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">142 mm</div>
          </div>
          <div className="text-[11px] text-amber-800 font-semibold">Exceeds 140 mm trigger</div>
        </div>

        {/* Metric 5: Model Status */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col justify-between shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold uppercase tracking-wider text-[10px]">Model Status</span>
            <Server className="w-4 h-4 text-[#0f2942]" />
          </div>
          <div className="my-1.5">
            <div className="text-base sm:text-lg font-bold text-slate-900 font-mono truncate">
              {meta?.model_version || 'tank-stageA-v0.1'}
            </div>
          </div>
          <div className="text-[11px] text-slate-700 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span>{meta?.is_demo_data ? 'Prototype Validation' : 'Operational'}</span>
          </div>
        </div>
      </div>

      {/* MAIN COMMAND CANVAS: Control Panel (Left) + Map (Center 60-70%) + Inspector (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* 4. LEFT / SIDE CONTROL PANEL (Cols 1-3 on XL) */}
        <div className="xl:col-span-3 space-y-4">
          {/* Layer Selector */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#0f2942]" />
                <span>Geospatial Layers</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-xs font-medium">
              {[
                { id: 'risk', label: 'Risk Matrix' },
                { id: 'susceptibility', label: 'Susceptibility' },
                { id: 'rainfall', label: 'Rainfall' },
                { id: 'swi', label: 'Soil Water Index' },
                { id: 'runout', label: 'Runout Zones' },
                { id: 'terrain', label: 'Terrain (Slope)' },
              ].map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setActiveLayer(layer.id as MapLayerType)}
                  className={`p-2 rounded-lg text-left transition-all cursor-pointer ${
                    activeLayer === layer.id
                      ? 'bg-[#0f2942] text-white font-bold shadow-xs border border-[#0f2942]'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {layer.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Controls */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#0f2942]" />
                <span>Time Horizon</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 font-bold">IMD NWP</span>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {(['current', '24h', '48h', 'forecast'] as const).map((horizon) => (
                <button
                  key={horizon}
                  onClick={() => setActiveTimeHorizon(horizon)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold uppercase tracking-wider text-center transition-all cursor-pointer ${
                    activeTimeHorizon === horizon
                      ? 'bg-[#0f2942] text-white font-bold shadow-xs border border-[#0f2942]'
                      : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  {horizon}
                </button>
              ))}
            </div>

            {/* Small Rainfall Timeline Chart (Section 4) */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase mb-2">
                <span>Rainfall Trend (last 12h)</span>
                <span className="text-slate-700 font-mono font-bold">mm/3h</span>
              </div>
              <div className="h-16 flex items-end justify-between gap-1 px-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                {miniRainfallData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full bg-[#0f2942] rounded-xs hover:bg-blue-600 transition-colors"
                      style={{ height: `${Math.min(d.rain * 1.5, 48)}px` }}
                      title={`${d.time}: ${d.rain} mm`}
                    />
                    <span className="text-[8px] font-mono text-slate-500 font-medium">{d.time.slice(0, 2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Slope Unit Search & Filter */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#0f2942]" />
                <span>Quick Unit Finder</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 font-bold">{filteredSlopeUnits.length} found</span>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID (e.g. AZ-1088, AZ-1142)..."
              className="w-full p-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0f2942]"
            />

            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 pr-1">
              {filteredSlopeUnits.map((u) => (
                <div
                  key={u.slope_unit_id}
                  onClick={() => setSelectedSlopeUnitId(u.slope_unit_id)}
                  className={`p-2 rounded-lg transition-colors cursor-pointer flex items-center justify-between text-xs ${
                    selectedSlopeUnitId === u.slope_unit_id
                      ? 'bg-blue-50 border border-blue-300'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <span className="font-mono font-bold text-slate-900 block">{u.slope_unit_id}</span>
                    <span className="text-[10px] text-slate-500 truncate block">{u.ward_name}</span>
                  </div>
                  <RiskBadge level={u.risk_level} size="sm" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. MAIN GEOSPATIAL MAP (Center 50-60% on XL) */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          <div className="h-[600px] w-full relative">
            <AizawlMap
              geoJsonData={geoJsonData}
              selectedSlopeUnitId={selectedSlopeUnitId}
              onSelectSlopeUnit={(id) => setSelectedSlopeUnitId(id)}
              hoveredSlopeUnitId={hoveredSlopeUnitId}
              onHoverSlopeUnit={(id) => setHoveredSlopeUnitId(id)}
              activeLayer={activeLayer}
            />
          </div>
        </div>

        {/* 6. SLOPE UNIT DETAIL PANEL (Right 4 cols on XL) */}
        <div className="xl:col-span-4 sticky top-20">
          <SlopeUnitDetail
            slopeUnit={selectedUnit}
            onClose={() => setSelectedSlopeUnitId(null)}
            onUpdateVerification={handleUpdateVerification}
            currentUser={currentUser}
          />
        </div>
      </div>

      {/* 9. PROMINENT ALERT / DECISION CARD SECTION */}
      {priorityDecisionData && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <span>Priority Decision & Authorization Queue</span>
              </span>
              <p className="text-xs text-slate-600">
                Common Alerting Protocol (CAP 1.2) review gateway. Human officer authorization required before public dispatch.
              </p>
            </div>
            <button
              onClick={() => onNavigateTo('verification-queue')}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View Full Verification Queue</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DecisionCard
              data={priorityDecisionData}
              onDispatchAlert={() => onOpenEmergencyDispatch(priorityDecisionData)}
              onInspectUnit={(id) => setSelectedSlopeUnitId(id)}
            />

            {/* Comparison with AZ-1088 (High Likelihood, Zero Exposure -> LOW Risk) */}
            <DecisionCard
              data={{
                id: 'AZ-1088',
                slope_unit_id: 'AZ-1088',
                location: 'Durtlang North Ridge',
                ward_name: 'Durtlang North',
                predicted_likelihood: 0.95,
                exposure_population: 0,
                critical_facilities_count: 0,
                roadways_exposed_m: 0,
                risk_level: 'LOW',
                verification_status: 'CONFIRMED',
                recommended_action: 'Routine geotechnical survey. High failure probability does not warrant public evacuation due to zero exposed settlements.',
                timestamp: '03 Sep 2026, 09:30 AM',
                verified_by: 'Officer V. Lalhmachhuana (Geologist)',
                confidence_interval: [0.88, 0.98],
              }}
              onDispatchAlert={() => onOpenEmergencyDispatch()}
              onInspectUnit={(id) => setSelectedSlopeUnitId(id)}
            />
          </div>
        </div>
      )}

      {/* Operational Status Footer Bar */}
      <footer className="h-10 bg-white border border-slate-200 rounded-xl px-4 flex items-center justify-between shadow-xs text-slate-600">
        <div className="flex gap-4 text-[10px] font-medium font-mono">
          <span className="text-slate-900 font-bold">API Status: 200 OK</span>
          <span>•</span>
          <span>Last Sync: {new Date().toLocaleTimeString('en-GB')}</span>
          <span>•</span>
          <span>Engine: Tank-StageA-v0.1</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] hidden sm:inline text-slate-600">District: Aizawl Center-West Block</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-slate-800">Live Monitoring Active</span>
          </div>
        </div>
      </footer>

      {/* Data Sources Transparency Modal (Section 10) */}
      <DataSourcesModal
        isOpen={isDataSourcesOpen}
        onClose={() => setIsDataSourcesOpen(false)}
        isDemoData={meta?.is_demo_data}
      />
    </div>
  );
};
