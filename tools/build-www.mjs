/* Assemble www/ — the exact set of files that ships inside the Android app.
 *
 * `vite build` emits three pages into dist/: the game (index.html), the Level
 * Editor (editor.html) and the Creative Tool (creative.html). Only the game
 * belongs in an APK — the other two are desktop tools for the team.
 * So www/ is dist/ minus those two pages and the chunks only they pull in.
 *
 * Which chunks those are is read out of the two built HTML files rather than
 * guessed from filenames: Vite hashes names and moves shared code into its own
 * chunk, so "starts with editor-" would be wrong the first time a chunk is
 * split differently.
 */
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, statSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const WWW = join(ROOT, 'www');

// Every local asset a built page references, transitively: a JS chunk imports
// other chunks, and those names appear nowhere in the HTML.
function assetsOf(htmlName) {
  const seen = new Set();
  const walk = (file, text) => {
    for (const [, rel] of text.matchAll(/["'(]\.?\/?(assets\/[A-Za-z0-9._-]+)["')]/g)) {
      if (seen.has(rel)) continue;
      seen.add(rel);
      const full = join(DIST, rel);
      if (/\.(js|css)$/.test(rel)) walk(full, readFileSync(full, 'utf8'));
    }
  };
  walk(htmlName, readFileSync(join(DIST, htmlName), 'utf8'));
  return seen;
}

const game = assetsOf('index.html');
const TOOL_PAGES = ['editor.html', 'creative.html'];
const editorOnly = [...new Set(TOOL_PAGES.flatMap(p => [...assetsOf(p)]))].filter(a => !game.has(a));

rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });
cpSync(DIST, WWW, {
  recursive: true,
  filter: src => {
    const rel = src.slice(DIST.length + 1);
    if (!rel) return true;
    if (TOOL_PAGES.includes(rel) || rel === '.DS_Store') return false;
    return !editorOnly.includes(rel);
  },
});

// Report the payload so an accidentally huge bundle is impossible to miss.
let bytes = 0, files = 0;
(function count(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    statSync(p).isDirectory() ? count(p) : (bytes += statSync(p).size, files++);
  }
})(WWW);
console.log(`www/ built — ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MB (editor left out: ${editorOnly.join(', ') || 'none'})`);

// ---- Bản nội dung đóng gói (dùng khi KHÔNG có mạng) ----
// Có mạng thì app đọc config, level, ảnh trên GitHub Pages ngay lúc mở (src/content/remote.js),
// y như bản web. Bản đóng gói ở đây chỉ dùng khi máy không có mạng, nên vẫn nên kéo bản mới
// (git pull) trước khi build để người chơi offline cũng có nội dung gần nhất.
//   ART=casual npm run android:sync   → bản đóng gói chạy casual, không sửa file config của repo.
const cfgFile = join(WWW, 'content', 'config.json');
const cfg = JSON.parse(readFileSync(cfgFile, 'utf8'));
const ep = process.env.ART;
if (ep) {
  if (!['cozy', 'casual'].includes(ep)) { console.error(`ART=${ep} không hợp lệ (cozy hoặc casual)`); process.exit(1); }
  cfg.art = ep; writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + '\n');
}
console.log(`\n>>> Có mạng: app đọc nội dung trên GitHub Pages. Không mạng: dùng bản đóng gói, bộ art ${cfg.art.toUpperCase()}${ep ? ' (ép bằng ART=' + ep + ')' : ''}`);

// Máy còn thiếu commit nội dung (đổi bộ art, sửa level) từ GitHub thì cảnh báo
try {
  execSync('git fetch -q origin', { cwd: ROOT, stdio: 'ignore', timeout: 15000 });
  const thieu = execSync('git log --oneline HEAD..origin/main -- public/content', { cwd: ROOT, encoding: 'utf8' }).trim();
  if (thieu) {
    console.warn(`\n!!! Máy đang THIẾU ${thieu.split('\n').length} commit nội dung trên GitHub (bộ art / level); bản đóng gói dùng khi không có mạng sẽ cũ:`);
    console.warn(thieu.split('\n').slice(0, 8).map(l => '    ' + l).join('\n'));
    console.warn('    Chạy "git pull" rồi đồng bộ lại để APK lấy bản mới nhất.\n');
  }
} catch { /* không có mạng hoặc không có git: bỏ qua, chỉ là cảnh báo */ }
