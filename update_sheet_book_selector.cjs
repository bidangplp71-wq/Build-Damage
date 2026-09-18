const fs = require('fs');

let code = fs.readFileSync('src/components/SheetBookSelector.tsx', 'utf-8');

// 1. Add state makeActiveAsPrimary
code = code.replace(
  `const [newMaxCapacity, setNewMaxCapacity] = useState<number>(2000);`,
  `const [newMaxCapacity, setNewMaxCapacity] = useState<number>(2000);\n  const [makeActiveAsPrimary, setMakeActiveAsPrimary] = useState<boolean>(false);`
);

// 2. Update handleCreateProfile logic
const targetLogic = `    // Automatically set as active so user doesn't have to double-click
    updateGoogleSheetConfig({
      ...googleSheetConfig,
      spreadsheetProfiles: updatedProfiles,
      activeProfileId: newProfile.id,
      spreadsheetUrl: newProfile.spreadsheetUrl,
      webhookUrl: newProfile.webhookUrl,
      driveFolderId: newProfile.driveFolderId,
    });
    logUserActivity(
      'SYNC_GOOGLE_SHEET',
      'Integrasi Google Sheet',
      \`Menambahkan Halaman/Buku Spreadsheet Baru: \${newProfile.name}\`,
      newProfile.name,
      \`Kapasitas Maksimal: \${newProfile.maxCapacityRows} baris\`
    );
    // Reset Form
    setNewName('');
    setNewUrl('');
    setNewDesc('');
    setShowAddModal(false);
    showToast(\`✓ Halaman Sheet Baru "\${newProfile.name}" berhasil dibuat dan langsung diaktifkan untuk semua pengguna!\`, 'success');`;

const replaceLogic = `    if (makeActiveAsPrimary) {
      updateGoogleSheetConfig({
        ...googleSheetConfig,
        spreadsheetProfiles: updatedProfiles,
        activeProfileId: newProfile.id,
        spreadsheetUrl: newProfile.spreadsheetUrl,
        webhookUrl: newProfile.webhookUrl,
        driveFolderId: newProfile.driveFolderId,
      });
      showToast(\`✓ "\${newProfile.name}" berhasil dibuat dan ditetapkan sebagai Destinasi Utama Pengiriman Data!\`, 'success');
    } else {
      updateGoogleSheetConfig({
        ...googleSheetConfig,
        spreadsheetProfiles: updatedProfiles,
      });
      showToast(\`✓ Sheet Rekap "\${newProfile.name}" berhasil ditambahkan! Sheet Utama Pengiriman Data Anda tidak berubah.\`, 'success');
    }
    logUserActivity(
      'SYNC_GOOGLE_SHEET',
      'Integrasi Google Sheet',
      \`Menambahkan Halaman/Buku Spreadsheet Baru: \${newProfile.name}\`,
      newProfile.name,
      \`Kapasitas Maksimal: \${newProfile.maxCapacityRows} baris\`
    );
    // Reset Form
    setNewName('');
    setNewUrl('');
    setNewDesc('');
    setMakeActiveAsPrimary(false);
    setShowAddModal(false);`;

code = code.replace(targetLogic, replaceLogic);

// 3. Add checkbox inside the modal in SheetBookSelector
const targetModalInputs = `              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Catatan / Keterangan
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Contoh: Digunakan untuk arsip rekapitulasi atau periode survei tertentu"
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>`;

const replaceModalInputs = `              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Catatan / Keterangan
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Contoh: Digunakan untuk arsip rekapitulasi atau periode survei tertentu"
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-950 space-y-1">
                <label className="flex items-start gap-2.5 cursor-pointer font-bold select-none">
                  <input
                    type="checkbox"
                    checked={makeActiveAsPrimary}
                    onChange={(e) => setMakeActiveAsPrimary(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-indigo-950 font-extrabold text-xs block">
                      Tetapkan Sebagai Destinasi Utama Pengiriman Data
                    </span>
                    <span className="block font-normal text-slate-600 text-[11px] mt-0.5 leading-snug">
                      Default: <b>TIDAK DICENTANG</b>. Jika tidak dicentang, sheet ini hanya didaftarkan sebagai <b>Sheet Rekap / Baca Data</b> tanpa mengubah Sheet Utama aktif Anda.
                    </span>
                  </div>
                </label>
              </div>`;

code = code.replace(targetModalInputs, replaceModalInputs);

fs.writeFileSync('src/components/SheetBookSelector.tsx', code);
console.log('Updated SheetBookSelector successfully!');
