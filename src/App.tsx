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
import { SessionLockScreen } from './components/SessionLockScreen';
import { CheckCircle2, AlertCircle, Info, X, ShieldAlert } from 'lucide-react';

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
  } = useApp();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  // Tab guard: Ensure user cannot access tabs outside their role
  const roleConfig = ROLE_NAV_CONFIGS[currentUser.role];
  const isTabAllowed = roleConfig?.allowedTabs?.includes(activeTab);

  useEffect(() => {
    if (!isTabAllowed && roleConfig) {
      setActiveTab(roleConfig.defaultTab);
    }
  }, [currentUser.role, activeTab, isTabAllowed, roleConfig, setActiveTab]);

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans text-slate-900 antialiased selection:bg-amber-500 selection:text-slate-950">
      {/* 1. Simple Vertical Tab Sidebar Navigation */}
      <Navigation
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* 2. Main Work Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top bar with mobile hamburger and active tab title */}
        <Header onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)} />

        {/* Dynamic Tab Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          {activeTab === 'dashboard' && <DashboardAnalytics />}
          {activeTab === 'penilaian' && <AssessmentTable />}
          {(activeTab === 'input_baru' || activeTab === 'tambah') && <AssessmentForm />}
          {activeTab === 'wilayah' && <WilayahManagement />}
          {activeTab === 'dukcapil' && <DukcapilManagement />}
          {(activeTab === 'manajemen_user' || activeTab === 'users') && <UserManagement />}
          {(activeTab === 'google_sheet' || activeTab === 'googlesheets') && <GoogleSheetIntegration />}
          {(activeTab === 'firebase_shield' || activeTab === 'firebase') && <FirebaseProtection />}
        </main>

        {/* Footer */}
        <footer className="no-print bg-white border-t border-slate-200 py-4 px-4 sm:px-6 lg:px-8 mt-auto">
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

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
