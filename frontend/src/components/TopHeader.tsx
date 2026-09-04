import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Menu, 
  Check, 
  ChevronRight,
  ChevronDown,
  LogIn,
  Server,
  RefreshCw,
  AlertCircle,
  Activity,
  Shield,
  MapPin,
  Sparkles,
  User
} from 'lucide-react';
import { NavigationTab, UserProfile } from '../types';
import { api } from '../lib/api';

interface TopHeaderProps {
  currentTab: NavigationTab;
  onOpenSystemStatus: () => void;
  onOpenMobileMenu: () => void;
  onNavigateTo: (tab: NavigationTab) => void;
  onOpenAuthModal: () => void;
  currentUser: UserProfile | null;
  apiStatus?: {
    isLive: boolean;
    error?: string | null;
    isLoading?: boolean;
    refetch?: () => void;
  };
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentTab,
  onOpenSystemStatus,
  onOpenMobileMenu,
  onNavigateTo,
  onOpenAuthModal,
  currentUser,
  apiStatus,
}) => {
  const [istTime, setIstTime] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);
  const [currentSource, setCurrentSource] = useState<'live' | 'mock'>(api.getDataSource());

  useEffect(() => {
    const unsub = api.subscribe(() => {
      setCurrentSource(api.getDataSource());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      };
      const timeStr = now.toLocaleTimeString('en-GB', options);
      setIstTime(`IST ${timeStr}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const notifications = [
    {
      id: 1,
      title: 'Melthum Urban Sector (AZ-1142)',
      detail: 'HIGH Risk alert pending officer verification (120 exposed pop)',
      time: '10 mins ago',
      level: 'critical',
      tab: 'verification-queue' as NavigationTab,
    },
    {
      id: 2,
      title: 'Durtlang North Escarpment (AZ-1088)',
      detail: 'High Failure Probability (95%) with 0 Exposure -> LOW Risk classification validated',
      time: '25 mins ago',
      level: 'info',
      tab: 'risk-map' as NavigationTab,
    },
  ];

  const toggleDataSource = () => {
    const next = currentSource === 'live' ? 'mock' : 'live';
    api.setDataSource(next);
    if (apiStatus?.refetch) {
      apiStatus.refetch();
    }
  };

  const apiUrlDisplay = api.getBaseUrl();
  const isSimulated = currentSource === 'mock';

  return (
    <header className="fixed top-0 right-0 z-40 h-16 bg-white text-slate-900 border-b border-slate-200 shadow-xs flex flex-col justify-between md:ml-[280px] w-full md:w-[calc(100%-280px)]">
      {/* Official Government of India Tricolor Top Stripe */}
      <div className="h-1 w-full bg-gradient-to-r from-[#FF9933] via-white to-[#138808] border-b border-slate-200 shrink-0" />

      <div className="flex-1 flex items-center justify-between px-4 sm:px-6">
        {/* Left side: Mobile Menu + Product Name + Subtitle */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand: TerraGuard / Landslide Early Warning System */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#0f2942] rounded-xl flex items-center justify-center shadow-sm shrink-0 text-white border border-slate-300">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base lg:text-lg font-black tracking-tight text-[#0f2942] leading-tight truncate">
                  TerraGuard
                </h1>
                {/* Region Selector: Aizawl, Mizoram */}
                <div className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-800">
                  <MapPin className="w-3 h-3 text-[#0f2942]" />
                  <span>Aizawl, Mizoram</span>
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold truncate">
                Govt. of Mizoram • Landslide Early Warning System
              </p>
            </div>
          </div>
        </div>

        {/* Right side: System Status + SIMULATED DATA badge + User Area */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* SIMULATED DATA Badge whenever prototype/mock data is active */}
          {isSimulated && (
            <div className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-3 h-3 text-amber-700" />
              <span>SIMULATED DATA</span>
            </div>
          )}

          {/* Current System Status Indicator */}
          <div className="hidden lg:flex flex-col items-end leading-tight">
            <button
              onClick={toggleDataSource}
              className="text-[11px] text-slate-500 font-mono hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1"
              title="Toggle between Live backend & Mock sample data"
            >
              <span>API:</span>
              <span className="text-slate-800 font-semibold truncate max-w-[140px]">{apiUrlDisplay}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase bg-slate-100 text-slate-700 border border-slate-300">
                {currentSource}
              </span>
            </button>
            <div className="flex items-center gap-1.5 text-xs mt-0.5">
              <span className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse" />
              <span className="font-bold tracking-wide text-[10px] font-mono text-emerald-700">SYSTEM LIVE • OPERATIONAL</span>
              <span className="text-slate-400 text-[10px] ml-1 font-mono">{istTime}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block h-7 w-px bg-slate-200" />

          {/* Telemetry Status trigger */}
          <button
            onClick={onOpenSystemStatus}
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold border border-slate-300 cursor-pointer transition-colors shadow-xs"
            title="Telemetry Nodes & Sensor Feeds"
          >
            <Activity className="w-3.5 h-3.5 text-[#0f2942]" />
            <span>Sensors</span>
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              id="notifications-btn"
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors relative cursor-pointer border border-transparent hover:border-slate-200"
              title="Critical Alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full ring-2 ring-white animate-pulse" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Priority Alerts ({notifications.length})
                  </span>
                  <button
                    onClick={() => {
                      setUnreadCount(0);
                      setShowNotifications(false);
                    }}
                    className="text-[10px] text-blue-700 hover:underline cursor-pointer font-semibold"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="divide-y divide-slate-100 mt-1 max-h-60 overflow-y-auto">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        onNavigateTo(n.tab);
                        setShowNotifications(false);
                      }}
                      className="py-2.5 hover:bg-slate-50 p-2 rounded-xl transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="text-xs font-bold text-slate-900 leading-tight">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">{n.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User / Profile Area */}
          <div className="flex items-center gap-2 pl-1">
            {currentUser ? (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-800 transition-colors cursor-pointer shadow-xs"
                title="User Profile"
              >
                <div className="w-6 h-6 rounded-full bg-[#0f2942] text-white flex items-center justify-center font-black text-[11px]">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <span className="font-bold text-slate-900 block text-xs truncate max-w-[100px]">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate max-w-[100px]">
                    {currentUser.role}
                  </span>
                </div>
              </button>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0f2942] text-white hover:bg-[#1a365d] text-xs font-bold transition-colors cursor-pointer shadow-xs border border-[#0f2942]"
              >
                <LogIn className="w-3.5 h-3.5 text-white" />
                <span className="hidden sm:inline">Officer Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
