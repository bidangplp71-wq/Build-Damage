const fs = require('fs');

let content = fs.readFileSync('src/components/AssessmentDetailModal.tsx', 'utf8');

// Add state
content = content.replace(
  'const [showSignatures, setShowSignatures] = useState(true);',
  'const [showSignatures, setShowSignatures] = useState(true);\n  const [showPhotos, setShowPhotos] = useState(false);' // Default without photos as per user feedback
);

// Add toggle button
const toggleHtml = `            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 bg-white border border-slate-300 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox" 
                checked={showPhotos} 
                onChange={(e) => setShowPhotos(e.target.checked)}
                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span>Cetak dgn Foto</span>
            </label>
            {/* Toggle Signatures */}`;
content = content.replace('{/* Toggle Signatures */}', toggleHtml);

// Apply to gallery wrapper
const oldGalleryWrapper = `{assessment.photos && assessment.photos.length > 0 && (
            <div className="pt-6 border-t border-slate-400 space-y-4 break-inside-avoid">`;

const newGalleryWrapper = `{showPhotos && assessment.photos && assessment.photos.length > 0 && (
            <div className="pt-6 border-t border-slate-400 space-y-4 break-inside-avoid">`;

content = content.replace(oldGalleryWrapper, newGalleryWrapper);

fs.writeFileSync('src/components/AssessmentDetailModal.tsx', content);
