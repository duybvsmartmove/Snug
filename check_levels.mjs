// Kiểm tra level của một chương: solver, density, difficulty.
// Chạy: node check_levels.mjs [mã chương]     mặc định school-day
import { readFileSync, readdirSync } from 'node:fs';
import { solve } from './src/gen/solver.js';

const map = process.argv[2] || 'school-day';
const dir = `../snug_level_editor/content/draft/maps/${map}/levels`;
const rows = [];
for (const f of readdirSync(dir).sort()) {
  const lv = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
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
