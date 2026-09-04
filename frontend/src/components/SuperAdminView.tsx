import React, { useState } from 'react';
import { 
  UserCheck, 
  Terminal, 
  Check
} from 'lucide-react';
import { UserProfile } from '../types';

interface SuperAdminViewProps {
  currentUser: UserProfile | null;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ currentUser: _currentUser }) => {
  const [officers, setOfficers] = useState([
    { id: '1', name: 'Dr. K. Radhakrishnan', role: 'Super Admin', dept: 'NDMA HQ', status: 'Active', clearance: 'Level 5' },
    { id: '2', name: 'Officer L. Ralte', role: 'State Lead', dept: 'Mizoram SDMA', status: 'Active', clearance: 'Level 4' },
    { id: '3', name: 'Er. T. Sailo', role: 'Field Officer', dept: 'GSI Aizawl', status: 'Active', clearance: 'Level 3' },
    { id: '4', name: 'Dr. V. Lalhmingliana', role: 'Geologist', dept: 'Mizoram Disaster Cell', status: 'Active', clearance: 'Level 3' },
  ]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleToggleStatus = (id: string) => {
    setOfficers(prev => prev.map(o => o.id === id ? { ...o, status: o.status === 'Active' ? 'Suspended' : 'Active' } : o));
    setToastMessage('Officer access credential status updated.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-200 text-slate-800">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#0f2942] text-white text-xs px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2">
          <Check className="w-4 h-4 text-[#FF9933]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div>
        <span className="px-3 py-1 bg-slate-100 text-[#0f2942] text-[11px] font-mono font-bold rounded-full border border-slate-200 uppercase tracking-wider inline-block mb-2">
          National Command & Governance
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Super Administrator Central Console
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Identity management, statutory audit logging, and cryptographic verification authority across NDMA and GSI response divisions.
        </p>
      </div>

      {/* Officers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#0f2942]" />
            <span>Authorized Operations Personnel</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono font-bold">NIC Clearance Grid</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-6">Officer Name</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Clearance</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-6 text-right">Access Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {officers.map(officer => (
                <tr key={officer.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-900">{officer.name}</td>
                  <td className="py-4 px-4 font-semibold text-slate-800">{officer.role}</td>
                  <td className="py-4 px-4 text-slate-600">{officer.dept}</td>
                  <td className="py-4 px-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {officer.clearance}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      officer.status === 'Active' 
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {officer.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleToggleStatus(officer.id)}
                      className="px-3 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 font-bold text-[11px] text-slate-700 cursor-pointer transition-colors shadow-2xs"
                    >
                      {officer.status === 'Active' ? 'Revoke Access' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Audit Log */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-800 font-mono text-xs shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-200">
            <Terminal className="w-4 h-4 text-[#FF9933]" />
            <span className="font-bold">Statutory Audit Trail (NDMA / C-DOT Dispatch Gateway)</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold">ENCRYPTED REALTIME STREAM</span>
        </div>
        <div className="space-y-1.5 text-[11px] text-slate-300">
          <p><span className="text-slate-500">[2026-09-03 10:00:02 IST]</span> <span className="text-emerald-400 font-bold">INFO:</span> Aizawl slope unit model run completed (model_version: tank-stageA-v0.1).</p>
          <p><span className="text-slate-500">[2026-09-03 10:00:15 IST]</span> <span className="text-amber-400 font-bold">WARN:</span> Sector AZ-1142 flagged HIGH risk. Saturated regolith detected.</p>
          <p><span className="text-slate-500">[2026-09-03 10:00:18 IST]</span> <span className="text-slate-300 font-bold">NOTE:</span> Sector AZ-1088 evaluated: Prob=0.95, Exposure=0, Classification=LOW.</p>
          <p><span className="text-slate-500">[2026-09-03 10:01:05 IST]</span> <span className="text-slate-400">AUTH:</span> Session established via NIC secure gateway.</p>
        </div>
      </div>
    </div>
  );
};
