import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync, rmSync } from 'node:fs';

// Game client. Content (chương, level, art) nằm ở public/content và được Level Editor
// ghi vào — editor là repo riêng, tự dựng cầu ghi file ở server dev của nó.
// Bản nháp chỉ phục vụ lúc dựng level, không cần đi kèm bản game giao cho người chơi.
function dropDraft() {
  return {
    name: 'drop-draft',
    closeBundle() {
      const draft = resolve(__dirname, 'dist/content/draft');
      if (existsSync(draft)) { rmSync(draft, { recursive: true, force: true }); console.log('  bỏ content/draft khỏi bản build'); }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [dropDraft()],
  server: { port: 5173, open: false, cors: true },
  preview: { port: 5173, cors: true },
  build: { outDir: 'dist', target: 'es2020' },
});
