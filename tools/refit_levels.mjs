// Cân lại level của một bộ art sau khi đổi ảnh món.
//
// Chạy: node tools/refit_levels.mjs [mã chương…] [--art cozy] [--theo casual] [--ghi]
//   không ghi mã chương thì làm mọi chương; không có --ghi thì chỉ in bảng xem trước
//
// Đổi art là đổi dáng món, nên cùng một level mà diện tích đồ đã khác, độ đầy lòng túi lệch
// khỏi chỗ người dựng level đã chọn. Với từng level:
//   1. Lấy độ đầy GỐC từ level cùng mã của bộ tham chiếu (--theo, mặc định casual: bộ art cũ).
//   2. Phóng lòng túi (cả block) quanh giữa đáy túi cho độ đầy về đúng như gốc, giống nút
//      "Fit bag" của editor, trong giới hạn khung màn.
//   3. Cho máy xếp thử. Gốc xếp được mà giờ không thì nới túi thêm từng 2% (tối đa NOI_TOI_DA
//      lần) tới khi xếp được: dáng mới có thể khó ghép hơn dù cùng diện tích.
//   4. Tính lại điểm độ khó.
// Món, vị trí rải trên sàn, cơ chế, giờ, thưởng giữ nguyên.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ART, ARGS, CONTENT } from './art.mjs';
import { napCollider } from '../load_colliders.mjs';
import { solve } from '../src/gen/solver.js';
import { difficulty } from '../src/gen/difficulty.js';
import { defById } from '../src/data/items.js';
import { polygonArea } from '../src/util/geom.js';

const GHI = ARGS.includes('--ghi');
const k = ARGS.indexOf('--theo');
const THEO = k >= 0 ? ARGS[k + 1] : 'casual';
const CHUONG = ARGS.filter((a, i) => !a.startsWith('--') && ARGS[i - 1] !== '--theo');
if (THEO === ART) { console.error('Bộ tham chiếu phải khác bộ đang cân'); process.exit(1); }

const MAX_NUA_RONG = 190, MAX_CAO = 300;   // cùng giới hạn nút Fit bag của editor
const NOI = 1.02, NOI_TOI_DA = 4;

// ---------- diện tích món theo vùng va chạm trong manifest của một bộ art ----------
function dienTichCollider(c) {
  if (!c) return 0;
  if (c.kind === 'circle') return Math.PI * c.r * c.r;
  if (c.kind === 'rect') return c.w * c.h;
  return polygonArea(c.pts);
}
function bangDienTich(goc) {
  const index = JSON.parse(readFileSync(resolve(goc, 'assets/index.json'), 'utf8'));
  const ra = {};
  for (const [id, duong] of Object.entries(index.items)) {
    try { ra[id] = dienTichCollider(JSON.parse(readFileSync(resolve(goc, duong), 'utf8')).collider); } catch {}
  }
  return ra;
}
const GOC_THEO = resolve(CONTENT, '..', THEO);
const dtTheo = bangDienTich(GOC_THEO), dtMoi = bangDienTich(CONTENT);

const tongDoDay = (lv, dt) => {
  const items = lv.items.filter(it => it.id !== 0);
  const monArea = items.reduce((s, it) => { const c = Number(it.scale) || 1; return s + (dt[it.id] || 0) * c * c; }, 0);
  const blocks = (lv.container.blocks || []).reduce((s, b) => s + b.w * b.h, 0);
  return monArea / Math.max(1, polygonArea(lv.container.shape) - blocks);
};

/** Phóng lòng túi và block quanh gốc (giữa đáy) hệ số s. Trả null nếu tràn khung màn. */
function phong(container, s) {
  const shape = container.shape.map(([x, y]) => [Math.round(x * s), Math.round(y * s)]);
  const w = Math.max(...shape.map(p => Math.abs(p[0]))), h = Math.max(...shape.map(p => -p[1]));
  if (w > MAX_NUA_RONG || h > MAX_CAO) return null;
  const blocks = (container.blocks || []).map(b => ({ ...b, x: Math.round(b.x * s), y: Math.round(b.y * s), w: Math.round(b.w * s), h: Math.round(b.h * s) }));
  return { ...container, shape, blocks };
}

const kichThuoc = sh => {
  const xs = sh.map(p => p[0]), ys = sh.map(p => p[1]);
  return `${Math.max(...xs) - Math.min(...xs)}×${Math.max(...ys) - Math.min(...ys)}`;
};

