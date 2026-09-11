import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { spawn } from 'child_process';
import fs from 'fs';

function pythonAnalyticsPlugin(): Plugin {
  return {
    name: 'vite-plugin-python-analytics',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/analytics/python' && (req.method === 'POST' || req.method === 'GET')) {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });
          req.on('end', () => {
            try {
              let payload: any = {};
              if (bodyStr.trim()) {
                payload = JSON.parse(bodyStr);
              }
              const assessments = payload.assessments || [];
              const scriptPath = path.join(process.cwd(), 'scripts', 'data_analyzer.py');

              if (fs.existsSync(scriptPath)) {
                const py = spawn('python3', [scriptPath]);
                let stdout = '';
                let stderr = '';

                py.stdout.on('data', (c) => {
                  stdout += c.toString();
                });
                py.stderr.on('data', (c) => {
                  stderr += c.toString();
                });

                py.on('close', (code) => {
                  res.setHeader('Content-Type', 'application/json');
                  if (code === 0 && stdout.trim()) {
                    res.statusCode = 200;
                    res.end(stdout);
                  } else {
                    res.statusCode = 200;
                    res.end(
                      JSON.stringify({
                        success: false,
                        fallbackAvailable: true,
                        message: stderr || 'Python execution completed with non-zero exit code',
                      })
                    );
                  }
                });

                py.stdin.write(JSON.stringify(assessments));
                py.stdin.end();
                return;
              }
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: false,
                  fallbackAvailable: true,
                  message: err.message,
                })
              );
              return;
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), pythonAnalyticsPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
