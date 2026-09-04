import React, { useState } from 'react';
import { 
  MapPin, 
  Clock, 
  Send, 
  Check, 
  Eye, 
  ShieldAlert,
  X,
  FileCheck
} from 'lucide-react';
import { AlertItem } from '../types';
import { INITIAL_ALERTS } from '../data/mockData';

interface AlertsViewProps {
  onOpenEmergencyDispatch: (alert?: AlertItem) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  onOpenEmergencyDispatch,
}) => {
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);
  const [filterSeverity, setFilterSeverity] = useState<string>('All Severities');
  const [selectedAlertForInspection, setSelectedAlertForInspection] = useState<AlertItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const filteredAlerts = alerts.filter((item) => {
    if (filterSeverity === 'All Severities') return true;
    return item.severity === filterSeverity;
  });

  const handleResolveAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Resolved' } : a))
    );
    setToastMessage('Alert status updated to Resolved / Demobilized.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-200 text-slate-900">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl border border-slate-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[11px] font-mono font-bold rounded-full border border-slate-300 uppercase tracking-wider inline-block mb-2">
            Disaster Warning Gateway
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
            Early Warning Incident Alerts
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Common Alerting Protocol (CAP 1.2) - High-priority public advisories and emergency response actions.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onOpenEmergencyDispatch()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0f2942] hover:bg-[#1a365d] text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4 text-white" />
            <span>Broadcast Emergency Alert</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Filter:
          </span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-white text-slate-800 border border-slate-300 text-xs font-bold py-1.5 px-3 rounded-xl focus:ring-1 focus:ring-[#0f2942] outline-none cursor-pointer shadow-xs"
          >
            <option>All Severities</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing {filteredAlerts.length} active warnings
        </span>
      </div>

      {/* Alerts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAlerts.map((alert) => (
          <div
            key={alert.id}
            className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    alert.severity === 'High'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : alert.severity === 'Medium'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      alert.severity === 'High'
                        ? 'bg-red-600'
                        : alert.severity === 'Medium'
                        ? 'bg-amber-600'
                        : 'bg-emerald-600'
                    }`}
                  />
                  <span>{alert.severity} Risk Warning</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">{alert.alertId}</span>
              </div>

              <h3 className="text-lg font-black text-slate-900 tracking-tight mb-1">
                {alert.location}
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-3">
                <MapPin className="w-3.5 h-3.5 text-[#0f2942]" />
                <span>{alert.state} Sector</span>
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs text-slate-700">
                <p className="line-clamp-2">{alert.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                    Failure Probability
                  </span>
                  <span className="text-base font-black text-slate-900">{alert.probability}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                    Telemetry Timestamp
                  </span>
                  <span className="text-xs text-slate-600 font-mono font-medium flex items-center gap-1 mt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{alert.time}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex gap-2">
              <button
                onClick={() => setSelectedAlertForInspection(alert)}
                className="flex-1 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-slate-300 cursor-pointer shadow-xs"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Audit Details</span>
              </button>
              <button
                onClick={() => onOpenEmergencyDispatch(alert)}
                className="flex-1 py-2 rounded-xl bg-[#0f2942] hover:bg-[#1a365d] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-white" />
                <span>Dispatch Force</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Inspect Modal */}
      {selectedAlertForInspection && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {selectedAlertForInspection.severity} Risk CAP 1.2 Dossier
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {selectedAlertForInspection.location}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlertForInspection(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-[#0f2942]" />
                  <span>Disaster Broadcast Bulletin</span>
                </h4>
                <p className="leading-relaxed text-slate-700">
                  {selectedAlertForInspection.message}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Trigger Type</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{selectedAlertForInspection.type}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Status</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{selectedAlertForInspection.status}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6 pt-3 border-t border-slate-200">
              <button
                onClick={() => {
                  handleResolveAlert(selectedAlertForInspection.id);
                  setSelectedAlertForInspection(null);
                }}
                className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
              >
                Mark Resolved
              </button>
              <button
                onClick={() => {
                  onOpenEmergencyDispatch(selectedAlertForInspection);
                  setSelectedAlertForInspection(null);
                }}
                className="px-5 py-2 bg-[#0f2942] hover:bg-[#1a365d] text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Forward to Response Force
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
