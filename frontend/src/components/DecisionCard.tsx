import React from 'react';
import { 
  ShieldAlert, 
  MapPin, 
  Clock, 
  Users, 
  Building, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Send,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { RiskBadge } from './RiskBadge';
import { StatusBadge } from './StatusBadge';
import { RiskLevel, VerificationStatus } from '../types';
import { formatPercent, formatCount, formatDateTime } from '../lib/formatters';

export interface DecisionCardData {
  id: string;
  slope_unit_id: string;
  location: string;
  ward_name: string;
  predicted_likelihood: number; // probability
  exposure_population: number;
  critical_facilities_count: number;
  roadways_exposed_m: number;
  risk_level: RiskLevel;
  verification_status: VerificationStatus;
  recommended_action: string;
  timestamp: string;
  verified_by?: string | null;
  confidence_interval?: [number, number];
}

interface DecisionCardProps {
  data: DecisionCardData;
  onDispatchAlert?: (data: DecisionCardData) => void;
  onInspectUnit?: (slopeUnitId: string) => void;
  className?: string;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({
  data,
  onDispatchAlert,
  onInspectUnit,
  className = '',
}) => {
  const isHighRisk = data.risk_level === 'HIGH';
  const isPending = data.verification_status === 'PENDING_VERIFICATION';

  return (
    <div
      className={`rounded-2xl border bg-white text-slate-900 p-5 shadow-xs flex flex-col justify-between transition-all ${
        isHighRisk
          ? 'border-red-300 ring-1 ring-red-300/60'
          : data.risk_level === 'MEDIUM'
          ? 'border-amber-300'
          : 'border-slate-200'
      } ${className}`}
    >
      {/* Top Meta Bar */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-300">
              {data.slope_unit_id}
            </span>
            <RiskBadge level={data.risk_level} size="sm" />
            <StatusBadge status={data.verification_status} />
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{data.timestamp}</span>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 mb-3">
          <MapPin className="w-4 h-4 text-[#0f2942] shrink-0" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">
            {data.location} ({data.ward_name})
          </h3>
        </div>

        {/* Crucial Risk Matrix Separation: Likelihood vs Consequence */}
        <div className="grid grid-cols-2 gap-2.5 my-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
          {/* Likelihood Column */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              1. Likelihood (Hazard)
            </span>
            <div className="text-lg font-black font-mono text-slate-900">
              {formatPercent(data.predicted_likelihood)}
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">
              Failure Prob. {data.confidence_interval ? `(CI: ${(data.confidence_interval[0]*100).toFixed(0)}%–${(data.confidence_interval[1]*100).toFixed(0)}%)` : ''}
            </div>
          </div>

          {/* Consequence Column */}
          <div className="space-y-1 border-l border-slate-200 pl-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              2. Consequence (Exposure)
            </span>
            <div className="text-lg font-black font-mono text-slate-900">
              {formatCount(data.exposure_population)} <span className="text-xs font-normal text-slate-500">pop</span>
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">
              {data.critical_facilities_count} facilities • {data.roadways_exposed_m}m road
            </div>
          </div>
        </div>

        {/* Distinction Notice Banner */}
        <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-[11px] text-blue-950 leading-relaxed mb-3">
          <span className="text-blue-900 font-bold">Governance Matrix:</span> Risk is mathematically evaluated as <em className="text-blue-900 font-semibold">Likelihood × Consequence</em>. High likelihood with zero consequence does not escalate to an evacuation alert.
        </div>

        {/* Recommended Action */}
        <div className="space-y-1 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Recommended Action:
          </span>
          <p className="text-xs text-slate-800 font-medium leading-normal bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            {data.recommended_action}
          </p>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
        <div className="text-[11px] text-slate-500">
          {data.verified_by ? (
            <span className="flex items-center gap-1 text-slate-800 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Verified by {data.verified_by}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-500 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Requires Human Officer Triage</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onInspectUnit && (
            <button
              onClick={() => onInspectUnit(data.slope_unit_id)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-300 transition-colors cursor-pointer shadow-xs"
            >
              Inspect
            </button>
          )}

          {onDispatchAlert && (
            <button
              onClick={() => onDispatchAlert(data)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer bg-[#0f2942] text-white hover:bg-[#1a365d] border border-[#0f2942] shadow-xs"
            >
              <Send className="w-3 h-3 text-white" />
              <span>{isPending ? 'Review & Authorize' : 'Dispatch CAP 1.2'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
