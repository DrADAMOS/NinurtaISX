import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), ninurtaManualUpdatePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
    // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));

// Shared local-only update middleware for both `vite` and `vite preview`.
// The application is bound to 127.0.0.1 by its launcher.
function ninurtaManualUpdatePlugin() {
  const registerManualUpdate = (server: any) => {
    server.middlewares.use('/__ninurta/manual-update', (req: any, res: any) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      const origin = req.headers?.origin;
      const requestHost = String(req.headers?.host || '');
      if (origin && !isAllowedLocalOrigin(origin, requestHost)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ ok: false, error: 'طلب غير مسموح من مصدر خارجي' }));
        return;
      }
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
        return;
      }
      const root = process.cwd();
      const script = path.join(root, 'scripts', 'update-market-data-public.py');
      const stocksFile = path.join(root, 'src', 'data', 'stocks.json');
      if (!fs.existsSync(script) || !fs.existsSync(stocksFile)) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: 'ملفات التحديث المحلية غير مكتملة' }));
        return;
      }
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'py.exe' : 'python3';
      const args = isWindows ? ['-3', script] : [script];
      const child = spawn(command, args, {
        cwd: root,
        windowsHide: true,
        env: { ...process.env, PYTHONUTF8: '1' },
      });
      let output = '';
      let errorOutput = '';
      child.stdout.on('data', (chunk: any) => { output = (output + chunk.toString()).slice(-12000); });
      child.stderr.on('data', (chunk: any) => { errorOutput = (errorOutput + chunk.toString()).slice(-12000); });
      child.on('error', (error: Error) => {
        if (res.writableEnded) return;
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: `تعذر تشغيل Python: ${error.message}` }));
      });
      child.on('close', (code: number | null) => {
        if (res.writableEnded) return;
        if (code !== 0) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: (errorOutput || output || `Updater exit code ${code}`).trim() }));
          return;
        }
        try {
          const stocks = JSON.parse(fs.readFileSync(stocksFile, 'utf8'));
          res.statusCode = 200;
          res.end(JSON.stringify({
            ok: true,
            stocks,
            message: 'اكتمل تحديث الأسعار المنشورة. البيانات التاريخية والمؤشرات لم تتغير.',
          }));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: `تعذر قراءة بيانات الأسهم بعد التحديث: ${String(error)}` }));
        }
      });
    });
  };

  return {
    name: 'ninurta-local-manual-update',
    configureServer: registerManualUpdate,
    configurePreviewServer: registerManualUpdate,
  };
}


// Accept only a same-origin request served from a loopback address. This keeps
// the local updater working if Vite selects a fallback port (for example 3001)
// while still rejecting requests initiated by remote websites.
function isAllowedLocalOrigin(origin: string, requestHost: string): boolean {
  if (!requestHost || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(requestHost)) {
    return false;
  }
  try {
    const parsed = new URL(origin);
    const isLoopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
    return parsed.protocol === 'http:' && isLoopback && parsed.host.toLowerCase() === requestHost.toLowerCase();
  } catch {
    return false;
  }
}
