const fs = require('fs');

let code = fs.readFileSync('src/components/AssessmentTable.tsx', 'utf-8');

// 1. Add extractSpreadsheetId import
code = code.replace(
  `import { exportAssessmentsToCSV, exportAssessmentsToExcelMultiSheet } from '../services/googleSheetsService';`,
  `import { exportAssessmentsToCSV, exportAssessmentsToExcelMultiSheet, extractSpreadsheetId } from '../services/googleSheetsService';`
);

// 2. Add showLiveSheetModal state
code = code.replace(
  `const [showPortfolioModal, setShowPortfolioModal] = useState(false);`,
  `const [showPortfolioModal, setShowPortfolioModal] = useState(false);\n  const [showLiveSheetModal, setShowLiveSheetModal] = useState(false);`
);

// 3. Add Pratinjau Live Sheet button in header button bar
const targetButtons = `<a
                href={googleSheetConfig.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Buka dokumen Google Spreadsheet langsung di tab baru"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-100/70 hover:bg-emerald-200/80 rounded-xl border border-emerald-300 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Buka Google Sheet</span>
                <ExternalLink className="w-3 h-3 text-emerald-700" />
              </a>`;

const replaceButtons = `<button
                type="button"
                onClick={() => setShowLiveSheetModal(true)}
                title="Pratinjau langsung isi Google Sheet di dalam web tanpa buka tab baru"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl border border-emerald-500 transition-colors cursor-pointer shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-950" />
                <span>Pratinjau Live Sheet</span>
              </button>
              <a
                href={googleSheetConfig.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Buka dokumen Google Spreadsheet langsung di tab baru"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-100/70 hover:bg-emerald-200/80 rounded-xl border border-emerald-300 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Buka di Tab Baru</span>
                <ExternalLink className="w-3 h-3 text-emerald-700" />
              </a>`;

code = code.replace(targetButtons, replaceButtons);

// 4. Append LiveSheetModal before the last closing tag `</div>`
const targetEndModal = `      {/* MODAL CETAK BUKU PORTOFOLIO REKAPITULASI RESMI A4 */}
      {showPortfolioModal && (
        <PortfolioRecapModal
          isOpen={showPortfolioModal}
          onClose={() => setShowPortfolioModal(false)}
          assessments={assessments}
          kecamatans={kecamatans}
          desas={desas}
        />
      )}`;

const liveSheetModalText = `      {/* MODAL CETAK BUKU PORTOFOLIO REKAPITULASI RESMI A4 */}
      {showPortfolioModal && (
        <PortfolioRecapModal
          isOpen={showPortfolioModal}
          onClose={() => setShowPortfolioModal(false)}
          assessments={assessments}
          kecamatans={kecamatans}
          desas={desas}
        />
      )}

      {/* MODAL PRATINJAU LANGSUNG GOOGLE SPREADSHEET (LIVE IN-APP VIEWER) */}
      {showLiveSheetModal && googleSheetConfig.spreadsheetUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-6xl w-full h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    <span>Pratinjau Langsung Google Spreadsheet</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                      Live Web Preview
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Periksa data baris, tab kecamatan, dan rekapitulasi secara instan di dalam web tanpa perlu bolak-balik tab browser.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={googleSheetConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
                >
                  <span>Buka Tab Baru</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setShowLiveSheetModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 w-full bg-slate-100 relative">
              {extractSpreadsheetId(googleSheetConfig.spreadsheetUrl) ? (
                <iframe
                  src={`https://docs.google.com/spreadsheets/d/${extractSpreadsheetId(googleSheetConfig.spreadsheetUrl)}/htmlembed?widget=true&headers=false`}
                  className="w-full h-full border-0"
                  title="Google Spreadsheet Live Preview"
                  allowFullScreen
                />
              ) : (
                <div className="flex items-center justify-center h-full p-6 text-center text-slate-500 text-xs">
                  URL Google Sheet belum dikonfigurasi dengan benar.
                </div>
              )}
            </div>
          </div>
        </div>
      )}`;

code = code.replace(targetEndModal, liveSheetModalText);

fs.writeFileSync('src/components/AssessmentTable.tsx', code);
console.log('AssessmentTable updated with Live Sheet Modal!');
