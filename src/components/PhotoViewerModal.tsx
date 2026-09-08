import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  Camera, 
  Download, 
  Layers,
  RotateCcw,
  Folder,
  RefreshCw,
  Upload,
  AlertTriangle
} from 'lucide-react';
import { BuildingPhoto } from '../types';
import { getPhotoLocally } from '../utils/photoStorage';
import { useApp } from '../context/AppContext';
import { compressImageFile } from '../utils/imageCompressor';

interface PhotoViewerModalProps {
  photos: BuildingPhoto[];
  initialIndex?: number;
  buildingTitle?: string;
  googleDriveFolderUrl?: string;
  assessmentId?: string;
  onClose: () => void;
}

const LightboxThumbnail: React.FC<{
  photo: BuildingPhoto;
  idx: number;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ photo, idx, isSelected, onSelect }) => {
  const [url, setUrl] = useState<string>(photo.url || '');

  useEffect(() => {
    if (photo.url) {
      setUrl(photo.url);
    } else if (photo.id) {
      getPhotoLocally(photo.id).then((cached) => {
        if (cached) setUrl(cached);
      });
    }
  }, [photo.id, photo.url]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer group bg-slate-900 flex items-center justify-center ${
        isSelected
          ? 'border-amber-400 scale-105 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/50'
          : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
      }`}
    >
      {url ? (
        <img
          src={url}
          alt={`Thumb ${idx + 1}`}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <Camera className="w-5 h-5 text-amber-400" />
      )}
      <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] text-center font-bold text-white py-0.5">
        #{idx + 1}
      </span>
    </button>
  );
};

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
  photos,
  initialIndex = 0,
  buildingTitle,
  googleDriveFolderUrl,
  assessmentId,
  onClose,
}) => {
  const { recoverAndSyncPhotos, attachPhotoToAssessment, showToast } = useApp();
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, photos.length - 1))
  );
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  const currentPhoto = photos[currentIndex];
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState<string>(currentPhoto?.url || '');
  const [isImageError, setIsImageError] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentPhoto) return;
    setIsImageError(false);

    if (currentPhoto.url && currentPhoto.url.length > 20) {
      setResolvedPhotoUrl(currentPhoto.url);
    } else if (currentPhoto.id) {
      getPhotoLocally(currentPhoto.id).then((cached) => {
        if (cached) {
          setResolvedPhotoUrl(cached);
        } else {
          setResolvedPhotoUrl(currentPhoto.url || '');
        }
      });
    }
  }, [currentPhoto]);

  const handleManualRecover = async () => {
    setIsRecovering(true);
    try {
      const res = await recoverAndSyncPhotos(assessmentId);
      if (res.recoveredCount > 0) {
        showToast(res.message, 'success');
        if (currentPhoto?.id) {
          const fresh = await getPhotoLocally(currentPhoto.id);
          if (fresh) {
            setResolvedPhotoUrl(fresh);
            setIsImageError(false);
          }
        }
      } else {
        showToast('Pemeriksaan selesai. ' + res.message, 'info');
      }
    } catch {
      showToast('Gagal memeriksa pemulihan foto.', 'error');
    } finally {
      setIsRecovering(false);
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentPhoto || !assessmentId) return;

    setIsLinking(true);
    try {
      showToast('Memproses & menautkan file foto...', 'info');
      const compressedUrl = await compressImageFile(file, 800, 800, 0.72);
      if (!compressedUrl) {
        throw new Error('Gagal mengompresi foto');
      }
      const success = await attachPhotoToAssessment(assessmentId, currentPhoto.id, compressedUrl);
      if (success) {
        setResolvedPhotoUrl(compressedUrl);
        setIsImageError(false);
        showToast('✓ Foto berhasil ditautkan dan tersimpan permanen di server!', 'success');
      } else {
        showToast('Gagal menyimpan foto ke server.', 'error');
      }
    } catch (err: any) {
      showToast('Gagal menautkan foto: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsLinking(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setZoomLevel(1);
      setRotation(0);
    }
  }, [currentIndex, photos.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setZoomLevel(1);
      setRotation(0);
    }
  }, [currentIndex]);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.35, 3.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.35, 0.6));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const handleDownload = () => {
    if (!resolvedPhotoUrl) return;
    const link = document.createElement('a');
    link.href = resolvedPhotoUrl;
    link.download = `foto_kerusakan_${currentIndex + 1}_${(currentPhoto?.damageLocation || 'gedung').replace(/\s+/g, '_')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  if (!currentPhoto) return null;

  return (
    <div id="photo-viewer-modal" className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-white backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 z-10 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <Camera className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md font-mono">
                Foto {currentIndex + 1} dari {photos.length}
              </span>
              {currentPhoto.damageLocation && (
                <span className="text-xs font-semibold bg-slate-800 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Layers className="w-3 h-3 text-amber-400" />
                  <span>{currentPhoto.damageLocation}</span>
                </span>
              )}
            </div>
            {buildingTitle && (
              <p className="text-xs text-slate-400 truncate mt-0.5 max-w-md">
                {buildingTitle}
              </p>
            )}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {googleDriveFolderUrl && (
            <a
              href={googleDriveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka Folder Foto Gedung di Google Drive"
              className="px-2.5 py-1.5 text-indigo-300 hover:text-white bg-indigo-900/60 hover:bg-indigo-800 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer border border-indigo-700/50"
            >
              <Folder className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Folder Drive ↗</span>
            </a>
          )}
          <button
            type="button"
            onClick={handleZoomIn}
            title="Perbesar (+)"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Perkecil (-)"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRotate}
            title="Putar 90 Derajat"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          {(zoomLevel !== 1 || rotation !== 0) && (
            <button
              type="button"
              onClick={handleReset}
              title="Reset Tampilan"
              className="p-2 text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
          {resolvedPhotoUrl && (
            <button
              type="button"
              onClick={handleDownload}
              title="Unduh Foto"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <div className="h-5 w-px bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={onClose}
            title="Tutup (Esc)"
            className="p-2 text-slate-400 hover:text-white hover:bg-rose-600/80 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden">
        {/* Navigation Prev Button */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Foto Sebelumnya"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-slate-900/80 hover:bg-amber-500 hover:text-slate-950 text-white rounded-full border border-slate-700/60 shadow-xl backdrop-blur-xs transition-all cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Navigation Next Button */}
        {currentIndex < photos.length - 1 && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Foto Selanjutnya"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-slate-900/80 hover:bg-amber-500 hover:text-slate-950 text-white rounded-full border border-slate-700/60 shadow-xl backdrop-blur-xs transition-all cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Display Image */}
        <div 
          className="relative max-h-full max-w-full flex items-center justify-center transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
          }}
        >
          {resolvedPhotoUrl && !isImageError ? (
            <img
              src={resolvedPhotoUrl}
              alt={currentPhoto.caption || `Foto Kerusakan ${currentIndex + 1}`}
              onError={() => setIsImageError(true)}
              className="max-h-[68vh] sm:max-h-[72vh] max-w-[90vw] sm:max-w-[85vw] object-contain rounded-lg shadow-2xl border border-slate-800 pointer-events-auto"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-slate-900/95 border border-slate-700/80 rounded-2xl text-center max-w-lg shadow-2xl backdrop-blur-md">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
                <Camera className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-white mb-1">
                Foto #{currentIndex + 1}: {currentPhoto.damageLocation || 'Bagian Kerusakan Bangunan'}
              </h4>
              <p className="text-xs text-amber-300/90 font-medium mb-4">
                {currentPhoto.caption || 'Foto dokumentasi survei lapangan'}
              </p>
              
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 mb-5 text-left space-y-1.5 w-full">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Foto Belum Dimuat di Browser Ini</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Foto fisik diambil di perangkat surveyor dan tersimpan di cache memori lokal atau Google Drive.
                  Anda dapat memulihkan foto secara instan tanpa perlu survei ulang:
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
                <button
                  type="button"
                  onClick={handleManualRecover}
                  disabled={isRecovering}
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRecovering ? 'animate-spin' : ''}`} />
                  {isRecovering ? 'Memeriksa Cache...' : 'Periksa & Sinkronkan Cache'}
                </button>

                {assessmentId && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileAttach}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLinking}
                      className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-slate-600 inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      {isLinking ? 'Menyimpan...' : 'Hubungkan File Foto'}
                    </button>
                  </>
                )}

                {googleDriveFolderUrl && (
                  <a
                    href={googleDriveFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border border-blue-700/60 font-medium text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Folder className="w-3.5 h-3.5 text-blue-400" />
                    Buka Google Drive
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Keterangan Bagian Kerusakan & Thumbnail Strip */}
      <div className="bg-slate-900/95 border-t border-slate-800 p-4 shrink-0 z-10">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Detailed Damage Info Banner */}
          <div className="bg-slate-800/90 rounded-xl p-3 border border-slate-700/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-amber-400">
                  Bagian Kerusakan:
                </span>
                <span className="text-xs font-bold text-white bg-slate-700 px-2 py-0.5 rounded">
                  {currentPhoto.damageLocation || 'Bagian Umum Bangunan'}
                </span>
                {currentPhoto.subComponentName && (
                  <span className="text-[11px] text-slate-300">
                    &bull; {currentPhoto.subComponentName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200 font-medium leading-relaxed">
                <span className="font-semibold text-slate-400">Keterangan Teknis:</span>{' '}
                {currentPhoto.caption || 'Tidak ada keterangan tambahan.'}
              </p>
            </div>
            {currentPhoto.takenAt && (
              <div className="text-[11px] text-slate-400 shrink-0 sm:text-right font-mono">
                Waktu Foto: {currentPhoto.takenAt}
              </div>
            )}
          </div>

          {/* Miniature Thumbnail Strip (up to 20 Photos) */}
          {photos.length > 1 && (
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-1 px-2 scrollbar-thin">
              {photos.map((photo, idx) => (
                <LightboxThumbnail
                  key={photo.id || idx}
                  photo={photo}
                  idx={idx}
                  isSelected={idx === currentIndex}
                  onSelect={() => {
                    setCurrentIndex(idx);
                    setZoomLevel(1);
                    setRotation(0);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
