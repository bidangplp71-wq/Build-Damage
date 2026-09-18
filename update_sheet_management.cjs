const fs = require('fs');

let code = fs.readFileSync('src/components/GoogleSheetIntegration.tsx', 'utf-8');

// 1. Add new state for newProfileMakeActive
code = code.replace(
  `const [newProfileDesc, setNewProfileDesc] = useState('');`,
  `const [newProfileDesc, setNewProfileDesc] = useState('');\n  const [newProfileMakeActive, setNewProfileMakeActive] = useState(false);`
);

// 2. Update handleAddNewProfile
const targetHandleAdd = `    const updatedProfiles = [...rawProfiles, newProfile];
    updateGoogleSheetConfig({
      spreadsheetProfiles: updatedProfiles,
      activeProfileId: newProfile.id,
      spreadsheetUrl: newProfile.spreadsheetUrl,
      webhookUrl: newProfile.webhookUrl,
      driveFolderId: newProfile.driveFolderId,
    });
    setSpreadsheetUrlInput(newProfile.spreadsheetUrl);
    if (newProfile.webhookUrl) setWebhookUrlInput(newProfile.webhookUrl);
    if (newProfile.driveFolderId) setDriveFolderIdInput(newProfile.driveFolderId);
    // Reset Form
    setNewProfileName('');
    setNewProfileUrl('');
    setNewProfileDesc('');
    setIsAddingProfile(false);
    showToast(\`Spreadsheet baru "\${newProfile.name}" berhasil didaftarkan dan langsung diaktifkan!\`, 'success');`;

const replaceHandleAdd = `    const updatedProfiles = [...rawProfiles, newProfile];
    if (newProfileMakeActive) {
      updateGoogleSheetConfig({
        spreadsheetProfiles: updatedProfiles,
        activeProfileId: newProfile.id,
        spreadsheetUrl: newProfile.spreadsheetUrl,
        webhookUrl: newProfile.webhookUrl,
        driveFolderId: newProfile.driveFolderId,
      });
      setSpreadsheetUrlInput(newProfile.spreadsheetUrl);
      if (newProfile.webhookUrl) setWebhookUrlInput(newProfile.webhookUrl);
      if (newProfile.driveFolderId) setDriveFolderIdInput(newProfile.driveFolderId);
      showToast(\`Spreadsheet "\${newProfile.name}" berhasil didaftarkan dan ditetapkan sebagai Destinasi Utama!\`, 'success');
    } else {
      updateGoogleSheetConfig({
        spreadsheetProfiles: updatedProfiles,
      });
      showToast(\`Sheet Rekap "\${newProfile.name}" berhasil ditambahkan! Sheet Utama Pengiriman Data Anda tetap utuh & tidak berubah.\`, 'success');
    }
    // Reset Form
    setNewProfileName('');
    setNewProfileUrl('');
    setNewProfileDesc('');
    setNewProfileMakeActive(false);
    setIsAddingProfile(false);`;

code = code.replace(targetHandleAdd, replaceHandleAdd);

// 3. Update the modal form for adding new profile to include the toggle checkbox & explanation
const targetFormFields = `                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Catatan / Deskripsi Spreadsheet
                  </label>
                  <input
                    type="text"
                    value={newProfileDesc}
                    onChange={(e) => setNewProfileDesc(e.target.value)}
                    placeholder="Contoh: Digunakan untuk pendataan fisik gedung sekolah dan fasilitas umum"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>`;

const replaceFormFields = `                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Catatan / Deskripsi Spreadsheet
                  </label>
                  <input
                    type="text"
                    value={newProfileDesc}
                    onChange={(e) => setNewProfileDesc(e.target.value)}
                    placeholder="Contoh: Digunakan untuk pendataan fisik gedung sekolah dan fasilitas umum"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-950 space-y-1.5">
                  <label className="flex items-start gap-2.5 cursor-pointer font-bold select-none">
                    <input
                      type="checkbox"
                      checked={newProfileMakeActive}
                      onChange={(e) => setNewProfileMakeActive(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-indigo-950 font-extrabold text-xs block">
                        Tetapkan sebagai Sheet Utama Pengiriman Data
                      </span>
                      <span className="block font-normal text-slate-600 text-[11px] mt-0.5 leading-snug">
                        Default: <b>TIDAK DICENTANG</b>. Jika tidak dicentang, sheet baru ini hanya akan menjadi <b>Sheet Rekap / Baca Data</b> tanpa mengubah Sheet Utama yang sudah Anda stel sebelumnya.
                      </span>
                    </div>
                  </label>
                </div>`;

code = code.replace(targetFormFields, replaceFormFields);

// 4. Update button text in the add profile modal
code = code.replace(
  `Simpan & Aktifkan Spreadsheet`,
  `Simpan Profile Sheet`
);

// 5. Update profile card rendering in GoogleSheetIntegration
const targetCard = `                            <h4 className="font-bold text-slate-950 text-sm">{profile.name}</h4>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black uppercase tracking-wider">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Aktif Digunakan</span>
                              </span>
                            )}
                            {profile.isDefault && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                Default PUPR
                              </span>
                            )}`;

const replaceCard = `                            <h4 className="font-bold text-slate-950 text-sm">{profile.name}</h4>
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs text-[10px] font-black uppercase tracking-wider">
                                <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                                <span>📍 Sheet Utama Pengiriman</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                📊 Sheet Rekap / Baca Data
                              </span>
                            )}
                            {profile.isDefault && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                Default PUPR
                              </span>
                            )}`;

code = code.replace(targetCard, replaceCard);

const targetBottomButtons = `                        {isActive ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Dokumen ini sedang menerima sinkronisasi data</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectProfile(profile)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                          >
                            <BookmarkCheck className="w-3.5 h-3.5" />
                            <span>Jadikan Sheet Aktif</span>
                          </button>
                        )}
                        {!profile.isDefault && rawProfiles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(profile.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            title="Hapus profil spreadsheet ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}`;

const replaceBottomButtons = `                        {isActive ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Tujuan Utama Pengiriman & Form Survei</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(\`Apakah Anda yakin ingin mengganti Sheet Utama Pengiriman Data ke "\${profile.name}"?\`)) {
                                handleSelectProfile(profile);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                            title="Ganti tujuan utama pengiriman form ke sheet ini"
                          >
                            <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                            <span>Ganti Jadi Sheet Utama</span>
                          </button>
                        )}
                        {!profile.isDefault && rawProfiles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(profile.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            title="Lepaskan & hapus sheet rekap ini agar tidak memberatkan sistem"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Lepaskan / Hapus Sheet</span>
                          </button>
                        )}`;

code = code.replace(targetBottomButtons, replaceBottomButtons);

fs.writeFileSync('src/components/GoogleSheetIntegration.tsx', code);
console.log('Updated GoogleSheetIntegration successfully!');
