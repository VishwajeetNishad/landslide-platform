import React, { useState } from 'react';
import { 
  Activity, 
  Sparkles, 
  MapPin, 
  Bell, 
  TrendingUp, 
  AlertTriangle, 
  Map, 
  ShieldAlert, 
  ArrowUpRight 
} from 'lucide-react';
import { NavigationTab } from '../types';

interface DashboardViewProps {
  onNavigateTo: (tab: NavigationTab) => void;
  onFocusMarkerOnMap: (markerId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTo,
  onFocusMarkerOnMap,
}) => {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  const trendData = [
    { month: 'Mar', count: 4, heightPercent: 12 },
    { month: 'Apr', count: 9, heightPercent: 22 },
    { month: 'May', count: 18, heightPercent: 42 },
    { month: 'Jun', count: 36, heightPercent: 82 },
    { month: 'Jul', count: 42, heightPercent: 96, isPeak: true },
    { month: 'Aug', count: 38, heightPercent: 88 },
    { month: 'Sep', count: 28, heightPercent: 68 },
  ];

  const liveAlerts = [
    {
      id: 'aizawl-01',
      severity: 'High',
      location: 'Melthum Urban Ridge, Aizawl',
      time: '10 mins ago',
      probability: '72%',
      severityColor: 'bg-rose-50 text-rose-700 border border-rose-200',
      dotColor: 'bg-rose-600',
    },
    {
      id: 'aizawl-02',
      severity: 'Medium',
      location: 'Bawngkawn Corridor, Aizawl',
      time: '45 mins ago',
      probability: '68%',
      severityColor: 'bg-amber-50 text-amber-800 border border-amber-200',
      dotColor: 'bg-amber-600',
    },
    {
      id: 'aizawl-03',
      severity: 'Low',
      location: 'Durtlang North (AZ-1088), Aizawl',
      time: '1 hr ago',
      probability: '95%',
      severityColor: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
      dotColor: 'bg-emerald-600',
    },
    {
      id: 'aizawl-04',
      severity: 'Low',
      location: 'Hunthar Terraced Slope, Aizawl',
      time: '2 hrs ago',
      probability: '24%',
      severityColor: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
      dotColor: 'bg-emerald-600',
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Top Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div 
          onClick={() => onNavigateTo('history')}
          className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
              Total Incidents (7D)
            </span>
            <span className="p-2.5 rounded-xl bg-slate-100 text-[#0f2942] group-hover:bg-[#0f2942] group-hover:text-white transition-colors">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">14</div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
            <TrendingUp className="w-4 h-4" />
            <span>Monsoon peak correlation active</span>
          </div>
        </div>

        {/* Card 2 */}
        <div 
          onClick={() => onNavigateTo('verification-queue')}
          className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
              Pending Verification
            </span>
            <span className="p-2.5 rounded-xl bg-slate-100 text-[#0f2942] group-hover:bg-[#0f2942] group-hover:text-white transition-colors">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">2 Sectors</div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <AlertTriangle className="w-4 h-4" />
            <span>Requires officer field triage</span>
          </div>
        </div>

        {/* Card 3 */}
        <div 
          onClick={() => onNavigateTo('risk-map')}
          className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
              Monitored Slope Units
            </span>
            <span className="p-2.5 rounded-xl bg-slate-100 text-[#0f2942] group-hover:bg-[#0f2942] group-hover:text-white transition-colors">
              <MapPin className="w-4 h-4" />
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">5 Units</div>
          </div>
          <div className="text-xs font-medium text-slate-500">
            Aizawl District Pilot Delineations
          </div>
        </div>

        {/* Card 4 - Deep Navy Highlight Card */}
        <div 
          onClick={() => onNavigateTo('alerts-decisions')}
          className="bg-[#0f2942] rounded-2xl sm:rounded-3xl p-6 text-white shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-widest uppercase text-slate-300">
              High Risk Alert
            </span>
            <span className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center group-hover:bg-[#FF9933] group-hover:text-[#0f2942] transition-colors">
              <Bell className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <div className="text-4xl font-extrabold tracking-tight text-white">AZ-1142</div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#FF9933]">
            <ShieldAlert className="w-4 h-4" />
            <span>Lead time: 10 hours to threshold</span>
          </div>
        </div>
      </div>

      {/* Middle Row: Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="px-3 py-1 bg-slate-100 text-[#0f2942] text-xs font-bold rounded-full border border-slate-200 uppercase tracking-wider inline-block mb-2">
                Seasonal Precipitation Correlation
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Aizawl Landslide Occurrence Trend (Monsoon Peak)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Monthly precipitation correlation with slope movement frequency across Aizawl ridges
              </p>
            </div>
          </div>
          <div className="relative h-64 border-b border-l border-slate-200 px-4 flex items-end justify-between gap-3 pt-6 pb-2">
            {trendData.map((item) => {
              const isHovered = hoveredMonth === item.month;
              return (
                <div
                  key={item.month}
                  className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                  onMouseEnter={() => setHoveredMonth(item.month)}
                  onMouseLeave={() => setHoveredMonth(null)}
                >
                  <div
                    className={`absolute -top-10 bg-[#0f2942] text-white text-xs py-1.5 px-3 rounded-xl shadow-lg whitespace-nowrap z-20 pointer-events-none transition-all ${
                      isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                    }`}
                  >
                    <span className="font-bold text-[#FF9933]">{item.month}:</span> {item.count} incidents
                  </div>
                  <div
                    style={{ height: `${item.heightPercent}%` }}
                    className={`w-full rounded-t-xl transition-all duration-300 ${
                      item.isPeak
                        ? 'bg-[#0f2942] hover:bg-[#163859] shadow-sm'
                        : item.heightPercent > 70
                        ? 'bg-[#1e40af] hover:bg-[#1d4ed8]'
                        : item.heightPercent > 35
                        ? 'bg-slate-400 hover:bg-slate-500'
                        : 'bg-slate-200 hover:bg-slate-300'
                    }`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between px-4 mt-3 text-xs font-semibold text-slate-500">
            {trendData.map((item) => (
              <span key={item.month} className={item.isPeak ? 'text-[#0f2942] font-bold' : ''}>
                {item.month}
              </span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <span className="px-3 py-1 bg-sky-50 text-sky-800 text-xs font-bold rounded-full border border-sky-200 uppercase tracking-wider inline-block mb-2">
              Soil Water Model
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mb-1">
              tank-stageA-v0.1 SWI Index
            </h3>
            <p className="text-xs text-slate-500">
              Three-tank subsurface saturation model calibrated against IMD rain gauges
            </p>
          </div>

          <div className="my-6 flex items-center justify-center">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  stroke="#e2e8f0"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  stroke="#0f2942"
                  strokeWidth="12"
                  strokeDasharray="238.76"
                  strokeDashoffset={238.76 * (1 - 0.88)}
                  strokeLinecap="round"
                  fill="none"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">142 mm</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Peak SWI
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#0f2942]"></div>
              <span className="text-xs font-bold text-slate-800">Critical Tank (88%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
              <span className="text-xs text-slate-500">Buffer Margin (12%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Live Incident Stream Table */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping"></span>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Aizawl District Slope Status</h3>
          </div>
          <button
            onClick={() => onNavigateTo('risk-map')}
            className="text-xs font-bold text-[#0f2942] hover:text-[#163859] flex items-center gap-1 cursor-pointer transition-colors px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 shadow-2xs"
          >
            <span>Open Geospatial Map</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <th className="p-4 pl-6">Risk Level</th>
                <th className="p-4">Location</th>
                <th className="p-4">Time</th>
                <th className="p-4">Failure Probability</th>
                <th className="p-4 pr-6 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-200">
              {liveAlerts.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  <td className="p-4 pl-6">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${row.severityColor}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${row.dotColor}`}></span>
                      {row.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-slate-900">{row.location}</td>
                  <td className="p-4 text-slate-500 text-xs font-mono">{row.time}</td>
                  <td className="p-4 font-extrabold text-[#0f2942]">{row.probability}</td>
                  <td className="p-4 pr-6 text-right">
                    <button
                      onClick={() => onFocusMarkerOnMap(row.id)}
                      className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                      title="Inspect on Risk Map"
                    >
                      <Map className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