/** Máy xếp có xếp được level gốc không, đo bằng đúng hình món của bộ tham chiếu (tiến trình riêng
 *  vì mỗi tiến trình chỉ nạp được vùng va chạm của một bộ art) */
const gocCache = {};
function xepDuocGoc(chId, lvId) {
  if (!gocCache[chId]) {
    const out = execFileSync(process.execPath, [resolve(CONTENT, '../../../check_levels.mjs'), chId, '--art', THEO, '--json'], { encoding: 'utf8' });
    gocCache[chId] = Object.fromEntries(JSON.parse(out.trim().split('\n').pop()).map(r => [r.level, r.solvable]));
  }
  return !!gocCache[chId][lvId];
}

// ---------- chạy ----------
napCollider();
const itemAreaOf = id => dtMoi[id] || 0;
const sachMoi = JSON.parse(readFileSync(resolve(CONTENT, 'levels.json'), 'utf8'));
const sachTheo = JSON.parse(readFileSync(resolve(GOC_THEO, 'levels.json'), 'utf8'));
const levelTheo = new Map(sachTheo.chapters.flatMap(c => c.levels.map(l => [l.id, l])));

const bang = [];
for (const ch of sachMoi.chapters) {
  if (CHUONG.length && !CHUONG.includes(ch.id)) continue;
  for (const lv of ch.levels) {
    const items = lv.items.filter(it => it.id !== 0);
    const goc = levelTheo.get(lv.id);
    if (!items.length || !goc) { bang.push({ level: lv.id, ghiChu: goc ? 'chưa có món' : `bộ ${THEO} không có level này` }); continue; }
    if (items.some(it => !defById(it.id))) { bang.push({ level: lv.id, ghiChu: 'có món chưa có trong bộ art này' }); continue; }

    const muon = tongDoDay(goc, dtTheo);
    const truoc = tongDoDay(lv, dtMoi);

    // hệ số phóng để độ đầy về đúng như gốc: diện tích lòng túi tỉ lệ bình phương hệ số
    let s = Math.sqrt(truoc / muon);
    let moi = phong(lv.container, s);
    let ghiChu = '';
    if (!moi) { ghiChu = 'túi chạm khung màn, giữ nguyên cỡ'; s = 1; moi = lv.container; }
    let thu = { ...lv, container: moi }, kq = solve(thu, { tries: 300 });
    // Chỉ nới khi bản gốc xếp được. Level gốc đã "chặt tay" là cố ý bắt dùng booster, giữ nguyên.
    for (let n = 0; !kq.solvable && xepDuocGoc(ch.id, lv.id) && n < NOI_TOI_DA; n++) {
      const rong = phong(lv.container, s * NOI);
      if (!rong) { ghiChu = 'không nới thêm được: chạm khung màn'; break; }
      s *= NOI; moi = rong; thu = { ...lv, container: moi }; kq = solve(thu, { tries: 300 });
      ghiChu = `nới thêm ${(((s / Math.sqrt(truoc / muon)) - 1) * 100).toFixed(0)}% cho máy xếp vừa`;
    }
    const d = difficulty(thu, itemAreaOf);
    bang.push({
      level: lv.id, món: items.length,
      'đầy gốc': `${(muon * 100).toFixed(0)}%`,
      'đầy khi đổi art': `${(truoc * 100).toFixed(0)}%`,
      'đầy sau cân': `${(d.density * 100).toFixed(0)}%`,
      'lòng túi': `${kichThuoc(lv.container.shape)} → ${kichThuoc(moi.shape)}`,
      'máy xếp gốc': xepDuocGoc(ch.id, lv.id) ? 'được' : 'chặt tay',
      'máy xếp': `${kq.placedCount}/${kq.needCount}`,
      độ_khó: `${lv.difficulty?.points ?? '-'} → ${d.total} ${d.tier}`,
      ...(ghiChu ? { ghiChu } : {}),
    });
    if (GHI) { lv.container = moi; lv.difficulty = { points: d.total, tier: d.tier }; }
  }
}
console.log(`Cân bộ ${ART} theo độ đầy của bộ ${THEO}`);
console.table(bang);
if (GHI) {
  sachMoi.version = (sachMoi.version || 0) + 1;
  sachMoi.publishedAt = new Date().toISOString();
  writeFileSync(resolve(CONTENT, 'levels.json'), JSON.stringify(sachMoi, null, 2));
  console.log(`\nĐã ghi ${resolve(CONTENT, 'levels.json')} (bản v${sachMoi.version}).`);
} else console.log('\nXem trước, chưa ghi gì. Thêm --ghi để ghi thật.');
