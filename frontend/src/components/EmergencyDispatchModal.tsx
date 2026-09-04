import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertOctagon, 
  Radio, 
  Send, 
  ShieldAlert, 
  MapPin, 
  CheckCircle2, 
  Truck 
} from 'lucide-react';
import { AlertItem } from '../types';

interface EmergencyDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetAlert?: AlertItem | null;
}

export const EmergencyDispatchModal: React.FC<EmergencyDispatchModalProps> = ({
  isOpen,
  onClose,
  presetAlert,
}) => {
  const [selectedAgency, setSelectedAgency] = useState('Mizoram SDRF Battalion (Aizawl Unit)');
  const [advisoryLevel, setAdvisoryLevel] = useState('Immediate Road Closure & Evacuation');
  const [locationName, setLocationName] = useState('Melthum Corridor (AZ-1142), Aizawl');
  const [broadcastNote, setBroadcastNote] = useState(
    'URGENT: Landslide risk classified HIGH. Saturated regolith and pore-pressure surge detected. Precautionary evacuation along downslope transit corridor required.'
  );
  const [isDispatched, setIsDispatched] = useState(false);

  useEffect(() => {
    if (presetAlert) {
      setLocationName(`${presetAlert.location}, ${presetAlert.state}`);
      setBroadcastNote(
        `URGENT: Alert ID ${presetAlert.alertId}. Landslide probability is ${presetAlert.probability}%. Deploy ground response unit to ${presetAlert.location} immediately.`
      );
    }
  }, [presetAlert]);

  if (!isOpen) return null;

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDispatched(true);
    setTimeout(() => {
      setIsDispatched(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative overflow-hidden text-slate-900">
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#0f2942]" />

        <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700">
              <AlertOctagon className="w-5 h-5 text-red-700" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Emergency Tactical Dispatch</h3>
              <p className="text-xs text-slate-500">
                Authorizes direct NDRF/SDRF tactical response and CAP broadcast
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isDispatched ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-md">
              <CheckCircle2 className="w-8 h-8 animate-bounce text-emerald-600" />
            </div>
            <h4 className="text-lg font-black text-slate-900">Dispatch Order Transmitted</h4>
            <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
              Direct telemetry package and CAP broadcast issued to {selectedAgency}. Response units acknowledge standby status.
            </p>
          </div>
        ) : (
          <form onSubmit={handleDispatch} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0f2942]" />
                <span>Target Incident Sector</span>
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full p-3 rounded-xl bg-white border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0f2942] font-semibold text-slate-900 text-xs shadow-xs"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-[#0f2942]" />
                  <span>Primary Response Force</span>
                </label>
                <select
                  value={selectedAgency}
                  onChange={(e) => setSelectedAgency(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0f2942] text-slate-900 text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <option>Mizoram SDRF Battalion (Aizawl Unit)</option>
                  <option>NDRF Battalion 1 (Guwahati Response)</option>
                  <option>Border Roads Organisation (BRO Project Pushpak)</option>
                  <option>Aizawl District Disaster Management Cell</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#0f2942]" />
                  <span>Advisory Level</span>
                </label>
                <select
                  value={advisoryLevel}
                  onChange={(e) => setAdvisoryLevel(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0f2942] text-slate-900 text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <option>Immediate Road Closure & Evacuation</option>
                  <option>Precautionary Heavy Vehicle Halt</option>
                  <option>General Public High Advisory</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#0f2942]" />
                <span>Tactical Broadcast Message (CAP Protocol)</span>
              </label>
              <textarea
                rows={3}
                value={broadcastNote}
                onChange={(e) => setBroadcastNote(e.target.value)}
                className="w-full p-3 rounded-xl bg-white border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0f2942] font-mono text-[11px] text-slate-800 shadow-xs"
              />
            </div>

            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-ping shrink-0" />
              <p className="text-[11px] text-amber-950 leading-snug font-medium">
                Statutory Notice: Authorization activates high-frequency siren gateways and automated cell broadcast warnings to telecom towers across the hazard polygon.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer transition-colors shadow-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#0f2942] hover:bg-[#1a365d] text-white font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-white" />
                <span>Authorize & Dispatch</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
