import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Minus, 
  Layers, 
  Compass, 
  Crosshair, 
  CloudRain, 
  Droplets, 
  Ruler, 
  Clock, 
  X, 
  Check 
} from 'lucide-react';
import { RiskMarker } from '../types';
import { INITIAL_RISK_MARKERS, SATELLITE_MAP_URL } from '../data/mockData';

interface RiskMapViewProps {
  initialSelectedMarkerId?: string | null;
  onClearInitialMarker?: () => void;
}

export const RiskMapView: React.FC<RiskMapViewProps> = ({
  initialSelectedMarkerId,
  onClearInitialMarker,
}) => {
  const [markers] = useState<RiskMarker[]>(INITIAL_RISK_MARKERS);
  const [selectedMarker, setSelectedMarker] = useState<RiskMarker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMlModelLayer, setShowMlModelLayer] = useState(true);
  const [showHistoricalLayer, setShowHistoricalLayer] = useState(true);
  const [severityFilter, setSeverityFilter] = useState({
    High: true,
    Medium: true,
    Low: true,
  });
  const [mapZoom, setMapZoom] = useState(1);
  const [mapViewMode, setMapViewMode] = useState<'satellite' | 'terrain'>('satellite');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelectedMarkerId) {
      const match = markers.find((m) => m.id === initialSelectedMarkerId);
      if (match) {
        setSelectedMarker(match);
      }
      if (onClearInitialMarker) onClearInitialMarker();
    } else if (!selectedMarker) {
      const defaultAizawl = markers.find((m) => m.id === 'aizawl-01');
      if (defaultAizawl) setSelectedMarker(defaultAizawl);
    }
  }, [initialSelectedMarkerId]);

  const filteredMarkers = markers.filter((marker) => {
    if (!severityFilter[marker.severity]) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        marker.name.toLowerCase().includes(q) ||
        marker.state.toLowerCase().includes(q) ||
        `${marker.lat},${marker.long}`.includes(q)
      );
    }
    return true;
  });

  const handleAction = (type: 'confirm' | 'false') => {
    if (!selectedMarker) return;
    const msg = type === 'confirm'
      ? `Dispatched validation: ${selectedMarker.name} verified as TRUE landslide risk.`
      : `Marked false positive for ${selectedMarker.name}. ML telemetry adjusted.`;
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden select-none bg-[#09090b] text-zinc-100">
      {/* Toast notification */}
      {feedbackToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl border border-slate-800 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Map Canvas Background */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center transition-transform duration-500 ease-out"
        style={{
          backgroundImage: `url('${SATELLITE_MAP_URL}')`,
          transform: `scale(${mapZoom})`,
        }}
      >
        <div className="absolute inset-0 bg-black/25 pointer-events-none" />
      </div>

      {/* Floating Search & Filter Panel (Left Side) */}
      <div className="absolute top-4 left-4 w-72 sm:w-80 flex flex-col gap-3 z-30">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200 p-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 ml-1.5 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search coordinates, sectors..."
            className="w-full bg-transparent border-none text-xs sm:text-sm text-slate-900 focus:outline-none placeholder:text-slate-400"
          />
          <button 
            onClick={() => setSearchQuery('')}
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
            title="Clear search"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200 p-5 text-xs text-slate-800">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
            Geospatial Multi-Layers
          </h3>
          <div className="space-y-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={showMlModelLayer}
                onChange={(e) => setShowMlModelLayer(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 bg-white text-[#0f2942] focus:ring-[#0f2942] accent-[#0f2942] cursor-pointer"
              />
              <span className="text-slate-700 group-hover:text-slate-900 font-medium">
                Predicted Risk (ML Inference Layer)
              </span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={showHistoricalLayer}
                onChange={(e) => setShowHistoricalLayer(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 bg-white text-[#0f2942] focus:ring-[#0f2942] accent-[#0f2942] cursor-pointer"
              />
              <span className="text-slate-700 group-hover:text-slate-900 font-medium">
                Historical GSI Landslide Database
              </span>
            </label>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-200">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
              Severity Level Filter
            </h3>
            <div className="space-y-1.5">
              <label className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={severityFilter.High}
                    onChange={(e) => setSeverityFilter({ ...severityFilter, High: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-slate-300 bg-white text-red-600 focus:ring-red-600 accent-red-600 cursor-pointer"
                  />
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                  <span className="text-slate-900 font-bold">High Risk</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-500">42</span>
              </label>
              <label className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={severityFilter.Medium}
                    onChange={(e) => setSeverityFilter({ ...severityFilter, Medium: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-slate-300 bg-white text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer"
                  />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-slate-700 font-semibold">Medium Risk</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-500">156</span>
              </label>
              <label className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={severityFilter.Low}
                    onChange={(e) => setSeverityFilter({ ...severityFilter, Low: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-slate-300 bg-white text-emerald-600 focus:ring-emerald-600 accent-emerald-600 cursor-pointer"
                  />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <span className="text-slate-600 font-medium">Low Risk</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-500">892</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Map Controls */}
      <div className="absolute right-4 top-4 flex flex-col gap-2 z-30">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200 flex flex-col overflow-hidden">
          <button
            onClick={() => setMapZoom((prev) => Math.min(prev + 0.25, 2.2))}
            className="p-2.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors border-b border-slate-200 cursor-pointer"
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMapZoom((prev) => Math.max(prev - 0.25, 0.9))}
            className="p-2.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200 flex flex-col overflow-hidden">
          <button
            onClick={() => setMapViewMode('satellite')}
            className={`p-2.5 transition-colors border-b border-slate-200 cursor-pointer ${
              mapViewMode === 'satellite' ? 'bg-[#0f2942] text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Satellite View"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMapViewMode('terrain')}
            className={`p-2.5 transition-colors border-b border-slate-200 cursor-pointer ${
              mapViewMode === 'terrain' ? 'bg-[#0f2942] text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Terrain Contour View"
          >
            <Compass className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setMapZoom(1);
              setSelectedMarker(markers[5] || markers[0]);
            }}
            className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Reset to Regional Center"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200 px-4 py-2.5 z-30 flex items-center gap-5 text-xs font-bold text-slate-700">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
          <span className="text-slate-900 font-bold">Critical Risk</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-slate-700">Warning / Elevated</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          <span className="text-slate-600">Nominal</span>
        </div>
      </div>

      {/* Interactive Map Markers */}
      <div className="absolute inset-0 pointer-events-none">
        {filteredMarkers.map((marker) => {
          const isSelected = selectedMarker?.id === marker.id;
          const isHigh = marker.severity === 'High';
          const isMedium = marker.severity === 'Medium';

          return (
            <div
              key={marker.id}
              style={{
                left: `${marker.xPercent}%`,
                top: `${marker.yPercent}%`,
              }}
              className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
              onClick={() => setSelectedMarker(marker)}
            >
              {isHigh ? (
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-12 h-12 bg-red-500/40 rounded-full animate-ping pointer-events-none" />
                  <div className={`w-6 h-6 bg-red-600 rounded-full border-2 border-white shadow-[0_0_12px_rgba(239,68,68,0.9)] flex items-center justify-center transition-transform ${
                    isSelected ? 'scale-125 ring-4 ring-red-500/50' : 'group-hover:scale-110'
                  }`}>
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                </div>
              ) : isMedium ? (
                <div className={`w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center border-2 border-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.8)] transition-transform ${
                  isSelected ? 'scale-125 ring-4 ring-amber-500/50' : 'group-hover:scale-110'
                }`}>
                  <div className="w-2 h-2 bg-black rounded-full" />
                </div>
              ) : (
                <div className={`w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.8)] transition-transform ${
                  isSelected ? 'scale-125 ring-4 ring-emerald-500/50' : 'group-hover:scale-110'
                }`}>
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              )}

              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-2.5 py-0.5 rounded-md shadow-lg text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-800">
                {marker.name} ({marker.severity})
              </div>
            </div>
          );
        })}

        {/* Selected Marker Popover Panel */}
        {selectedMarker && (
          <div
            style={{
              left: `min(max(${selectedMarker.xPercent}%, 180px), calc(100% - 180px))`,
              top: `min(max(${selectedMarker.yPercent}%, 200px), calc(100% - 200px))`,
            }}
            className="absolute z-40 transform -translate-x-1/2 -translate-y-full mb-4 pointer-events-auto w-[310px] sm:w-[330px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 text-slate-900"
          >
            <div className="p-4 flex justify-between items-start bg-slate-50 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    selectedMarker.severity === 'High' 
                      ? 'bg-red-100 text-red-800 border border-red-200' 
                      : selectedMarker.severity === 'Medium'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {selectedMarker.severity} Risk
                  </span>
                  <span className="text-slate-600 text-xs font-mono font-bold">
                    {selectedMarker.probability}% Probability
                  </span>
                </div>
                <h4 className="text-slate-900 text-lg font-black tracking-tight">
                  {selectedMarker.name}, {selectedMarker.state}
                </h4>
              </div>
              <button 
                onClick={() => setSelectedMarker(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white text-slate-800">
              <div className="text-[11px] font-mono text-slate-500 mb-3 pb-2 border-b border-slate-200 flex items-center justify-between font-semibold">
                <span>Lat: {selectedMarker.lat}° N</span>
                <span>Long: {selectedMarker.long}° E</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-4 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Precipitation</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <CloudRain className="w-3.5 h-3.5 text-[#0f2942]" />
                    <span>{selectedMarker.currentRainfall}</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Soil Status</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Droplets className="w-3.5 h-3.5 text-[#0f2942]" />
                    <span>{selectedMarker.soilCondition}</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Slope Angle</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Ruler className="w-3.5 h-3.5 text-[#0f2942]" />
                    <span>{selectedMarker.slopeAngle}</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Updated</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedMarker.lastUpdate}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => handleAction('confirm')}
                  className="flex-1 py-2 bg-[#0f2942] hover:bg-[#1a365d] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer text-center shadow-xs border border-[#0f2942]"
                >
                  Confirm True Risk
                </button>
                <button
                  onClick={() => handleAction('false')}
                  className="flex-1 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center shadow-xs"
                >
                  Mark False Alert
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
