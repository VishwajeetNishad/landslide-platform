import React, { useState } from 'react';
import { 
  Radio, 
  RefreshCw, 
  MapPin, 
  Plus, 
  Minus, 
  Check, 
  AlertTriangle 
} from 'lucide-react';
import { TELEMETRY_MAP_URL } from '../data/mockData';

export const MonitoringView: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('Just now');
  const [mapZoom, setMapZoom] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSyncData = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSyncTime(new Date().toLocaleTimeString());
      setToastMessage('Aizawl rain gauges and telemetry synchronized with AWS network.');
      setTimeout(() => setToastMessage(null), 3000);
    }, 1000);
  };

  const displacementBars = [
    { height: 10, isAlert: false },
    { height: 15, isAlert: false },
    { height: 12, isAlert: false },
    { height: 20, isAlert: false },
    { height: 25, isAlert: false },
    { height: 40, isAlert: false },
    { height: 75, isAlert: true },
    { height: 85, isAlert: true },
    { height: 60, isAlert: false },
    { height: 30, isAlert: false },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-200 text-slate-800">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#0f2942] text-white text-xs px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2">
          <Check className="w-4 h-4 text-[#FF9933]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="px-3 py-1 bg-slate-100 text-[#0f2942] text-xs font-bold rounded-full border border-slate-200 uppercase tracking-wider inline-block mb-2">
            Aizawl Sensor Network
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
            Geotechnical & Meteorological Telemetry
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Real-time subsurface inclinometer, piezometer, and rain gauge telemetry from monitoring stations across Aizawl District.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>14 Automated Stations Online</span>
          </span>
          <button
            onClick={handleSyncData}
            className="px-4 py-2 bg-[#0f2942] hover:bg-[#163859] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync Grid Telemetry</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Priority Station: Node AZL-MELTHUM-01 */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-xs">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0f2942] shrink-0 shadow-xs">
                  <Radio className="w-5 h-5 text-[#0f2942]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Station AZL-MEL-01 (Priority Sentinel)
                  </h2>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Melthum Escarpment Corridor, Sector AZ-1142, Aizawl</span>
                  </p>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-rose-100 border border-rose-200 text-rose-800 text-xs font-bold mb-1">
                  Elevated Slope Strain
                </span>
                <p className="text-[11px] text-slate-500">Last sync: {lastSyncTime}</p>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Rainfall Intensity
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900">42.5</span>
                  <span className="text-xs text-slate-500 font-semibold">mm/hr</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Soil Water Index
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900">142</span>
                  <span className="text-xs text-slate-500 font-semibold">mm</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Surface Disp.
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900">1.2</span>
                  <span className="text-xs text-slate-500 font-semibold">mm</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Tilt / Inclinometer
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900">0.05</span>
                  <span className="text-xs text-slate-500 font-semibold">deg</span>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Stations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Station AZL-DURT-02</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Durtlang North Ridge (AZ-1088)</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold">
                  Nominal Exposure
                </span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Precipitation Rate</span>
                  <span className="font-bold text-slate-900 font-mono">18.0 mm/hr</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Soil Moisture Saturation</span>
                  <span className="font-bold text-slate-900 font-mono">82 %</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Pore Water Pressure</span>
                  <span className="font-bold text-slate-900 font-mono">22 kPa</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Station AZL-BAWNG-03</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Bawngkawn Road Cut (AZ-1147)</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                  Medium Risk
                </span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Precipitation Rate</span>
                  <span className="font-bold text-slate-900 font-mono">24.5 mm/hr</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Soil Moisture Saturation</span>
                  <span className="font-bold text-slate-900 font-mono">74 %</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Pore Water Pressure</span>
                  <span className="font-bold text-slate-900 font-mono">18 kPa</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Mini-Map & Node Health */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-[280px] shadow-xs">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Aizawl AWS Gauges</h3>
              <span className="text-[11px] font-mono text-slate-500 font-bold">14 Active in District</span>
            </div>
            <div className="flex-1 relative w-full h-full overflow-hidden">
              <div
                className="w-full h-full bg-cover bg-center transition-transform duration-300"
                style={{
                  backgroundImage: `url('${TELEMETRY_MAP_URL}')`,
                  transform: `scale(${mapZoom})`,
                }}
              />
              <div className="absolute right-3 bottom-3 flex flex-col gap-1.5">
                <button
                  onClick={() => setMapZoom((prev) => Math.min(prev + 0.2, 1.8))}
                  className="w-8 h-8 bg-white border border-slate-300 shadow-sm rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Zoom in"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setMapZoom((prev) => Math.max(prev - 0.2, 0.9))}
                  className="w-8 h-8 bg-white border border-slate-300 shadow-sm rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Zoom out"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 flex-1 flex flex-col overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Node Transmission Registry</h3>
              <span className="text-xs font-bold text-slate-500">Aizawl Sector</span>
            </div>
            <div className="divide-y divide-slate-200 overflow-y-auto text-xs">
              <div className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                  <div>
                    <p className="font-bold text-slate-900">AZL-MEL-01</p>
                    <p className="text-[11px] text-slate-500">Melthum Escarpment</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  Critical Alert
                </span>
              </div>
              <div className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <div>
                    <p className="font-bold text-slate-900">AZL-DURT-02</p>
                    <p className="text-[11px] text-slate-500">Durtlang North Ridge</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Online
                </span>
              </div>
              <div className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <div>
                    <p className="font-bold text-slate-900">AZL-BAWNG-03</p>
                    <p className="text-[11px] text-slate-500">Bawngkawn Urban Flank</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Online
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
