// Dựng lại chương 1 (school-day) của bộ art cozy từ bảng mẫu bên dưới.
//
// Chạy: node tools/build_cozy_levels.mjs [--ghi]
//
// Túi cozy dáng cố định: level chỉ chọn CỠ túi và đặt VẬT CẢN, không kéo hình lòng túi.
//   - Cỡ túi tính sao cho độ đầy đạt đúng mục tiêu của level, đo bằng vùng va chạm thật của món.
//   - Vật cản khai báo theo tỉ lệ khung lòng túi nên phóng theo cỡ túi.
//   - Level mục tiêu ≤ 83% phải để máy xếp xếp được; chưa được thì nới túi thêm từng 2%.
//     Trên mức đó là level cố ý chặt tay, cần booster.
// Mỗi level đặt túi bằng placeFixed (src/data/bag.js), cùng cách editor làm khi kéo thanh cỡ túi.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTENT, ARGS } from './art.mjs';
import { napCollider } from '../load_colliders.mjs';
import { solve } from '../src/gen/solver.js';
import { difficulty } from '../src/gen/difficulty.js';
import { polygonArea, mulberry32 } from '../src/util/geom.js';
import { blocksArea } from '../src/data/blocks.js';
import { fixedShape, placeFixed, maxScale } from '../src/data/bag.js';

const GHI = ARGS.includes('--ghi');
const CHUONG = 'school-day';
const SKIN = 'backpack';
const NOI = 1.02, NOI_TOI_DA = 6;

// Món: 1 áo phông · 2 quần short · 3 tất · 4 giày · 5 áo mưa · 6 giấy ăn · 7 nước rửa tay
//      8 khăn tay · 9 son · 10 khăn ướt · 11 máy tính bảng · 12 máy tính bỏ túi · 13 hộp tai nghe
//      14 củ sạc · 15 bình nước
// Vật cản: fx = tâm theo nửa bề ngang (-1 trái … 1 phải), fy = tâm theo chiều cao (0 đáy … 1 đỉnh),
//          fw, fh = cỡ theo bề ngang / chiều cao lòng túi
const MAU = { go: '#C99A6E', xanh: '#8FB9A8', hong: '#E7A9A0', vang: '#E9C46A', tim: '#A99BD1' };
const LEVELS = [
  { id: 'sd-01', name: 'Đồ vệ sinh nhỏ', nameEn: 'Little essentials', density: .46, timer: 120, coin: 20,
    items: [6, 7, 9, 10], hint: 'Kéo đồ vào ba lô' },
  { id: 'sd-02', name: 'Thêm bình nước', nameEn: 'Grab a bottle', density: .54, timer: 110, coin: 20,
    items: [6, 7, 9, 10, 15] },
  { id: 'sd-03', name: 'Khăn tay gấp gọn', nameEn: 'Folded towel', density: .60, timer: 100, coin: 25,
    items: [6, 7, 8, 9, 10, 15],
    blocks: [{ kind: 'round', fx: .62, fy: .16, fw: .26, fh: .22, color: MAU.xanh }] },
  { id: 'sd-04', name: 'Đồ điện tử', nameEn: 'Gadgets', density: .64, timer: 100, coin: 30,
    items: [11, 12, 13, 14, 6, 15, 9] },
  { id: 'sd-05', name: 'Đôi tất đi kèm', nameEn: 'Socks and towel', density: .68, timer: 95, coin: 30,
    items: [1, 3, 8, 7, 10, 13, 9, 12], link: [3, 8] },
  { id: 'sd-06', name: 'Túi hơi chật', nameEn: 'A bit tight', density: .72, timer: 90, coin: 35,
    items: [2, 3, 6, 12, 13, 14, 15, 9, 7],
    blocks: [{ kind: 'pill', fx: -.7, fy: .3, fw: .16, fh: .42, color: MAU.hong }] },
  { id: 'sd-07', name: 'Máy tính bảng', nameEn: 'Tablet day', density: .76, timer: 90, coin: 40,
    items: [11, 8, 3, 9, 10, 12, 14, 7, 6] },
  { id: 'sd-08', name: 'Vướng ngăn giữa', nameEn: 'Middle pocket', density: .79, timer: 85, coin: 45,
    items: [5, 4, 3, 13, 12, 6, 9, 15, 10],
    blocks: [{ kind: 'rect', fx: 0, fy: .52, fw: .36, fh: .12, color: MAU.go }] },
  { id: 'sd-09', name: 'Sát giờ vào lớp', nameEn: 'Almost late', density: .83, timer: 80, coin: 50,
    items: [5, 1, 4, 3, 8, 12, 15, 9], link: [3, 8],
    blocks: [{ kind: 'tri', fx: .66, fy: .12, fw: .24, fh: .2, color: MAU.vang }] },
  { id: 'sd-10', name: 'Balo cuối tuần', nameEn: 'Weekend backpack', density: .87, timer: 80, coin: 60,
    items: [11, 5, 4, 3, 15, 13, 9, 10], link: [3, 9],
    blocks: [
      { kind: 'round', fx: -.64, fy: .14, fw: .22, fh: .18, color: MAU.tim },
      { kind: 'diamond', fx: .6, fy: .5, fw: .2, fh: .16, color: MAU.xanh },
    ] },
];

