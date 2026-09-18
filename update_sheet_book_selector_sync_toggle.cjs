const fs = require('fs');

let code = fs.readFileSync('src/components/SheetBookSelector.tsx', 'utf-8');

// Ensure Lucide icons: PowerOff, Lock, Zap are imported
if (!code.includes('PowerOff')) {
  code = code.replace(
    `import {`,
    `import { PowerOff, Lock, Zap,`
  );
}

// Add helper functions handleToggleSyncEnable, handleDisableAllArchiveSync, handleEnableAllArchiveSync inside component
const targetHandlers = `  const handleSetActiveGlobal = (profile: SpreadsheetProfile) => {`;

const replaceHandlers = `  // Toggle Pelepasan Sync / Load control per profile
  const handleToggleSyncEnable = (profile: SpreadsheetProfile) => {
    if (profile.id === activeProfileId) {
      showToast('Worksheet Tujuan Utama selamanya harus selalu dimuat saat sinkronisasi data.', 'info');
      return;
    }

    const nextState = profile.isSyncEnabled === false ? true : false;
    const updatedProfiles = profiles.map((p) =>
      p.id === profile.id ? { ...p, isSyncEnabled: nextState } : p
    );

    updateGoogleSheetConfig({
      ...googleSheetConfig,
      spreadsheetProfiles: updatedProfiles,
    });

    if (nextState) {
      showToast(\`✓ "\${profile.name}" diaktifkan dalam pemuatan sinkronisasi data.\`, 'success');
    } else {
      showToast(\`⚪ "\${profile.name}" dilepaskan dari pemuatan sinkronisasi (menghemat beban memori sistem).\`, 'info');
    }
  };

  const handleDisableAllArchiveSync = () => {
    const updatedProfiles = profiles.map((p) => ({
      ...p,
      isSyncEnabled: p.id === activeProfileId ? true : false,
    }));
    updateGoogleSheetConfig({
      ...googleSheetConfig,
      spreadsheetProfiles: updatedProfiles,
    });
    showToast('⚡ Seluruh worksheet arsip telah dilepaskan! Hanya Worksheet Utama yang akan dimuat saat sync.', 'success');
  };

  const handleEnableAllArchiveSync = () => {
    const updatedProfiles = profiles.map((p) => ({
      ...p,
      isSyncEnabled: true,
    }));
    updateGoogleSheetConfig({
      ...googleSheetConfig,
      spreadsheetProfiles: updatedProfiles,
    });
    showToast('📥 Seluruh worksheet diaktifkan kembali untuk dimuat saat sinkronisasi.', 'success');
  };

  const handleSetActiveGlobal = (profile: SpreadsheetProfile) => {`;

code = code.replace(targetHandlers, replaceHandlers);

// Update Header Top Bar to include batch load controls
const targetHeaderBar = `<div className="flex flex-wrap items-center gap-2">
            {/* Filter "Semua Halaman" */}`;

const replaceHeaderBar = `<div className="flex flex-wrap items-center gap-2">
            {/* Indicator of Sync Enabled Count */}
            {profiles.length > 1 && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900">
                <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Sync: {profiles.filter(p => p.id === activeProfileId || p.isSyncEnabled !== false).length}/{profiles.length} Sheet Dimuat</span>
              </div>
            )}

            {/* Quick Batch Sync Control Buttons */}
            {profiles.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleDisableAllArchiveSync}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-300 shadow-2xs"
                  title="Lepaskan pemuatan seluruh worksheet arsip untuk meringankan beban sistem"
                >
                  <PowerOff className="w-3.5 h-3.5 text-slate-600" />
                  <span>Lepas Arsip (Hemat Beban)</span>
                </button>
                <button
                  type="button"
                  onClick={handleEnableAllArchiveSync}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold transition-all cursor-pointer border border-emerald-300 shadow-2xs"
                  title="Aktifkan kembali pemuatan seluruh worksheet saat sinkronisasi"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Muat Semua</span>
                </button>
              </div>
            )}

            {/* Filter "Semua Halaman" */}`;

code = code.replace(targetHeaderBar, replaceHeaderBar);

// Add Pelepasan Sync Toggle inside each card bottom actions
const targetCardBottomAction = `                {/* Bottom Action Buttons */}`;

const replaceCardBottomAction = `                {/* Pelepasan Sync / Load Control Bar per Card */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] bg-slate-50/70 p-2 rounded-xl">
                  <span className="text-slate-600 font-semibold text-[10px] flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" /> Pemuatan Sync:
                  </span>
                  {isGloballyActive ? (
                    <span
                      title="Worksheet Tujuan Utama selamanya harus selalu dimuat"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 font-black border border-emerald-300 text-[10px]"
                    >
                      <Lock className="w-3 h-3 text-emerald-700 shrink-0" />
                      <span>Selalu Dimuat (Utama)</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleSyncEnable(profile)}
                      title={
                        profile.isSyncEnabled !== false
                          ? 'Klik untuk melepaskan pemuatan worksheet ini saat sync guna menghemat beban sistem'
                          : 'Klik untuk mengaktifkan pemuatan data worksheet ini saat sync'
                      }
                      className={\`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer shadow-2xs \${
                        profile.isSyncEnabled !== false
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300 border border-slate-300'
                      }\`}
                    >
                      {profile.isSyncEnabled !== false ? (
                        <>
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Dimuat saat Sync</span>
                        </>
                      ) : (
                        <>
                          <PowerOff className="w-3 h-3 text-slate-600" />
                          <span>Dilepaskan (Hemat Beban)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Bottom Action Buttons */}`;

code = code.replace(targetCardBottomAction, replaceCardBottomAction);

fs.writeFileSync('src/components/SheetBookSelector.tsx', code);
console.log('SheetBookSelector sync toggle updated successfully!');
