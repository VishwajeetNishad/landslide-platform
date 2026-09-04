import React, { useState } from 'react';
import { 
  Plus, 
  Download, 
  Activity, 
  FolderOpen, 
  TrendingUp, 
  CheckCircle2, 
  Calendar, 
  User, 
  Eye, 
  FileText, 
  X, 
  Check 
} from 'lucide-react';
import { GeneratedReport } from '../types';
import { INITIAL_REPORTS } from '../data/mockData';

export const ReportsView: React.FC = () => {
  const [reports, setReports] = useState<GeneratedReport[]>(INITIAL_REPORTS);
  const [filterType, setFilterType] = useState<string>('All Types');
  const [showNewReportModal, setShowNewReportModal] = useState(false);
  const [viewingReport, setViewingReport] = useState<GeneratedReport | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Incident Analysis' | 'Monthly Summary' | 'Risk Audit'>('Incident Analysis');

  const filteredReports = reports.filter((rep) => {
    if (filterType === 'All Types') return true;
    return rep.category === filterType;
  });

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newRep: GeneratedReport = {
      id: `rep-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      status: 'Completed',
      dateOrStarted: `Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      authorOrFrequency: 'Author: System Admin',
    };
    setReports([newRep, ...reports]);
    setShowNewReportModal(false);
    setNewTitle('');
    setToastMessage(`Report "${newRep.title}" generated successfully.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDownloadPDF = (report: GeneratedReport) => {
    const textContent = `MINISTRY OF MINES / GEOLOGICAL SURVEY OF INDIA\nTERRAGUARD GEOSPATIAL COMMAND - REPORT DOSSIER\nTitle: ${report.title}\nCategory: ${report.category}\nStatus: ${report.status}\n${report.dateOrStarted}\n${report.authorOrFrequency}\n\nKey Findings:\n- High saturation in subsurface geotechnical layer.\n- Sensor nodes confirmed ground movement within threshold.\n- Early Warning Protocol active for Aizawl District, Mizoram.`;
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.title.replace(/\s+/g, '_')}_GSI_Report.txt`;
    link.click();
    setToastMessage(`Downloaded document package for ${report.title}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-200 text-slate-800">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#0f2942] text-white text-xs px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2">
          <Check className="w-4 h-4 text-[#FF9933]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 bg-slate-100 text-[#0f2942] text-[11px] font-mono font-bold rounded-full border border-slate-200 uppercase tracking-wider inline-block mb-2">
            Intelligence Dossiers & Publications
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
            Geospatial Landslide Risk Reports
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Aizawl District Landslide Monitoring & Statutory Incident Analytical Audits
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowNewReportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0f2942] hover:bg-[#163859] text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#FF9933]" />
            <span>Generate New Report</span>
          </button>
          <button
            onClick={() => {
              setToastMessage('Exporting analytical repository...');
              setTimeout(() => setToastMessage(null), 2500);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export Data</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-5 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0f2942]" />
            <span>Aizawl Slope Instability Summary</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono font-bold">Monsoon Phase Active Cycle</span>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                <th className="py-3 pl-4">Sector / Ward</th>
                <th className="py-3">Active Critical Zones</th>
                <th className="py-3">Past 30-Day Incidents</th>
                <th className="py-3 text-right pr-4">Avg Susceptibility Probability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-4 pl-4 font-bold text-slate-900">Melthum Corridor</td>
                <td className="py-4 text-rose-700 font-bold">
                  <span className="inline-flex items-center gap-1">
                    1 <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
                  </span>
                </td>
                <td className="py-4 text-slate-700 font-mono font-bold">3</td>
                <td className="py-4 pr-4 text-right">
                  <div className="flex items-center justify-end gap-3 w-full">
                    <span className="font-bold text-slate-900 w-8">72%</span>
                    <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                      <div className="h-full bg-rose-600 rounded-full" style={{ width: '72%' }} />
                    </div>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-4 pl-4 font-bold text-slate-900">Bawngkawn Urban Flank</td>
                <td className="py-4 text-amber-700 font-bold">1</td>
                <td className="py-4 text-slate-700 font-mono font-bold">1</td>
                <td className="py-4 pr-4 text-right">
                  <div className="flex items-center justify-end gap-3 w-full">
                    <span className="font-bold text-slate-900 w-8">68%</span>
                    <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: '68%' }} />
                    </div>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-4 pl-4 font-bold text-slate-900">Durtlang North Escarpment</td>
                <td className="py-4 text-slate-500 font-bold">0</td>
                <td className="py-4 text-slate-700 font-mono font-bold">0</td>
                <td className="py-4 pr-4 text-right">
                  <div className="flex items-center justify-end gap-3 w-full">
                    <span className="font-bold text-slate-900 w-8">95%</span>
                    <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                      <div className="h-full bg-rose-600 rounded-full" style={{ width: '95%' }} />
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#0f2942]" />
            <span>Generated Reports Catalog</span>
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Filter:
            </span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold py-1.5 px-3 rounded-xl focus:ring-1 focus:ring-[#0f2942] outline-none cursor-pointer"
            >
              <option>All Types</option>
              <option>Incident Analysis</option>
              <option>Monthly Summary</option>
              <option>Risk Audit</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 hover:border-slate-300 transition-all flex flex-col gap-4 relative"
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {report.category}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    {report.title}
                  </h3>
                </div>
                {report.status === 'Completed' && (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[11px] font-bold">Completed</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 text-xs text-slate-600 mt-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{report.dateOrStarted}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>{report.authorOrFrequency}</span>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-slate-200 flex gap-2">
                <button
                  onClick={() => setViewingReport(report)}
                  className="flex-1 py-2 bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors flex justify-center items-center gap-2 cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-slate-500" />
                  <span>View</span>
                </button>
                <button
                  onClick={() => handleDownloadPDF(report)}
                  className="flex-1 py-2 bg-[#0f2942] hover:bg-[#163859] text-white rounded-xl text-xs font-bold transition-colors flex justify-center items-center gap-2 cursor-pointer shadow-xs"
                >
                  <FileText className="w-4 h-4 text-[#FF9933]" />
                  <span>Dossier</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Report Modal */}
      {showNewReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
              <h3 className="text-lg font-black text-slate-900">Generate Analytical Report</h3>
              <button
                onClick={() => setShowNewReportModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateReport} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-bold uppercase tracking-wider mb-1">
                  Report Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Aizawl Post-Rainfall Stability Audit"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0f2942]"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-bold uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0f2942] cursor-pointer"
                >
                  <option value="Incident Analysis">Incident Analysis</option>
                  <option value="Monthly Summary">Monthly Summary</option>
                  <option value="Risk Audit">Risk Audit</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewReportModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0f2942] hover:bg-[#163859] text-white rounded-xl font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {viewingReport.category}
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-0.5">{viewingReport.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{viewingReport.dateOrStarted}</p>
              </div>
              <button
                onClick={() => setViewingReport(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-xs text-slate-700">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-2">Executive Summary</h4>
                <p className="leading-relaxed text-slate-600">
                  Geological sensors recorded accelerated subsurface pore water pressure and three-tank water index saturation across Melthum and Chaltlang sectors. Ground inspection verified active tension crack formation.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div className="text-lg font-black text-rose-700">72%</div>
                  <div className="text-[10px] text-slate-500 font-bold mt-0.5">Peak Probability</div>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div className="text-lg font-black text-slate-900">34.2°</div>
                  <div className="text-[10px] text-slate-500 font-bold mt-0.5">Critical Slope</div>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div className="text-lg font-black text-emerald-700">100%</div>
                  <div className="text-[10px] text-slate-500 font-bold mt-0.5">Telemetry Uptime</div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-slate-200">
              <button
                onClick={() => handleDownloadPDF(viewingReport)}
                className="px-5 py-2.5 bg-[#0f2942] hover:bg-[#163859] text-white rounded-xl font-bold transition-colors flex items-center gap-2 cursor-pointer text-xs shadow-xs"
              >
                <FileText className="w-4 h-4 text-[#FF9933]" />
                <span>Download Official Summary</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
