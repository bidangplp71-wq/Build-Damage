const fs = require('fs');
let code = fs.readFileSync('src/components/AssessmentTable.tsx', 'utf8');

const replacement = `                        {/* Photo Viewer Button */}
                        {(() => {
                          let validCount = 0;
                          let errorCount = 0;
                          if (item.photos && item.photos.length > 0) {
                            item.photos.forEach(p => {
                              if (p.url && p.url.length > 50) validCount++;
                              else errorCount++;
                            });
                          }
                          const totalCount = validCount + errorCount;
                          
                          if (totalCount > 0) {
                            return (
                              <button
                                onClick={() => {
                                  setPhotoViewerAssessment(item);
                                  setPhotoViewerInitialIndex(0);
                                }}
                                title={errorCount > 0 ? \`Ada \${errorCount} Foto Error/Kosong! Klik untuk melihat.\` : \`Lihat \${totalCount} Foto Visual Kerusakan\`}
                                className={\`p-1.5 rounded-lg border transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer \${errorCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse hover:bg-rose-100' : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'}\`}
                              >
                                {errorCount > 0 ? <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> : <Camera className="w-3.5 h-3.5 text-amber-600" />}
                                <span>{totalCount}</span>
                              </button>
                            );
                          } else if (item.googleDriveFolderUrl) {
                            return (
                              <a
                                href={item.googleDriveFolderUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Buka Folder Dokumentasi Foto Gedung di Google Drive"
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                              >
                                <Folder className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Drive</span>
                              </a>
                            );
                          } else {
                            return (
                              <span
                                title="Belum ada foto visual"
                                className="p-1.5 rounded-lg bg-slate-50 text-slate-300 border border-slate-100 flex items-center justify-center cursor-not-allowed"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </span>
                            );
                          }
                        })()}`;

const target = `                        {/* Photo Viewer Button */}
                        {item.photos && item.photos.length > 0 ? (
                          <button
                            onClick={() => {
                              setPhotoViewerAssessment(item);
                              setPhotoViewerInitialIndex(0);
                            }}
                            title={\`Lihat \${item.photos.length} Foto Visual Kerusakan Gedung\`}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5 text-amber-600" />
                            <span>{item.photos.length}</span>
                          </button>
                        ) : item.googleDriveFolderUrl ? (
                          <a
                            href={item.googleDriveFolderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Buka Folder Dokumentasi Foto Gedung di Google Drive"
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                          >
                            <Folder className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Drive</span>
                          </a>
                        ) : (
                          <span
                            title="Belum ada foto visual"
                            className="p-1.5 rounded-lg bg-slate-50 text-slate-300 border border-slate-100 flex items-center justify-center cursor-not-allowed"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </span>
                        )}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/AssessmentTable.tsx', code);