// ---------- dữ liệu ----------
napCollider();
const index = JSON.parse(readFileSync(resolve(CONTENT, 'assets/index.json'), 'utf8'));
const skin = JSON.parse(readFileSync(resolve(CONTENT, index.bags[SKIN]), 'utf8'));
const dtMon = {};
for (const [id, duong] of Object.entries(index.items)) {
  const c = JSON.parse(readFileSync(resolve(CONTENT, duong), 'utf8')).collider;
  dtMon[id] = c.kind === 'circle' ? Math.PI * c.r * c.r : c.kind === 'rect' ? c.w * c.h : polygonArea(c.pts);
}
const trong = fixedShape(skin, 1);
const xs = trong.map(p => p[0]), ys = trong.map(p => p[1]);
const R0 = (Math.max(...xs) - Math.min(...xs)) / 2, C0 = -Math.min(...ys), A0 = polygonArea(trong);
const sMax = maxScale(skin);

// vật cản theo tỉ lệ → toạ độ level ở cỡ s
const vatCan = (spec, s) => (spec || []).map(v => {
  const w = Math.round(v.fw * 2 * R0 * s), h = Math.round(v.fh * C0 * s);
  return { kind: v.kind, color: v.color,
    x: Math.round(v.fx * R0 * s - w / 2), y: Math.round(-v.fy * C0 * s - h / 2), w, h };
});
const dung = (lv, s) => placeFixed({ skin: SKIN, scale: s, blocks: vatCan(lv.blocks, s) }, skin, s);

// rải đồ trên sàn, như build_levels.mjs
const TRAY = { x0: 44, x1: 376, y0: 500, y1: 616 };
function layout(ids, seed) {
  const rand = mulberry32(seed), cols = ids.length > 10 ? 5 : 4;
  return ids.map((id, i) => ({
    id,
    x: Math.round(TRAY.x0 + (i % cols) * ((TRAY.x1 - TRAY.x0) / (cols - 1)) + (rand() - .5) * 18),
    y: Math.round(TRAY.y0 + Math.floor(i / cols) * 54 + rand() * 10),
    angle: Math.round((rand() - .5) * 1.4 * 100) / 100,
  }));
}

// ---------- dựng ----------
const bang = [], levels = [];
LEVELS.forEach((lv, i) => {
  const monArea = lv.items.reduce((s, id) => s + dtMon[id], 0);
  const b1 = blocksArea(vatCan(lv.blocks, 1));
  let s = Math.sqrt(monArea / (lv.density * (A0 - b1)));
  let ghiChu = '';
  if (s > sMax) { s = sMax; ghiChu = 'túi chạm trần màn, đầy hơn mục tiêu'; }
  const items = layout(lv.items, 9000 + i);
  if (lv.link) items.find(it => it.id === lv.link[0]).link = lv.link[1];
  const lam = sc => ({ id: lv.id, name: lv.name, nameEn: lv.nameEn, timer: lv.timer, background: 1,
    container: dung(lv, sc), mode: 'fixed', items, reward: { coin: lv.coin },
    ...(lv.hint ? { emptyText: lv.hint } : {}) });
  let L = lam(s), kq = solve(L, { tries: 300 });
  for (let n = 0; !kq.solvable && lv.density <= .83 && n < NOI_TOI_DA && s * NOI <= sMax; n++) {
    s *= NOI; L = lam(s); kq = solve(L, { tries: 300 });
    ghiChu = `nới ${((NOI ** (n + 1) - 1) * 100).toFixed(0)}% cho máy xếp vừa`;
  }
  const d = difficulty(L, id => dtMon[id] || 0);
  L.difficulty = { points: d.total, tier: d.tier };
  levels.push(L);
  bang.push({ level: lv.id, món: lv.items.length, 'vật cản': (lv.blocks || []).map(b => b.kind).join(',') || '-',
    cỡ: `${(s * 100).toFixed(0)}%`, 'đầy': `${(d.density * 100).toFixed(0)}% (muốn ${lv.density * 100}%)`,
    'máy xếp': `${kq.placedCount}/${kq.needCount}`, 'độ khó': `${d.total} ${d.tier}`, ...(ghiChu ? { ghiChu } : {}) });
});
console.table(bang);

if (!GHI) { console.log('\nXem trước, chưa ghi gì. Thêm --ghi để ghi thật.'); process.exit(0); }
const file = resolve(CONTENT, 'levels.json');
const book = JSON.parse(readFileSync(file, 'utf8'));
const cu = book.chapters.find(c => c.id === CHUONG) || { id: CHUONG, no: 1, name: 'School Day' };
const ch = { ...cu, background: 1, levels };
ch.assets = {
  items: [...new Set(levels.flatMap(l => l.items.map(it => it.id)))].sort((a, b) => a - b),
  backgrounds: [1], bags: [SKIN],
};
book.chapters = [ch];          // bộ cozy hiện chỉ có chương 1
book.version = (book.version || 0) + 1;
book.publishedAt = new Date().toISOString();
writeFileSync(file, JSON.stringify(book, null, 2));
console.log(`\nĐã ghi ${levels.length} level vào ${file} (bản v${book.version}).`);
