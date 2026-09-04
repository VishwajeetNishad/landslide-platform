import React, { useState } from 'react';
import { 
  MapPin, 
  Filter, 
  Download, 
  Check, 
  X, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Cpu, 
  Sparkles 
} from 'lucide-react';
import { PredictionItem } from '../types';
import { INITIAL_PREDICTIONS, REGIONAL_VIEW_MAP_URL } from '../data/mockData';

export const PredictionsView: React.FC = () => {
  const [predictions, setPredictions] = useState<PredictionItem[]>(INITIAL_PREDICTIONS);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Critical' | 'Elevated' | 'Low'>('All');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleUpdateStatus = (id: string, status: PredictionItem['status']) => {
    setPredictions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
    setToastMessage(`Prediction verified as: ${status}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExport = () => {
    const jsonStr = JSON.stringify(predictions, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `landslide-predictions-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setToastMessage('Exported verification dataset successfully.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredPredictions = predictions.filter((item) => {
    if (activeFilter === 'All') return true;
    return item.riskLevel === activeFilter;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-200">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#0f2942] text-white text-xs px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
          <Check className="w-4 h-4 text-[#FF9933]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <span className="px-3 py-1 bg-slate-100 text-[#0f2942] text-xs font-bold rounded-full border border-slate-200 uppercase tracking-wider inline-block mb-2">
                ML Pipeline Verification
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Neural Slope Susceptibility Verification
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Validate machine learning predictions against ground truth field reports and radar telemetry.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <div className="relative">
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value as any)}
                  className="px-3 py-2 bg-white text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0f2942] cursor-pointer appearance-none pr-8 shadow-2xs"
                >
                  <option value="All">All Risk Levels</option>
                  <option value="Critical">Critical Only</option>
                  <option value="Elevated">Elevated Only</option>
                  <option value="Low">Low Only</option>
                </select>
                <Filter className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>

              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-[#0f2942] hover:bg-[#163859] text-white rounded-xl transition-colors text-xs font-bold shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#FF9933]" />
                <span>Export Dataset</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 overflow-hidden flex flex-col shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-slate-50/70 border-b border-slate-200">
                  <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 pl-6">Sector Location</th>
                    <th className="py-3.5 px-4">Predicted Date</th>
                    <th className="py-3.5 px-4">Risk Level</th>
                    <th className="py-3.5 px-4">Probability</th>
                    <th className="py-3.5 px-4">Confidence</th>
                    <th className="py-3.5 px-4">Rainfall (mm)</th>
                    <th className="py-3.5 px-4 pr-6 text-right">Verification Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredPredictions.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-4 px-4 pl-6">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#0f2942] shrink-0" />
                          <span className="font-bold text-slate-900">{row.location}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-600 font-mono">{row.predictedDate}</td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            row.riskLevel === 'Critical'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : row.riskLevel === 'Elevated'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {row.riskLevel}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 w-8">{row.probability}%</span>
                          <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${row.probability}%` }}
                              className={`h-full rounded-full ${
                                row.riskLevel === 'Critical'
                                  ? 'bg-rose-600'
                                  : row.riskLevel === 'Elevated'
                                  ? 'bg-amber-500'
                                  : 'bg-slate-400'
                              }`}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-700 font-medium">{row.confidence}</td>
                      <td className="py-4 px-4 text-slate-600 font-mono font-bold">{row.rainfallMm}</td>
                      <td className="py-4 px-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleUpdateStatus(row.id, 'Confirmed True')}
                            className={`p-1.5 rounded-xl transition-colors cursor-pointer border ${
                              row.status === 'Confirmed True'
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                : 'border-slate-300 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title="Confirm True Positive"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(row.id, 'Marked False')}
                            className={`p-1.5 rounded-xl transition-colors cursor-pointer border ${
                              row.status === 'Marked False'
                                ? 'bg-rose-100 border-rose-300 text-rose-800'
                                : 'border-slate-300 text-slate-500 hover:text-rose-700 hover:bg-rose-50'
                            }`}
                            title="Mark False Positive"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(row.id, 'Under Verification')}
                            className={`p-1.5 rounded-xl transition-colors cursor-pointer border ${
                              row.status === 'Under Verification'
                                ? 'bg-amber-100 border-amber-300 text-amber-800'
                                : 'border-slate-300 text-slate-500 hover:text-amber-700 hover:bg-amber-50'
                            }`}
                            title="Flag as Under Verification"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50/70 border-t border-slate-200 py-3 px-6 flex items-center justify-between text-xs text-slate-500">
              <span>Showing 1-{filteredPredictions.length} of {predictions.length} predictions</span>
              <div className="flex gap-1">
                <button disabled className="p-1 text-slate-300 rounded disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="p-1 text-slate-700 hover:bg-slate-200 rounded cursor-pointer">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Metrics */}
        <aside className="w-full lg:w-80 flex flex-col gap-5">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-6 flex flex-col justify-between shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2 tracking-tight">
              <Cpu className="w-4 h-4 text-[#0f2942]" />
              <span>Model Telemetry Benchmarks</span>
            </h3>
            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between text-slate-600 mb-1.5 font-medium">
                  <span>Precision (Last 7 Days)</span>
                  <span className="font-bold text-slate-900">91.2%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div className="h-full bg-[#0f2942] rounded-full" style={{ width: '91.2%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-600 mb-1.5 font-medium">
                  <span>Recall (Last 7 Days)</span>
                  <span className="font-bold text-slate-900">87.5%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div className="h-full bg-slate-600 rounded-full" style={{ width: '87.5%' }} />
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-[#0f2942]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Active Model Weights</p>
                  <p className="text-xs font-mono font-bold text-slate-800">tank-stageA-v0.1</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 overflow-hidden flex-1 min-h-[260px] relative shadow-sm">
            <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-slate-800 border border-slate-200 shadow-2xs">
              Aizawl Regional View
            </div>
            <div 
              className="w-full h-full bg-cover bg-center min-h-[260px] relative"
              style={{ backgroundImage: `url('${REGIONAL_VIEW_MAP_URL}')` }}
            >
              <div className="absolute top-1/3 left-1/2 w-3.5 h-3.5 bg-rose-600 rounded-full shadow-md ring-4 ring-rose-300 animate-pulse" title="Aizawl" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
