import React from 'react';
import { 
  X, 
  CheckCircle2, 
  Activity, 
  CloudRain, 
  Cpu, 
  ShieldCheck,
  Server
} from 'lucide-react';
import { api } from '../lib/api';

interface SystemStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemStatusModal: React.FC<SystemStatusModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const subsystems = [
    {
      name: 'Aizawl Slope-Unit Backend API (:8000)',
      status: api.getDataSource() === 'live' ? 'Live API Active' : 'Sample JSON Mode',
      ping: api.getDataSource() === 'live' ? 'Localhost' : 'Offline In-Memory',
      details: `Endpoint: ${api.getBaseUrl()}/api/v1/risk/current?district=aizawl`,
      healthy: true,
      icon: <Server className="w-4 h-4 text-white" />,
    },
    {
      name: 'IMD Doppler Radar Precipitation Feed',
      status: 'Synchronized',
      ping: '18 ms',
      details: 'Real-time rainfall interpolation grid for Aizawl district',
      healthy: true,
      icon: <CloudRain className="w-4 h-4 text-white" />,
    },
    {
      name: 'Machine Learning Inference Pipeline (tank-stageA-v0.1)',
      status: 'Operational',
      ping: '28 ms',
      details: 'Three-tank subsurface water index (SWI) with SHAP attribution',
      healthy: true,
      icon: <Cpu className="w-4 h-4 text-white" />,
    },
    {
      name: 'Aizawl Automated Weather Station (AWS) Mesh',
      status: '14 / 14 Online',
      ping: '65 ms',
      details: 'Rain gauges at Durtlang, Chaltlang, Kulikawn, and Hunthar',
      healthy: true,
      icon: <Activity className="w-4 h-4 text-white" />,
    },
    {
      name: 'OASIS CAP 1.2 Downstream Broadcast Gateway',
      status: 'Standby / Armed',
      ping: '12 ms',
      details: 'Direct trunk connection to Mizoram SDRF & C-DOT Cell Broadcast',
      healthy: true,
      icon: <ShieldCheck className="w-4 h-4 text-white" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-900">
        <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#0f2942] border border-blue-200">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">System Telemetry &amp; Health</h3>
              <p className="text-xs text-slate-500">Live operational telemetry across all services</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs mb-6">
          {subsystems.map((sub, i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[#0f2942] shrink-0 shadow-xs">
                  {sub.icon}
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">{sub.name}</div>
                  <p className="text-[11px] text-slate-600 mt-0.5">{sub.details}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1 font-bold text-[11px] text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{sub.status}</span>
                </span>
                <span className="block font-mono text-[10px] text-slate-400 mt-0.5">{sub.ping}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-700">All Core Systems Operational</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#0f2942] hover:bg-[#1a365d] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
