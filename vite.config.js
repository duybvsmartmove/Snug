import { defineConfig } from 'vite';

// Game client. Content (chương, level, art) nằm ở public/content và được Level Editor
// ghi vào — editor là repo riêng, tự dựng cầu ghi file ở server dev của nó.
export default defineConfig({
  base: './',
  server: { port: 5173, open: false, cors: true },
  preview: { port: 5173, cors: true },
  build: { outDir: 'dist', target: 'es2020' },
});
