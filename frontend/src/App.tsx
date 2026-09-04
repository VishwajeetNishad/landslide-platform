import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationTab, UserProfile, AlertItem } from './types';
import { TopHeader } from './components/TopHeader';
import { Sidebar } from './components/Sidebar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { RiskMapView } from './components/RiskMapView';
import { VerificationQueueView } from './components/VerificationQueueView';
import { AlertsView } from './components/AlertsView';
import { MonitoringView } from './components/MonitoringView';
import { HistoryView } from './components/HistoryView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { SuperAdminView } from './components/SuperAdminView';
import { AnalyticsView } from './components/AnalyticsView';
import { AuthModal, DEMO_STATE_LEAD } from './components/AuthModal';
import { SystemStatusModal } from './components/SystemStatusModal';
import { EmergencyDispatchModal } from './components/EmergencyDispatchModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30000,
      retry: 1,
    },
  },
});

function AppContent() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('overview');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(DEMO_STATE_LEAD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSystemStatusOpen, setIsSystemStatusOpen] = useState(false);
  const [isEmergencyDispatchOpen, setIsEmergencyDispatchOpen] = useState(false);
  const [presetDispatchAlert, setPresetDispatchAlert] = useState<AlertItem | null>(null);
  const [focusedMarkerId, setFocusedMarkerId] = useState<string | null>(null);

  const handleOpenEmergencyDispatch = (alert?: AlertItem) => {
    setPresetDispatchAlert(alert || null);
    setIsEmergencyDispatchOpen(true);
  };

  const handleFocusMarkerOnMap = (markerId: string) => {
    setFocusedMarkerId(markerId);
    setCurrentTab('risk-map');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-950">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenEmergencyDispatch={() => handleOpenEmergencyDispatch()}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        currentUser={currentUser}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Top Header */}
      <TopHeader
        currentTab={currentTab}
        onOpenSystemStatus={() => setIsSystemStatusOpen(true)}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onNavigateTo={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <main className="flex-1 md:pl-[280px] pt-16 transition-all duration-300 min-h-screen bg-slate-100">
        {(currentTab === 'overview' || currentTab === 'dashboard') && (
          <OverviewDashboard
            currentUser={currentUser}
            onNavigateTo={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenEmergencyDispatch={handleOpenEmergencyDispatch}
          />
        )}

        {currentTab === 'risk-map' && (
          <RiskMapView
            initialSelectedMarkerId={focusedMarkerId}
            onClearInitialMarker={() => setFocusedMarkerId(null)}
          />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsView />
        )}

        {currentTab === 'verification-queue' && (
          <VerificationQueueView
            currentUser={currentUser}
            onSelectSlopeUnitOnMap={(slopeUnitId) => {
              setCurrentTab('overview');
            }}
          />
        )}

        {currentTab === 'alerts-decisions' && (
          <AlertsView onOpenEmergencyDispatch={handleOpenEmergencyDispatch} />
        )}

        {currentTab === 'monitoring' && <MonitoringView />}

        {currentTab === 'history' && <HistoryView />}

        {currentTab === 'reports' && <ReportsView />}

        {currentTab === 'settings' && <SettingsView />}

        {currentTab === 'admin' && <SuperAdminView currentUser={currentUser} />}
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onLogin={(user) => setCurrentUser(user)}
        onLogout={() => setCurrentUser(null)}
      />

      <SystemStatusModal
        isOpen={isSystemStatusOpen}
        onClose={() => setIsSystemStatusOpen(false)}
      />

      <EmergencyDispatchModal
        isOpen={isEmergencyDispatchOpen}
        onClose={() => setIsEmergencyDispatchOpen(false)}
        presetAlert={presetDispatchAlert}
      />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
