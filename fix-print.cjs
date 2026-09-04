const fs = require('fs');

// 1. Update App.tsx
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

// Hide the entire main layout (except the modal) if the modal is open, during print
appContent = appContent.replace(
  '<div className="min-h-screen bg-slate-100 flex font-sans text-slate-900 antialiased selection:bg-amber-500 selection:text-slate-950">',
  '<div className="min-h-screen bg-slate-100 flex font-sans text-slate-900 antialiased selection:bg-amber-500 selection:text-slate-950 print:bg-white">'
);

appContent = appContent.replace(
  '<Navigation',
  '<div className="print:hidden"><Navigation'
);
appContent = appContent.replace(
  'onCloseMobile={() => setMobileNavOpen(false)}\n      />',
  'onCloseMobile={() => setMobileNavOpen(false)}\n      /></div>'
);

appContent = appContent.replace(
  '<div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">',
  '<div className={`flex-1 flex flex-col min-w-0 ${selectedAssessmentForDetail ? "print:hidden" : "print:overflow-visible print:block"}`}>'
);

appContent = appContent.replace(
  '<Header onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)} />',
  '<div className="print:hidden"><Header onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)} /></div>'
);

appContent = appContent.replace(
  '<footer className="no-print bg-white border-t border-slate-200 py-4 px-4 sm:px-6 lg:px-8 mt-auto">',
  '<footer className="print:hidden bg-white border-t border-slate-200 py-4 px-4 sm:px-6 lg:px-8 mt-auto">'
);

fs.writeFileSync('src/App.tsx', appContent);

// 2. Update AssessmentDetailModal.tsx
let modalContent = fs.readFileSync('src/components/AssessmentDetailModal.tsx', 'utf8');

modalContent = modalContent.replace(
  '<div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">',
  '<div className="print:hidden flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">'
);

modalContent = modalContent.replace(
  'print:static print:bg-transparent print:p-0 print:block',
  'print:absolute print:inset-0 print:bg-transparent print:p-0 print:block print:overflow-visible'
);

modalContent = modalContent.replace(
  'print:shadow-none print:border-none print:rounded-none print:max-w-none print:max-h-none print:block print:overflow-visible',
  'print:shadow-none print:border-none print:rounded-none print:max-w-none print:max-h-none print:block print:overflow-visible print:absolute print:top-0 print:left-0 print:w-full'
);

modalContent = modalContent.replace(
  'print-page space-y-6 print:overflow-visible print:h-auto',
  'space-y-6 print:overflow-visible print:h-auto print:p-0'
);

// Remove text-slate-900 print-page
modalContent = modalContent.replace(
  'text-slate-900 print-page',
  'text-slate-900'
);

fs.writeFileSync('src/components/AssessmentDetailModal.tsx', modalContent);
