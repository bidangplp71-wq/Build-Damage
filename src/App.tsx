import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ROLE_NAV_CONFIGS } from './types';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { LoginScreen } from './components/LoginScreen';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { AssessmentTable } from './components/AssessmentTable';
import { AssessmentForm } from './components/AssessmentForm';
import { AssessmentDetailModal } from './components/AssessmentDetailModal';
import { WilayahManagement } from './components/WilayahManagement';
import { DukcapilManagement } from './components/DukcapilManagement';
import { UserManagement } from './components/UserManagement';
import { GoogleSheetIntegration } from './components/GoogleSheetIntegration';
import { FirebaseProtection } from './components/FirebaseProtection';
import { UserActivityLogView } from './components/UserActivityLogView';
import { SessionLockScreen } from './components/SessionLockScreen';
import { CheckCircle2, AlertCircle, Info, X, ShieldAlert, BellRing, Building2, ArrowRight } from 'lucide-react';

const MainLayout: React.FC = () => {
  const {
    isLoggedIn,
    activeTab,
    setActiveTab,
    currentUser,
    selectedAssessmentForDetail,
    setSelectedAssessmentForDetail,
    toastMessage,
    clearToast,
    latestIncomingData,
    clearLatestIncomingData,
    assessments,
  } = useApp();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Auto-dismiss latest incoming data banner after 8 seconds
  useEffect(() => {
    if (!latestIncomingData) return;
    const timer = setTimeout(() => {
      clearLatestIncomingData();
    }, 8000);
    return () => clearTimeout(timer);
  }, [latestIncomingData, clearLatestIncomingData]);

  // Tab guard: Ensure user cannot access tabs outside their role
  const roleConfig = ROLE_NAV_CONFIGS[currentUser.role];
  const isTabAllowed = roleConfig?.allowedTabs?.includes(activeTab);

  useEffect(() => {
    if (isLoggedIn && !isTabAllowed && roleConfig) {
      setActiveTab(roleConfig.defaultTab);
    }
  }, [isLoggedIn, currentUser.role, activeTab, isTabAllowed, roleConfig, setActiveTab]);

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans text-slate-900 antialiased selection:bg-amber-500 selection:text-slate-950 print:bg-white">
      {/* 1. Simple Vertical Tab Sidebar Navigation */}
      <div className="print:hidden"><Navigation
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      /></div>

      {/* 2. Main Work Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar with mobile hamburger and active tab title */}
        <div className="print:hidden"><Header onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)} /></div>

        {/* Dynamic Tab Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          <ErrorBoundary>
            {activeTab === 'dashboard' && <DashboardAnalytics />}
            {activeTab === 'penilaian' && <AssessmentTable />}
            {(activeTab === 'input_baru' || activeTab === 'tambah') && <AssessmentForm />}
            {activeTab === 'wilayah' && <WilayahManagement />}
            {activeTab === 'dukcapil' && <DukcapilManagement />}
            {(activeTab === 'manajemen_user' || activeTab === 'users') && <UserManagement />}
            {(activeTab === 'google_sheet' || activeTab === 'googlesheets') && <GoogleSheetIntegration />}
            {activeTab === 'log_aktivitas' && <UserActivityLogView />}
            {(activeTab === 'firebase_shield' || activeTab === 'firebase') && <FirebaseProtection />}
          </ErrorBoundary>
        </main>

        {/* Footer */}
        <footer className="print:hidden bg-white border-t border-slate-200 py-4 px-4 sm:px-6 lg:px-8 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">SIM-PKBG PUPR</span>
              <span>&bull;</span>
              <span>Pedoman Teknis Penilaian Kerusakan Bangunan Gedung Permen PUPR No. 22/PRT/M/2018</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-emerald-700 font-medium">✓ Firebase Protected</span>
              <span>&bull;</span>
              <span className="text-emerald-700 font-medium">✓ Google Sheet Synced</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Official printable / inspect detail modal */}
      {selectedAssessmentForDetail && (
        <AssessmentDetailModal
          assessment={selectedAssessmentForDetail}
          onClose={() => setSelectedAssessmentForDetail(null)}
        />
      )}

      {/* Real-time Incoming Data Notification Banner */}
      {latestIncomingData && (
        <aside aria-label="Notifikasi Data Masuk Real-Time" className="fixed top-18 right-4 sm:right-6 z-50 max-w-sm sm:max-w-md w-full animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <div className="p-4 rounded-2xl bg-slate-900/95 text-white border border-amber-500/40 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                  <BellRing className="w-5 h-5 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider">
                      Data Masuk Baru
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Baru saja
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-0.5 leading-snug truncate">
                    {latestIncomingData.buildingName}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 truncate">
                    {latestIncomingData.kecamatan ? `Kec. ${latestIncomingData.kecamatan}` : ''}
                    {latestIncomingData.desa ? `, Desa ${latestIncomingData.desa}` : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {latestIncomingData.damageClassification && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {latestIncomingData.damageClassification}
                      </span>
                    )}
                    {latestIncomingData.surveyorName && (
                      <span className="text-[10px] text-slate-400 truncate">
                        Oleh: {latestIncomingData.surveyorName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={clearLatestIncomingData}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                title="Tutup Notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Tersinkronisasi otomatis</span>
              <button
                onClick={() => {
                  const targetAss = assessments.find((a) => a.id === latestIncomingData.assessmentId);
                  if (targetAss) {
                    setSelectedAssessmentForDetail(targetAss);
                  }
                  clearLatestIncomingData();
                }}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Buka Detail</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs font-medium ${
              toastMessage.type === 'success'
                ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
                : toastMessage.type === 'error'
                ? 'bg-rose-900 text-rose-100 border-rose-700'
                : 'bg-slate-900 text-slate-100 border-slate-700'
            }`}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toastMessage.type === 'info' && <Info className="w-4 h-4 text-amber-400 shrink-0" />}
            <span>{toastMessage.text}</span>
            <button
              onClick={clearToast}
              className="p-1 hover:bg-white/20 rounded-lg text-slate-300 transition-colors ml-2"
              title="Tutup Notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Inactivity Session Lock Screen */}
      <SessionLockScreen />
    </div>
  );
};

import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ErrorBoundary>
  );
}
