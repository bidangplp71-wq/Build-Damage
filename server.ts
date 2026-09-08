import express from 'express';
import path from 'path';
import fs from 'fs';
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

// Serve uploaded photos statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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
