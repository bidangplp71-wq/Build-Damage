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

// Middleware to parse JSON bodies
app.use(express.json());

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
  const { spreadsheetUrl, webhookUrl } = req.body;
  const config = {
    spreadsheetUrl: spreadsheetUrl || '',
    webhookUrl: webhookUrl || '',
  };

  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
    res.json({
      success: true,
      message: 'Konfigurasi Google Sheet berhasil disimpan di server!',
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
