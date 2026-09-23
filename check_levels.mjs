// Kiểm tra level của một chương: solver, density, difficulty.
// Chạy: node check_levels.mjs [mã chương] [--art casual]     mặc định school-day, bộ cozy
import { readFileSync } from 'node:fs';
import { solve } from './src/gen/solver.js';
import { napCollider } from './load_colliders.mjs';
import { ART, ARGS, CONTENT } from './tools/art.mjs';

const soCollider = napCollider();   // đo bằng đúng hình người chơi gặp

const JSON_RA = ARGS.includes('--json');   // cho công cụ khác đọc (refit_levels)
const map = ARGS.find(a => !a.startsWith('--')) || 'school-day';
const book = JSON.parse(readFileSync(`${CONTENT}/levels.json`, 'utf8'));
const ch = book.chapters.find(c => c.id === map);
if (!ch) { console.error(`Chưa có chương "${map}". Có: ${book.chapters.map(c => c.id).join(', ')}`); process.exit(1); }
if (!JSON_RA) console.log(`Bộ art ${ART}: đã nạp vùng va chạm sinh từ ảnh cho ${soCollider} món.\n`);
const rows = [];
for (const lv of ch.levels) {
  const s = solve(lv, { tries: 300 });
  rows.push({
    level: lv.id, tên: lv.name,
    món: lv.items.filter(i => i.id !== 'key').length,
    'máy xếp': `${s.placedCount}/${s.needCount}`,
    'kết quả': s.solvable ? 'xếp được' : 'chặt tay', solvable: s.solvable,
    điểm: lv.difficulty?.points ?? "-", tier: lv.difficulty?.tier ?? "-", giây: lv.timer,
  });
}
if (JSON_RA) console.log(JSON.stringify(rows));
else console.table(rows.map(({ solvable, ...r }) => r));
