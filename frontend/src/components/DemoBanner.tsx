import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { RiskDashboardMeta } from '../types';

interface DemoBannerProps {
  meta?: Partial<RiskDashboardMeta> | null;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ meta }) => {
  // Disappear automatically if meta.is_demo_data is false or not provided
  if (!meta?.is_demo_data) return null;

  return (
    <div className="flex flex-col rounded-xl overflow-hidden shadow-xs border border-amber-300 animate-in fade-in">
      {/* Top Warning Strip */}
      <div className="bg-amber-100 text-amber-950 py-1.5 px-4 text-center text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 border-b border-amber-200">
        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
        <span>SIMULATED / DEMO DATA ACTIVE — INTERNAL USE ONLY</span>
      </div>

      {/* Explanatory context for Disaster Management Authorities */}
      <div className="bg-amber-50/50 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-700">
        <p className="text-slate-700 leading-tight">
          Illustrative values for <strong className="text-slate-900 font-bold">Aizawl District, Mizoram</strong>. Synthetic slope-unit predictions require authorized field verification before any CAP alert authorization.
        </p>
        <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-amber-200 shrink-0">
          <span>Run: {meta.run_ts || '03 Sep 2026, 10:00 AM'}</span>
          <span>•</span>
          <span>Model: {meta.model_version || 'tank-stageA-v0.1'}</span>
        </div>
      </div>
    </div>
  );
};
