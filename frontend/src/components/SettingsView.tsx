import React, { useState } from 'react';
import { 
  Server, 
  Check, 
  Cpu 
} from 'lucide-react';
import { api } from '../lib/api';

export const SettingsView: React.FC = () => {
  const [dataSource, setDataSource] = useState<'live' | 'mock'>(api.getDataSource());
  const [backendUrl, setBackendUrl] = useState(api.getBaseUrl());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    api.setDataSource(dataSource);
    setToastMessage('System settings & backend configuration saved.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6 animate-in fade-in duration-200 text-slate-800">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#0f2942] text-white text-xs px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2">
          <Check className="w-4 h-4 text-[#FF9933]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div>
        <span className="px-3 py-1 bg-slate-100 text-[#0f2942] text-[11px] font-mono font-bold rounded-full border border-slate-200 uppercase tracking-wider inline-block mb-2">
          Platform Configuration
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          System Administration & API Connectivity
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure backend API endpoints, telemetry ingest polling, and machine learning threshold calibrations for Aizawl District.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Backend API Configuration */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0f2942]">
              <Server className="w-5 h-5 text-[#0f2942]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Backend API Endpoints</h2>
              <p className="text-xs text-slate-500">Live service at http://localhost:8000 (VITE_API_URL)</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Data Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setDataSource('live')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    dataSource === 'live'
                      ? 'border-[#0f2942] bg-slate-50 ring-1 ring-[#0f2942]'
                      : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Live Backend (:8000)</span>
                    {dataSource === 'live' && <Check className="w-4 h-4 text-[#0f2942]" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Connects directly to FastAPI/backend running on localhost:8000 via VITE_API_URL.
                  </p>
                </div>

                <div
                  onClick={() => setDataSource('mock')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    dataSource === 'mock'
                      ? 'border-[#0f2942] bg-slate-50 ring-1 ring-[#0f2942]'
                      : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Offline Sample JSON Mode</span>
                    {dataSource === 'mock' && <Check className="w-4 h-4 text-[#0f2942]" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Loads bundled Aizawl slope units and risk data directly for standalone previews.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                API Base URL
              </label>
              <input
                type="text"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0f2942]"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Calls: <code className="text-slate-700 font-bold">{backendUrl}/api/v1/slope-units?district=aizawl</code> and <code className="text-slate-700 font-bold">{backendUrl}/api/v1/risk/current?district=aizawl</code>
              </p>
            </div>
          </div>
        </div>

        {/* Machine Learning Model Settings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0f2942]">
              <Cpu className="w-5 h-5 text-[#0f2942]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Model Parameters & Soil Water Index (SWI)</h2>
              <p className="text-xs text-slate-500">tank-stageA-v0.1 Three-Tank Subsurface Model</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Critical High Risk Threshold</span>
              <p className="text-sm font-black text-slate-900 mt-1">High Risk if Exposure &gt; 0 &amp; Prob &gt; 0.60</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Note: AZ-1088 has 0 exposure, hence classified as LOW.</p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Run Frequency</span>
              <p className="text-sm font-black text-slate-900 mt-1">Hourly AWS Precipitation Ingestion</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Automated cron runs at T+00:00 every hour.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#0f2942] hover:bg-[#163859] text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};
