import React, { useState } from 'react';
import { Camera, ZoomIn, Layers, Trash2, Edit3, Image as ImageIcon, Eye } from 'lucide-react';
import { BuildingPhoto } from '../types';
import { PhotoViewerModal } from './PhotoViewerModal';

interface BuildingPhotoGalleryProps {
  photos: BuildingPhoto[];
  buildingTitle?: string;
  isEditable?: boolean;
  onDeletePhoto?: (photoId: string) => void;
  onEditPhoto?: (photo: BuildingPhoto) => void;
}

export const BuildingPhotoGallery: React.FC<BuildingPhotoGalleryProps> = ({
  photos = [],
  buildingTitle,
  isEditable = false,
  onDeletePhoto,
  onEditPhoto,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  if (!photos || photos.length === 0) {
    return (
      <div className="p-6 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-slate-400">
        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-xs font-semibold text-slate-600">Belum ada foto dokumentasi kerusakan visual</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Maksimal 20 foto kerusakan dengan keterangan bagian yang difoto (tersimpan aman di Firebase Cloud Storage / Firestore).</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-bold text-slate-800">
            Dokumentasi Visual Kerusakan ({photos.length} / 20 Foto)
          </span>
        </div>
        <span className="text-[11px] text-slate-500 italic">
          Klik foto untuk memperbesar & melihat detail bagian
        </span>
      </div>

      {/* Responsive Small Thumbnails Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 print:grid-cols-4 print:gap-2.5">
        {photos.map((photo, index) => (
          <div
            key={photo.id || index}
            className="group relative flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden hover:border-amber-400 print:rounded-lg print:border-slate-300 print:shadow-none avoid-break"
          >
            {/* Image Thumbnail Container */}
            <div 
              onClick={() => setSelectedPhotoIndex(index)}
              className="relative aspect-4/3 w-full bg-slate-900 cursor-pointer overflow-hidden print:aspect-4/3"
              title="Klik untuk memperbesar foto"
            >
              <img
                src={photo.url}
                alt={photo.caption || `Foto Kerusakan ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                referrerPolicy="no-referrer"
                loading="eager"
              />
              
              {/* Top badges */}
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                <span className="bg-slate-950/80 text-amber-400 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-xs backdrop-blur-xs">
                  #{index + 1}
                </span>
              </div>

              {/* Zoom overlay hint on hover */}
              <div className="no-print absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 text-xs font-semibold backdrop-blur-2xs">
                <ZoomIn className="w-4 h-4 text-amber-300" />
                <span>Perbesar</span>
              </div>
            </div>

            {/* Information Body */}
            <div className="p-2.5 flex-1 flex flex-col justify-between text-left bg-white print:p-2">
              <div className="space-y-1">
                {/* Damage Location Badge */}
                <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 rounded truncate print:border-slate-300 print:bg-slate-100" title={photo.damageLocation || 'Bagian Bangunan'}>
                  <Layers className="w-2.5 h-2.5 shrink-0 text-indigo-500 no-print" />
                  <span className="truncate">{photo.damageLocation || 'Bagian Bangunan'}</span>
                </div>

                {/* Caption / Keterangan Kerusakan */}
                <p 
                  className="text-[11px] text-slate-700 font-medium line-clamp-2 leading-tight print:text-[10px] print:line-clamp-3"
                  title={photo.caption || 'Tanpa keterangan'}
                >
                  {photo.caption || <span className="text-slate-400 italic">Tanpa keterangan</span>}
                </p>
              </div>

              {/* Action Buttons if editable */}
              {isEditable && (
                <div className="no-print flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhotoIndex(index);
                    }}
                    className="text-[10px] text-slate-500 hover:text-amber-600 font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Lihat</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {onEditPhoto && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditPhoto(photo);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                        title="Edit Keterangan / Bagian"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                    {onDeletePhoto && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePhoto(photo.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        title="Hapus Foto"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox / Zoom Modal */}
      {selectedPhotoIndex !== null && (
        <PhotoViewerModal
          photos={photos}
          initialIndex={selectedPhotoIndex}
          buildingTitle={buildingTitle}
          onClose={() => setSelectedPhotoIndex(null)}
        />
      )}
    </div>
  );
};
