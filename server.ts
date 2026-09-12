import express from 'express';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;
const CONFIG_FILE_PATH = path.join(process.cwd(), 'google_sheet_config.json');

// Middleware to parse JSON bodies with high limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'photos');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Durable local data directory for server-side persistence
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const ASSESSMENTS_FILE = path.join(DATA_DIR, 'assessments.json');
const ASSESSMENTS_BACKUP_FILE = path.join(DATA_DIR, 'assessments.backup.json');

// Helper to safely load assessments from server file
function getStoredAssessments(): any[] {
  try {
    if (fs.existsSync(ASSESSMENTS_FILE)) {
      const content = fs.readFileSync(ASSESSMENTS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading assessments file, checking backup:', err);
    try {
      if (fs.existsSync(ASSESSMENTS_BACKUP_FILE)) {
        const backupContent = fs.readFileSync(ASSESSMENTS_BACKUP_FILE, 'utf8');
        const parsedBackup = JSON.parse(backupContent);
        if (Array.isArray(parsedBackup)) return parsedBackup;
      }
    } catch (bErr) {
      console.error('Error reading assessments backup:', bErr);
    }
  }
  return [];
}

// Helper to safely write assessments to server file with backup
function saveStoredAssessments(list: any[]): boolean {
  try {
    if (!Array.isArray(list)) return false;
    const jsonStr = JSON.stringify(list, null, 2);
    // Write backup first if current file exists
    if (fs.existsSync(ASSESSMENTS_FILE)) {
      try {
        fs.copyFileSync(ASSESSMENTS_FILE, ASSESSMENTS_BACKUP_FILE);
      } catch {}
    }
    fs.writeFileSync(ASSESSMENTS_FILE, jsonStr, 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing assessments file:', err);
    return false;
  }
}

// Serve uploaded photos statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ==========================================
// ASSESSMENTS API (Zero-quota Cloud Persistence)
// ==========================================

// GET /api/assessments - Fetch all assessments stored on server
app.get('/api/assessments', (req, res) => {
  try {
    const list = getStoredAssessments();
    res.json({
      success: true,
      count: list.length,
      assessments: list,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Gagal mengambil data penilaian: ' + err.message });
  }
});

// POST /api/assessments - Upsert single assessment non-destructively
app.post('/api/assessments', (req, res) => {
  try {
    const assessment = req.body;
    if (!assessment || !assessment.id) {
      return res.status(400).json({ success: false, message: 'Data penilaian dan ID wajib ada' });
    }

    const currentList = getStoredAssessments();
    const map = new Map<string, any>();
    currentList.forEach((a) => {
      if (a && a.id) map.set(a.id, a);
    });

    const existing = map.get(assessment.id);
    if (existing) {
      // Precise merge: if photos is provided in payload, always respect updated photos array
      const mergedPhotos =
        assessment.photos !== undefined
          ? assessment.photos
          : existing.photos || [];

      map.set(assessment.id, {
        ...existing,
        ...assessment,
        photos: mergedPhotos,
        backupDriveUrl: assessment.backupDriveUrl !== undefined ? assessment.backupDriveUrl : existing.backupDriveUrl,
        googleDriveFolderUrl: assessment.googleDriveFolderUrl !== undefined
          ? assessment.googleDriveFolderUrl
          : (assessment.backupDriveUrl !== undefined ? assessment.backupDriveUrl : existing.googleDriveFolderUrl),
        updatedAt: assessment.updatedAt || new Date().toISOString(),
      });
    } else {
      map.set(assessment.id, assessment);
    }

    const updatedList = Array.from(map.values());
    saveStoredAssessments(updatedList);

    return res.json({
      success: true,
      count: updatedList.length,
      assessment: map.get(assessment.id),
      message: 'Data penilaian berhasil disimpan di server!',
    });
  } catch (err: any) {
    console.error('Error saving assessment on server:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan penilaian: ' + err.message });
  }
});

// POST /api/assessments/sync-batch - Batch sync / merge assessments
app.post('/api/assessments/sync-batch', (req, res) => {
  try {
    const { assessments: incomingList, replace } = req.body;
    if (!Array.isArray(incomingList)) {
      return res.status(400).json({ success: false, message: 'Array assessments diperlukan' });
    }

    if (replace) {
      saveStoredAssessments(incomingList);
      return res.json({
        success: true,
        count: incomingList.length,
        assessments: incomingList,
        message: `${incomingList.length} data penilaian berhasil diperbarui bersih di server!`,
      });
    }

    const currentList = getStoredAssessments();
    const map = new Map<string, any>();
    // 1. Keep all existing assessments on server
    currentList.forEach((a) => {
      if (a && a.id) map.set(a.id, a);
    });

    // 2. Non-destructively merge incoming assessments
    incomingList.forEach((incoming) => {
      if (!incoming || !incoming.id) return;
      const existing = map.get(incoming.id);
      if (!existing) {
        map.set(incoming.id, incoming);
      } else {
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const incomingTime = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();
        if (incomingTime >= existingTime) {
          const mergedPhotos =
            incoming.photos && incoming.photos.length > 0
              ? incoming.photos
              : existing.photos || [];
          map.set(incoming.id, { ...existing, ...incoming, photos: mergedPhotos });
        }
      }
    });

    const merged = Array.from(map.values());
    saveStoredAssessments(merged);

    return res.json({
      success: true,
      count: merged.length,
      assessments: merged,
      message: `${merged.length} data penilaian berhasil tersinkron di server!`,
    });
  } catch (err: any) {
    console.error('Error batch syncing assessments on server:', err);
    return res.status(500).json({ success: false, message: 'Gagal sinkronisasi batch: ' + err.message });
  }
});

// DELETE /api/assessments/:id - Delete single assessment on server
app.delete('/api/assessments/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID diperlukan' });
    }

    const currentList = getStoredAssessments();
    const filtered = currentList.filter((a) => a.id !== id);
    saveStoredAssessments(filtered);

    return res.json({
      success: true,
      deletedId: id,
      remainingCount: filtered.length,
      message: 'Data penilaian berhasil dihapus dari server',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus penilaian: ' + err.message });
  }
});

// POST /api/webhook / POST /api/sheet-webhook - Catch incoming survey data from Google Apps Script or external tools
app.all(['/api/webhook', '/api/sheet-webhook'], (req, res) => {
  try {
    const payload = req.body || req.query;
    console.log('Incoming webhook received:', typeof payload === 'object' ? Object.keys(payload) : payload);

    if (payload && typeof payload === 'object') {
      const currentList = getStoredAssessments();
      const map = new Map<string, any>();
      currentList.forEach((a) => {
        if (a && a.id) map.set(a.id, a);
      });

      // If array of items
      if (Array.isArray(payload.data)) {
        payload.data.forEach((item: any) => {
          if (item && (item.id || item.code || item.buildingName)) {
            const itemId = item.id || `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            map.set(itemId, { ...item, id: itemId });
          }
        });
      } else if (payload.buildingName || payload.id || payload.code) {
        const itemId = payload.id || `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        map.set(itemId, { ...payload, id: itemId });
      }

      const updated = Array.from(map.values());
      saveStoredAssessments(updated);
    }

    return res.json({
      status: 'success',
      success: true,
      message: 'Webhook data received and safely saved to server',
    });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// API endpoint to upload a single photo
app.post('/api/photos/upload', (req, res) => {
  try {
    const { photoId, assessmentId, dataUrl } = req.body;
    if (!photoId || !dataUrl) {
      return res.status(400).json({ success: false, message: 'photoId dan dataUrl wajib diisi' });
    }

    const cleanPhotoId = (photoId || `photo_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    let ext = 'jpg';
    let base64Data = dataUrl;

    if (dataUrl.startsWith('data:')) {
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mime = matches[1];
        base64Data = matches[2];
        if (mime.includes('png')) ext = 'png';
        else if (mime.includes('webp')) ext = 'webp';
      } else {
        base64Data = dataUrl.split(',')[1] || dataUrl;
      }
    }

    const filename = `${cleanPhotoId}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/photos/${filename}`;
    return res.json({
      success: true,
      photoId,
      url: publicUrl,
      size: buffer.length,
      message: 'Foto berhasil disimpan di server!',
    });
  } catch (err: any) {
    console.error('Error saving photo on server:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan foto: ' + err.message });
  }
});

// API endpoint to delete a single physical photo file from server
app.delete('/api/photos/:photoId', (req, res) => {
  try {
    const { photoId } = req.params;
    if (!photoId) {
      return res.status(400).json({ success: false, message: 'photoId wajib diisi' });
    }

    const cleanPhotoId = photoId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const extensions = ['jpg', 'png', 'webp', 'jpeg'];
    let deleted = false;

    for (const ext of extensions) {
      const filePath = path.join(UPLOADS_DIR, `${cleanPhotoId}.${ext}`);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          deleted = true;
        } catch (e) {
          console.warn('Gagal unlink file foto:', filePath, e);
        }
      }
    }

    return res.json({
      success: true,
      deleted,
      photoId,
      message: deleted ? 'File foto fisik berhasil dihapus dari server.' : 'File foto tidak ditemukan atau sudah terhapus.',
    });
  } catch (err: any) {
    console.error('Error deleting photo from server:', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus file foto: ' + err.message });
  }
});

// API endpoint to batch sync photos (used by auto-recovery engine)
app.post('/api/photos/sync-batch', (req, res) => {
  try {
    const { photos } = req.body;
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ success: false, message: 'Array photos diperlukan' });
    }

    const results: Record<string, string> = {};
    for (const item of photos) {
      if (!item.photoId || !item.dataUrl) continue;
      const cleanPhotoId = item.photoId.replace(/[^a-zA-Z0-9_-]/g, '_');
      let ext = 'jpg';
      let base64Data = item.dataUrl;

      if (item.dataUrl.startsWith('data:')) {
        const matches = item.dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mime = matches[1];
          base64Data = matches[2];
          if (mime.includes('png')) ext = 'png';
          else if (mime.includes('webp')) ext = 'webp';
        } else {
          base64Data = item.dataUrl.split(',')[1] || item.dataUrl;
        }
      }

      const filename = `${cleanPhotoId}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, filename);
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);

      results[item.photoId] = `/uploads/photos/${filename}`;
    }

    return res.json({
      success: true,
      savedCount: Object.keys(results).length,
      urls: results,
      message: `${Object.keys(results).length} foto berhasil disinkronkan ke server!`,
    });
  } catch (err: any) {
    console.error('Error batch syncing photos on server:', err);
    return res.status(500).json({ success: false, message: 'Gagal sinkronisasi batch foto: ' + err.message });
  }
});

// Load saved config or fall back to environment variables
function getGoogleSheetConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading google_sheet_config.json:', err);
  }
  return {
    spreadsheetUrl: process.env.VITE_SPREADSHEET_URL || '',
    webhookUrl: process.env.VITE_WEBHOOK_URL || '',
    driveFolderId: process.env.VITE_DRIVE_FOLDER_ID || 'https://drive.google.com/drive/folders/1xKF8SYvNY97A9-ga0B42z3jQTbcC_Tk5?usp=sharing',
  };
}

// 1. API route to get Google Sheet config
app.get('/api/config', (req, res) => {
  const config = getGoogleSheetConfig();
  res.json({
    success: true,
    config,
  });
});

// 2. API route to update Google Sheet config (called by Super Admin)
app.post('/api/config', (req, res) => {
  const { spreadsheetUrl, webhookUrl, driveFolderId } = req.body;
  const currentConfig = getGoogleSheetConfig();
  const config = {
    ...currentConfig,
    spreadsheetUrl: spreadsheetUrl !== undefined ? spreadsheetUrl : currentConfig.spreadsheetUrl,
    webhookUrl: webhookUrl !== undefined ? webhookUrl : currentConfig.webhookUrl,
    driveFolderId: driveFolderId !== undefined ? driveFolderId : currentConfig.driveFolderId,
  };

  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
    res.json({
      success: true,
      message: 'Konfigurasi Google Sheet & Drive berhasil disimpan di server!',
      config,
    });
  } catch (err: any) {
    console.error('Error saving google_sheet_config.json:', err);
    res.status(500).json({
      success: false,
      message: 'Gagal menyimpan konfigurasi di server: ' + (err?.message || 'Error internal'),
    });
  }
});

// ==========================================
// PYTHON FAST ANALYTICS API (Permen PUPR)
// ==========================================
app.all('/api/analytics/python', (req, res) => {
  try {
    const assessments = req.body?.assessments || req.body || [];
    const inputList = Array.isArray(assessments) && assessments.length > 0
      ? assessments
      : getStoredAssessments();

    const scriptPath = path.join(process.cwd(), 'scripts', 'data_analyzer.py');

    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({
        success: false,
        message: 'Modul Python scripts/data_analyzer.py tidak ditemukan di server.',
      });
    }

    const pyProcess = spawn('python3', [scriptPath]);
    let stdoutData = '';
    let stderrData = '';

    pyProcess.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    pyProcess.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python process failed with exit code:', code, stderrData);
        return res.status(500).json({
          success: false,
          message: 'Eksekusi analisis data Python gagal: ' + (stderrData || `Code ${code}`),
        });
      }

      try {
        const parsed = JSON.parse(stdoutData);
        return res.json(parsed);
      } catch (parseErr: any) {
        return res.status(500).json({
          success: false,
          message: 'Gagal mem-parsing output JSON dari Python: ' + parseErr.message,
          rawOutput: stdoutData.substring(0, 500),
        });
      }
    });

    pyProcess.stdin.write(JSON.stringify(inputList));
    pyProcess.stdin.end();
  } catch (err: any) {
    console.error('Error invoking Python analytics:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal memanggil Python engine: ' + (err?.message || 'Internal Error'),
    });
  }
});

// Setup Vite middleware or static serving
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});
