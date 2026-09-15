const fs = require('fs');
let code = fs.readFileSync('src/components/AssessmentForm.tsx', 'utf8');

const target = `        {/* Indikator Otomatis Masuk ke Tab Google Sheet Sesuai Kecamatan */}`;

const replacement = `        {/* Pemilihan Target Halaman Sheet (Hanya tampil jika ada > 1 buku) */}
        {googleSheetConfig.spreadsheetProfiles && googleSheetConfig.spreadsheetProfiles.length > 1 && (
          <div className="mb-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50/50">
            <label className="block text-[11px] font-bold text-indigo-900 mb-1.5 uppercase tracking-wide">
              Pilih Halaman / Buku Google Sheet Tujuan
            </label>
            <select
              value={targetProfileId}
              onChange={(e) => setTargetProfileId(e.target.value)}
              className="w-full px-3 py-2 bg-white rounded-lg border border-indigo-200 text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {googleSheetConfig.spreadsheetProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.id === googleSheetConfig.activeProfileId ? '(Sheet Aktif Global)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-indigo-700/70 font-medium mt-1.5 leading-snug">
              Jika surveyor tidak memilih, data akan masuk ke Sheet Aktif Global secara otomatis.
            </p>
          </div>
        )}

        {/* Indikator Otomatis Masuk ke Tab Google Sheet Sesuai Kecamatan */}`;

code = code.split(target).join(replacement);
fs.writeFileSync('src/components/AssessmentForm.tsx', code);
