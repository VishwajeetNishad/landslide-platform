import React, { useState } from 'react';
import { 
  Search, 
  Download, 
  MapPin, 
  Calendar, 
  Layers 
} from 'lucide-react';
import { IncidentHistoryItem } from '../types';
import { INITIAL_HISTORY } from '../data/mockData';

export const HistoryView: React.FC = () => {
  const [incidents] = useState<IncidentHistoryItem[]>(INITIAL_HISTORY);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All Types');

  const filtered = incidents.filter((item) => {
    if (selectedType !== 'All Types' && item.type !== selectedType) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        item.location.toLowerCase().includes(q) ||
        item.state.toLowerCase().includes(q) ||
        item.impact.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-200 text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 bg-slate-100 text-[#0f2942] text-[11px] font-mono font-bold rounded-full border border-slate-200 uppercase tracking-wider inline-block mb-2">
            Historical GSI Archives
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
            Incident Archive & Historical Inventory
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Geological Survey of India (GSI) verified historical slope failure records and seasonal monsoon retrospectives for Aizawl.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              const textContent = JSON.stringify(incidents, null, 2);
              const blob = new Blob([textContent], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `aizawl-historical-incidents.json`;
              link.click();
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0f2942] hover:bg-[#163859] text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#FF9933]" />
            <span>Download Historical Registry</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search past incidents, road cuts..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0f2942] font-medium"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Failure Mode:
          </span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer focus:ring-1 focus:ring-[#0f2942]"
          >
            <option>All Types</option>
            <option>Debris Flow</option>
            <option>Rotational Slump</option>
            <option>Rockfall</option>
            <option>Mudslide</option>
          </select>
        </div>
      </div>

      {/* Historical Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">Incident Location</th>
                <th className="py-4 px-4">Event Date</th>
                <th className="py-4 px-4">Failure Classification</th>
                <th className="py-4 px-4">Monsoon Trigger (mm)</th>
                <th className="py-4 px-6">Impact & Damage Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#0f2942] shrink-0" />
                      <div>
                        <span className="font-bold text-slate-900 block">{item.location}</span>
                        <span className="text-[11px] text-slate-500">{item.state} Sector</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-slate-600 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.date}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      <Layers className="w-3 h-3 text-slate-500" />
                      <span>{item.type}</span>
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-slate-900">{item.rainfallTrigger}</td>
                  <td className="py-4 px-6 text-slate-600 max-w-xs">{item.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
