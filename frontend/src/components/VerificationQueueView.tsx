import React, { useState } from 'react';
import { useMergedRiskData } from '../lib/useRiskData';
import { SlopeUnitRisk, VerificationStatus, UserProfile } from '../types';
import { RiskBadge } from './RiskBadge';
import { StatusBadge } from './StatusBadge';
import { formatPercent, formatCount } from '../lib/formatters';
import { 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Search, 
  MapPin, 
  ChevronRight,
  Info
} from 'lucide-react';

interface VerificationQueueViewProps {
  currentUser: UserProfile | null;
  onSelectSlopeUnitOnMap: (slopeUnitId: string) => void;
}

export const VerificationQueueView: React.FC<VerificationQueueViewProps> = ({
  currentUser,
  onSelectSlopeUnitOnMap,
}) => {
  const { slopeUnitsList, updateVerificationStatus } = useMergedRiskData('aizawl');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [notes] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const filteredList = slopeUnitsList.filter((unit) => {
    if (filterStatus !== 'ALL') {
      const currentStatus = unit.verification_status || 'PENDING_VERIFICATION';
      if (currentStatus !== filterStatus) return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        unit.slope_unit_id.toLowerCase().includes(q) ||
        unit.ward_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAction = (status: VerificationStatus, unit: SlopeUnitRisk) => {
    const verifier = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Officer L. Ralte (Field Lead)';
    updateVerificationStatus(
      unit.slope_unit_id,
      status,
      notes || unit.verification_notes || `Status marked as ${status} on ${new Date().toLocaleDateString()}`,
      verifier
    );
    setToastMessage(`Slope Unit ${unit.slope_unit_id} marked as ${status}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-200 text-slate-900">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl border border-slate-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[11px] font-mono font-bold rounded-full border border-slate-300 uppercase tracking-wider inline-block mb-2">
            Statutory Human Governance
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
            Field Officer Verification & Triage Queue
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Human-in-the-loop workflow: AI predictions require authorized confirmation before triggering statutory public notifications.
          </p>
        </div>

        <div className="flex items-center gap-2.5 text-xs font-semibold text-blue-950 bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-200">
          <Info className="w-4 h-4 text-blue-700" />
          <span>Verification is a legally binding human action</span>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by slope unit ID or ward..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0f2942] font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-300 font-bold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-[#0f2942] cursor-pointer shadow-xs"
          >
            <option value="ALL">All Statuses ({slopeUnitsList.length})</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="FALSE_POSITIVE">False Positive</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
          </select>
        </div>
      </div>

      {/* Queue List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredList.map((unit) => {
          return (
            <div
              key={unit.slope_unit_id}
              className={`p-5 bg-white rounded-2xl border transition-all flex flex-col justify-between shadow-xs ${
                unit.risk_level === 'HIGH' ? 'border-red-300 ring-1 ring-red-300/60' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                      {unit.slope_unit_id}
                    </span>
                    <RiskBadge level={unit.risk_level} size="sm" />
                    <StatusBadge status={unit.verification_status} />
                  </div>
                  <button
                    onClick={() => onSelectSlopeUnitOnMap(unit.slope_unit_id)}
                    className="text-[11px] font-bold text-[#0f2942] hover:text-[#1a365d] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Map</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#0f2942]" />
                  <span>{unit.ward_name}</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs my-3">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Failure Probability</span>
                    <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
                      {formatPercent(unit.failure_probability)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Exposed Population</span>
                    <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
                      {formatCount(unit.exposed_population)}
                    </span>
                  </div>
                </div>

                {unit.verification_notes && (
                  <p className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 italic mb-3">
                    "{unit.verification_notes}"
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleAction('CONFIRMED', unit)}
                  className="px-3 py-1.5 rounded-xl bg-[#0f2942] hover:bg-[#1a365d] text-white border border-[#0f2942] font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  <span>Confirm True</span>
                </button>

                <button
                  onClick={() => handleAction('FALSE_POSITIVE', unit)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  <XCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>False Positive</span>
                </button>

                <button
                  onClick={() => handleAction('NEEDS_REVIEW', unit)}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Needs Review</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
