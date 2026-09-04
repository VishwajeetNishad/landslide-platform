import React from 'react';
import { Database, X, CheckCircle, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';

interface DataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDemoData?: boolean;
}

export const DataSourcesModal: React.FC<DataSourcesModalProps> = ({
  isOpen,
  onClose,
  isDemoData = true,
}) => {
  if (!isOpen) return null;

  const dataSources = [
    {
      name: 'Digital Elevation Model (DEM)',
      provider: 'CartoDEM / SRTM 30m / GSI Topography',
      resolution: '30-meter ground resolution',
      purpose: 'Slope gradient, profile curvature, aspect calculation & slope unit delineation',
      status: 'Active',
      type: 'Terrain Baseline',
    },
    {
      name: 'Automatic Weather Station (AWS) Rainfall',
      provider: 'India Meteorological Department (IMD) - Aizawl Station',
      resolution: 'Hourly precipitation telemetry (mm)',
      purpose: 'Antecedent rainfall index & real-time cumulative rain logging',
      status: isDemoData ? 'Simulated Pipeline' : 'Live Feeds',
      type: 'Hydrology',
    },
    {
      name: 'Numerical Weather Prediction (NWP) Forecast',
      provider: 'IMD GFS / WRF Regional Forecast Mesh',
      resolution: '24-hour & 48-hour forward projection',
      purpose: 'Forward trajectory calculation in Soil Water Index three-tank model',
      status: isDemoData ? 'Simulated Model' : 'Operational',
      type: 'Meteorological',
    },
    {
      name: 'Geological & Landslide Inventory Baseline',
      provider: 'Geological Survey of India (GSI) North-Eastern Region & DMA Mizoram',
      resolution: 'Slope-unit partition (11,778 units)',
      purpose: 'Historical scarp density, lithological unit classification & geotechnical susceptibility',
      status: 'Active',
      type: 'Geotechnical',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white text-slate-900 border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-[#0f2942] border border-blue-200">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Data Sources &amp; Provenance</h2>
              <p className="text-xs text-slate-500">TerraGuard Operational Telemetry &amp; Baseline Geodata</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prototype Transparency Notice */}
        {isDemoData && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Prototype Notice:</strong> Simulated hydrometeorological scenarios are currently enabled for demonstration and officer review. Live operational feeds are synchronized during monsoon activations.
            </div>
          </div>
        )}

        {/* Sources List */}
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto">
          {dataSources.map((source, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{source.name}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                  {source.type}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                <span className="text-slate-500 font-medium">Provider:</span> {source.provider}
              </p>
              <p className="text-[11px] text-slate-700">
                <span className="text-slate-500 font-medium">Function:</span> {source.purpose}
              </p>
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200 text-[10px] text-slate-500">
                <span>Resolution: {source.resolution}</span>
                <span className="flex items-center gap-1 text-emerald-700 font-bold">
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                  <span>{source.status}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#0f2942] hover:bg-[#1a365d] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs"
          >
            Close Overview
          </button>
        </div>
      </div>
    </div>
  );
};
