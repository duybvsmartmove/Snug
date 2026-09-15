import { defineConfig } from 'vite';
import { resolve, join, normalize } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, unlinkSync, rmdirSync, readdirSync } from 'node:fs';

// Một repo, hai trang:
//   index.html   game
//   editor.html  Level Editor
//
// Nội dung nằm trong public/content và đi kèm bản build:
//   levels.json            sắp xếp chương và level
//   assets/index.json      mục lục mã số → file mô tả
//   assets/<chương>/…      ảnh món, túi, bối cảnh
// Lúc chơi game không gọi mạng. Editor ghi vào thư mục này qua cầu ghi của server dev.
const CONTENT_DIR = resolve(__dirname, 'public/content');

function contentBridge() {
  const safe = p => {
    const full = normalize(join(CONTENT_DIR, p));
    if (!full.startsWith(CONTENT_DIR) || p.includes('..')) throw new Error('bad path');
    return full;
  };
  const readBody = req => new Promise(res => { let s = ''; req.on('data', c => (s += c)); req.on('end', () => res(s ? JSON.parse(s) : {})); });
  const send = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
  return {
    name: 'content-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/__content/')) return next();
        try {
          if (req.method === 'POST' && req.url.startsWith('/__content/save')) {
            const { path, text, base64 } = await readBody(req);
            const full = safe(path);
            mkdirSync(resolve(full, '..'), { recursive: true });
            writeFileSync(full, base64 != null ? Buffer.from(base64, 'base64') : text);
            return send(res, 200, { ok: true, path });
          }
          if (req.method === 'POST' && req.url.startsWith('/__content/delete')) {
            const { path } = await readBody(req);
            const full = safe(path);
            if (existsSync(full)) unlinkSync(full);
            let dir = resolve(full, '..');
            while (dir.startsWith(CONTENT_DIR) && dir !== CONTENT_DIR && existsSync(dir) && readdirSync(dir).length === 0) {
              rmdirSync(dir); dir = resolve(dir, '..');
            }
            return send(res, 200, { ok: true });
          }
          send(res, 404, { error: 'unknown' });
        } catch (e) { send(res, 400, { error: String(e.message || e) }); }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [contentBridge()],
  server: { port: 5173, open: false },
  build: {
    outDir: 'dist', target: 'es2020',
    rollupOptions: { input: { game: resolve(__dirname, 'index.html'), editor: resolve(__dirname, 'editor.html') } },
  },
});
