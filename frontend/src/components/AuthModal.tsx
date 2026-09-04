import React, { useState } from 'react';
import { 
  ShieldCheck, 
  X, 
  Lock, 
  Mail, 
  Building2, 
  CheckCircle2, 
  KeyRound,
  ArrowRight,
  ShieldAlert,
  Radio,
  FileCheck
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onLogin: (user: UserProfile) => void;
  onLogout: () => void;
}

export const DEMO_SUPER_ADMIN: UserProfile = {
  id: 'usr-super-admin-01',
  name: 'Dr. K. Radhakrishnan',
  email: 'k.radhakrishnan@ndma.gov.in',
  role: 'super-admin',
  department: 'National Disaster Management Authority (NDMA)',
  designation: 'Director General & Chief Oversight Officer',
  clearanceLevel: 5,
  badgeNumber: 'NDMA-DIR-001',
  stateZone: 'Central Command (Aizawl & NE Corridors)',
  lastActive: 'Active Now',
  status: 'Active',
};

export const DEMO_STATE_LEAD: UserProfile = {
  id: 'usr-state-lead-02',
  name: 'Officer L. Ralte',
  email: 'l.ralte@sdma.mizoram.gov.in',
  role: 'state-lead',
  department: 'Mizoram State Disaster Management Authority (MSDMA)',
  designation: 'Aizawl District Disaster Operations Lead',
  clearanceLevel: 4,
  badgeNumber: 'MIZ-SDMA-108',
  stateZone: 'Aizawl District (All Wards)',
  lastActive: '5 mins ago',
  status: 'Active',
};

export const DEMO_FIELD_OFFICER: UserProfile = {
  id: 'usr-field-off-03',
  name: 'Er. T. Sailo',
  email: 't.sailo@gsi.gov.in',
  role: 'field-officer',
  department: 'Geological Survey of India (GSI) - Aizawl Unit',
  designation: 'Senior Geotechnical Instrumentation Engineer',
  clearanceLevel: 3,
  badgeNumber: 'GSI-AZL-404',
  stateZone: 'Durtlang & Chaltlang Ridges',
  lastActive: '12 mins ago',
  status: 'Active',
};

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onLogout,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setFeedbackMsg('Please enter an official government email or ID');
      return;
    }

    const user: UserProfile = {
      id: `usr-${Date.now()}`,
      name: email.split('@')[0].replace('.', ' ').toUpperCase() || 'OFFICER',
      email: email,
      role: email.toLowerCase().includes('admin') ? 'super-admin' : 'field-officer',
      department: 'Central Disaster Monitoring Division',
      designation: 'Operational Geotechnical Observer',
      clearanceLevel: 3,
      badgeNumber: 'NIC-NDMA-AUTH',
      stateZone: 'Aizawl District Operations',
      lastActive: 'Just now',
      status: 'Active',
    };

    onLogin(user);
    setFeedbackMsg(`Signed in successfully as ${user.name}`);
    setTimeout(() => {
      onClose();
      setFeedbackMsg(null);
    }, 800);
  };

  const handleSelectDemo = (demoUser: UserProfile) => {
    onLogin(demoUser);
    setFeedbackMsg(`Authenticated as ${demoUser.name} (${demoUser.role})`);
    setTimeout(() => {
      onClose();
      setFeedbackMsg(null);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] text-slate-900">
        <div className="h-1 w-full bg-[#0f2942]" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#0f2942] flex items-center justify-center shadow-xs border border-blue-200">
              <ShieldCheck className="w-6 h-6 text-[#0f2942]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                  Govt. of India • NDMA &amp; GSI
                </span>
                <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-300">
                  NIC SSO Gateway
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                Officer Authentication &amp; Portal Access
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                TerraGuard Landslide Monitoring &amp; Disaster Response Grid
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {currentUser && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#0f2942] text-white flex items-center justify-center font-bold text-xs">
                  {currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{currentUser.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800 uppercase">
                      {currentUser.role.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Badge: {currentUser.badgeNumber} • Clearance Level {currentUser.clearanceLevel}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  onLogout();
                  setFeedbackMsg('Signed out successfully.');
                }}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer transition-colors shadow-xs"
              >
                Sign Out
              </button>
            </div>
          )}

          {feedbackMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Quick Demo Logins Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                1-Click Verified Demonstration Profiles:
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Select to Test Roles</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Super Admin Demo */}
              <button
                type="button"
                onClick={() => handleSelectDemo(DEMO_SUPER_ADMIN)}
                className="p-3 rounded-2xl border border-slate-200 hover:border-[#0f2942] bg-white hover:bg-slate-50 text-left transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0f2942] text-white">
                    SUPER ADMIN
                  </span>
                  <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-xs font-bold text-slate-900 truncate">Dr. K. Radhakrishnan</div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">Director General • NDMA</div>
                <div className="mt-2 text-[10px] font-semibold text-[#0f2942] group-hover:underline flex items-center gap-1">
                  <span>Sign In as Super Admin</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </div>
              </button>

              {/* State Lead Demo */}
              <button
                type="button"
                onClick={() => handleSelectDemo(DEMO_STATE_LEAD)}
                className="p-3 rounded-2xl border border-slate-200 hover:border-[#0f2942] bg-white hover:bg-slate-50 text-left transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                    STATE LEAD
                  </span>
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-xs font-bold text-slate-900 truncate">Officer L. Ralte</div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">Mizoram SDMA Lead</div>
                <div className="mt-2 text-[10px] font-semibold text-[#0f2942] group-hover:underline flex items-center gap-1">
                  <span>Sign In as State Lead</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </div>
              </button>

              {/* Field Officer Demo */}
              <button
                type="button"
                onClick={() => handleSelectDemo(DEMO_FIELD_OFFICER)}
                className="p-3 rounded-2xl border border-slate-200 hover:border-[#0f2942] bg-white hover:bg-slate-50 text-left transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                    FIELD OFFICER
                  </span>
                  <Radio className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-xs font-bold text-slate-900 truncate">Er. T. Sailo</div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">GSI Geotech Engineer</div>
                <div className="mt-2 text-[10px] font-semibold text-[#0f2942] group-hover:underline flex items-center gap-1">
                  <span>Sign In as Field Officer</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </div>
              </button>
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Or Manual Official Sign In
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleCustomLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#0f2942]" />
                <span>Government Email / Officer Service ID</span>
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. officer.name@ndma.gov.in or admin@gov.in"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0f2942] text-xs font-medium shadow-xs"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#0f2942]" />
                  <span>Security Passcode / Token PIN</span>
                </label>
                <span className="text-[11px] text-slate-500">NIC Two-Factor Enforced</span>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0f2942] text-xs font-medium shadow-xs"
              />
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-950 space-y-1">
              <div className="font-semibold text-blue-900 flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5 text-blue-700" />
                <span>Statutory Compliance Notice:</span>
              </div>
              <p className="text-blue-800">
                Access is logged under National Disaster Management Authority protocols. Authorized officers must verify ground truth prior to warning dissemination.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#0f2942] hover:bg-[#1a365d] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-white" />
              <span>Verify Credentials &amp; Sign In</span>
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500 font-mono">
          Government of India • Ministry of Earth Sciences &amp; Ministry of Mines • NDMA Central Portal
        </div>
      </div>
    </div>
  );
};
