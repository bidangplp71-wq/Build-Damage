import React, { useState, useEffect, useCallback } from 'react';
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
  RotateCcw
} from 'lucide-react';
import { BuildingPhoto } from '../types';

interface PhotoViewerModalProps {
  photos: BuildingPhoto[];
  initialIndex?: number;
  buildingTitle?: string;
  onClose: () => void;
}

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
  photos,
  initialIndex = 0,
  buildingTitle,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, photos.length - 1))
  );
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  const currentPhoto = photos[currentIndex];

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
    if (!currentPhoto) return;
    const link = document.createElement('a');
    link.href = currentPhoto.url;
    link.download = `foto_kerusakan_${currentIndex + 1}_${(currentPhoto.damageLocation || 'gedung').replace(/\s+/g, '_')}.jpg`;
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
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-white backdrop-blur-md animate-in fade-in duration-200 select-none">
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
          <button
            type="button"
            onClick={handleDownload}
            title="Unduh Foto"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
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
          <img
            src={currentPhoto.url}
            alt={currentPhoto.caption || `Foto Kerusakan ${currentIndex + 1}`}
            className="max-h-[68vh] sm:max-h-[72vh] max-w-[90vw] sm:max-w-[85vw] object-contain rounded-lg shadow-2xl border border-slate-800 pointer-events-auto"
            referrerPolicy="no-referrer"
          />
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

          {/* Miniature Thumbnail Strip (10 Photos) */}
          {photos.length > 1 && (
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-1 px-2 scrollbar-thin">
              {photos.map((photo, idx) => {
                const isSelected = idx === currentIndex;
                return (
                  <button
                    key={photo.id || idx}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setZoomLevel(1);
                      setRotation(0);
                    }}
                    className={`relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer group ${
                      isSelected
                        ? 'border-amber-400 scale-105 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/50'
                        : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={`Thumb ${idx + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] text-center font-bold text-white py-0.5">
                      #{idx + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
