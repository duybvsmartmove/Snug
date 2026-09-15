// Kiểm tra level của một chương: solver, density, difficulty.
// Chạy: node check_levels.mjs [mã chương]     mặc định school-day
import { readFileSync } from 'node:fs';
import { solve } from './src/gen/solver.js';
import { napCollider } from './load_colliders.mjs';

const soCollider = napCollider();   // đo bằng đúng hình người chơi gặp

const map = process.argv[2] || 'school-day';
const book = JSON.parse(readFileSync('public/content/levels.json', 'utf8'));
const ch = book.chapters.find(c => c.id === map);
if (!ch) { console.error(`Chưa có chương "${map}". Có: ${book.chapters.map(c => c.id).join(', ')}`); process.exit(1); }
console.log(`Đã nạp vùng va chạm sinh từ ảnh cho ${soCollider} món.\n`);
const rows = [];
for (const lv of ch.levels) {
  const s = solve(lv, { tries: 150 });
  rows.push({
    level: lv.id, tên: lv.name,
    món: lv.items.filter(i => i.id !== 'key').length,
    'máy xếp': `${s.placedCount}/${s.needCount}`,
    'kết quả': s.solvable ? 'xếp được' : 'chặt tay',
    điểm: lv.difficulty.points, tier: lv.difficulty.tier, giây: lv.timer,
  });
}
console.table(rows);
