import React from 'react';
import { 
  LayoutDashboard, 
  Radio, 
  Map, 
  FileText, 
  History, 
  Settings, 
  Shield,
  ShieldCheck,
  ShieldAlert,
  X,
  LogIn,
  Key,
  ListChecks,
  BarChart3
} from 'lucide-react';
import { NavigationTab, UserProfile } from '../types';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenEmergencyDispatch?: () => void;
  onOpenAuthModal: () => void;
  currentUser: UserProfile | null;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuthModal,
  currentUser,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems: { id: NavigationTab; label: string; icon: React.ReactNode; badge?: string; badgeColor?: string }[] = [
    { 
      id: 'overview', 
      label: 'Risk Dashboard', 
      icon: <LayoutDashboard className="w-4 h-4" /> 
    },
    { 
      id: 'risk-map', 
      label: 'Geospatial Map', 
      icon: <Map className="w-4 h-4" />,
      badge: 'Aizawl',
      badgeColor: 'bg-slate-100 text-slate-700 border border-slate-200'
    },
    { 
      id: 'analytics', 
      label: 'Hydrology & Analytics', 
      icon: <BarChart3 className="w-4 h-4" />,
      badge: '3-Tank',
      badgeColor: 'bg-slate-100 text-slate-700 border border-slate-200'
    },
    { 
      id: 'verification-queue', 
      label: 'Verification Queue', 
      icon: <ListChecks className="w-4 h-4" />,
      badge: 'Triage',
      badgeColor: 'bg-slate-100 text-slate-700 border border-slate-200'
    },
    { 
      id: 'alerts-decisions', 
      label: 'Alerts & Decisions', 
      icon: <ShieldAlert className="w-4 h-4" />, 
      badge: 'CAP 1.2', 
      badgeColor: 'bg-[#0f2942] text-white font-bold border border-[#0f2942]' 
    },
    { 
      id: 'monitoring', 
      label: 'Geotech Telemetry', 
      icon: <Radio className="w-4 h-4" /> 
    },
    { 
      id: 'history', 
      label: 'Incident Archive', 
      icon: <History className="w-4 h-4" /> 
    },
    { 
      id: 'reports', 
      label: 'Statutory Reports', 
      icon: <FileText className="w-4 h-4" /> 
    },
    { 
      id: 'settings', 
      label: 'System Settings', 
      icon: <Settings className="w-4 h-4" /> 
    },
  ];

  const isItemActive = (id: NavigationTab) => {
    if (id === 'overview' && (currentTab === 'overview' || currentTab === 'dashboard')) return true;
    return currentTab === id;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-[280px] bg-white text-slate-800 flex flex-col z-50 border-r border-slate-200 shadow-sm transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0f2942] flex items-center justify-center text-white shadow-sm shrink-0 border border-slate-300">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight text-[#0f2942] leading-tight">
                TerraGuard
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                Mizoram SDMA • LEWS
              </div>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              title="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Live Monitoring Indicator Pill */}
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <div className="w-full py-1.5 px-3 bg-white border border-emerald-200 rounded-lg flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span className="text-xs font-semibold tracking-wide text-emerald-800">
                District Telemetry Live
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              200 OK
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = isItemActive(item.id);
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0f2942] text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-white' : 'text-slate-500'}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-white/20 text-white font-bold' : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Officer Profile Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          {currentUser ? (
            <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#0f2942] text-white flex items-center justify-center text-xs font-black shrink-0 shadow-inner">
                  {currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 uppercase tracking-wider truncate font-semibold">
                    <ShieldCheck className="w-3 h-3 text-blue-600" />
                    {currentUser.role.replace('-', ' ')}
                  </span>
                </div>
              </div>
              <button
                onClick={onOpenAuthModal}
                title="Switch Account or Sign Out"
                className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="w-full py-2 px-3 bg-[#0f2942] hover:bg-[#1a365d] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors border border-[#0f2942]"
            >
              <LogIn className="w-4 h-4 text-white" />
              <span>Officer Sign In / Register</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
