// Máy xếp ước lượng: có nhét hết đồ vào lòng túi được không, và xếp thế nào.
//
// Raster hoá lòng túi thành lưới ô CELL, rồi raster hoá HÌNH THẬT của từng món ở nhiều
// góc xoay thành mặt nạ ô, xếp theo bottom-left greedy và thử nhiều thứ tự.
//
// Bản cũ dùng khung chữ nhật bao quanh món và chỉ thử 0° với 90°. Từ khi vùng va chạm
// được sinh bám sát viền ảnh, khung bao rộng hơn hình thật rất nhiều — quả chuối cong,
// cái ô có quai, hộp màu xiên — nên máy báo "chặt tay" ở cả những level xếp thoải mái,
// và lúc tự chơi thì đặt đồ thưa thớt vì tưởng món nào cũng vuông.
import { pointInPolygon, bbox, mulberry32, shuffle } from '../util/geom.js';
import { defById } from '../data/items.js';

const CELL = 5;
// Người chơi xoay được tự do, nên máy cũng phải thử nhiều góc mới ra kết quả sát thực tế.
// Thử 0° và 90° trước vì đó là thế nằm tự nhiên của phần lớn món.
const GOC = [0, 90, 45, 135, 180, 270, 225, 315].map(d => d * Math.PI / 180);

// ---------- hình thật của món ----------
const TRON_DINH = 16;   // hình tròn xấp xỉ bằng đa giác bấy nhiêu đỉnh

/** Các đa giác tạo nên hình vật lý của món, đơn vị logic, gốc tại tâm món */
function hinhMon(id) {
  const d = defById(id); if (!d) return null;
  const manh = d.kind === 'compound' ? d.parts : [d, ...(d.extra ? [d.extra] : [])];
  const ra = [];
  for (const p of manh) {
    const dx = p.dx || 0, dy = p.dy || 0;
    if (p.kind === 'circle') {
      const v = [];
      for (let i = 0; i < TRON_DINH; i++) {
        const a = i / TRON_DINH * 2 * Math.PI;
        v.push([dx + Math.cos(a) * p.r, dy + Math.sin(a) * p.r]);
      }
      ra.push(v);
    } else if (p.kind === 'rect') {
      const w = p.w / 2, h = p.h / 2;
      ra.push([[dx - w, dy - h], [dx + w, dy - h], [dx + w, dy + h], [dx - w, dy + h]]);
    } else if (p.kind === 'poly' && p.pts?.length >= 3) {
      ra.push(p.pts.map(([x, y]) => [dx + x, dy + y]));
    }
  }
  if (!ra.length && d.box) {
    const [x0, y0, x1, y1] = d.box;
    ra.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  }
  return ra.length ? ra : null;
}

const xoay = (pts, a, k) => {
  const cs = Math.cos(a), sn = Math.sin(a);
  return pts.map(([x, y]) => [(x * cs - y * sn) * k, (x * sn + y * cs) * k]);
};

/**
 * Mặt nạ ô của một món ở một góc xoay.
 * minX/minY là toạ độ cục bộ của mép mặt nạ, cần để quy ngược ra vị trí tâm món.
 */
function matNa(hinh, goc, k) {
  const manh = hinh.map(p => xoay(p, goc, k));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of manh) for (const [x, y] of p) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const cw = Math.max(1, Math.ceil((maxX - minX) / CELL));
  const ch = Math.max(1, Math.ceil((maxY - minY) / CELL));
  const o = new Uint8Array(cw * ch);
  let so = 0;
  for (let r = 0; r < ch; r++) for (let c = 0; c < cw; c++) {
    const x = minX + (c + .5) * CELL, y = minY + (r + .5) * CELL;
    if (manh.some(p => pointInPolygon(x, y, p))) { o[r * cw + c] = 1; so++; }
  }
  // Món mảnh hơn một ô thì mặt nạ có thể rỗng; lấp đầy để nó vẫn chiếm chỗ.
  if (!so) { o.fill(1); so = cw * ch; }
  return { o, cw, ch, minX, minY, so };
}

// ---------- lưới lòng túi ----------
function rasterize(container) {
  const shape = container.shape, bb = bbox(shape);
  const cols = Math.ceil(bb.w / CELL), rows = Math.ceil(bb.h / CELL);
  const grid = new Uint8Array(cols * rows);          // 1 = trống và nằm trong lòng túi
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = bb.minX + c * CELL + CELL / 2, y = bb.minY + r * CELL + CELL / 2;
    let ok = pointInPolygon(x, y, shape);
    for (const b of container.blocks || []) if (ok && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) ok = false;
    grid[r * cols + c] = ok ? 1 : 0;
  }
  return { grid, cols, rows };
}

function vua(g, m, c0, r0) {
  if (c0 < 0 || r0 < 0 || c0 + m.cw > g.cols || r0 + m.ch > g.rows) return false;
  for (let r = 0; r < m.ch; r++) {
    const hangM = r * m.cw, hangG = (r0 + r) * g.cols + c0;
    for (let c = 0; c < m.cw; c++) if (m.o[hangM + c] && g.grid[hangG + c] !== 1) return false;
  }
  return true;
}
function danh(g, m, c0, r0, v) {
  for (let r = 0; r < m.ch; r++) {
    const hangM = r * m.cw, hangG = (r0 + r) * g.cols + c0;
    for (let c = 0; c < m.cw; c++) if (m.o[hangM + c]) g.grid[hangG + c] = v;
  }
}

/** Xếp lần lượt theo một thứ tự cho trước, mỗi món thử từng góc, chọn chỗ thấp nhất bên trái */
function tryOrder(g0, mon) {
  const g = { grid: g0.grid.slice(), cols: g0.cols, rows: g0.rows };
  const placed = [];
  for (const b of mon) {
    let xong = null;
    for (const m of b.matNa) {
      for (let r = g.rows - m.ch; r >= 0 && !xong; r--) {
        for (let c = 0; c <= g.cols - m.cw; c++) {
          if (vua(g, m, c, r)) { xong = { m, c, r }; break; }
        }
      }
      if (xong) break;
    }
    if (!xong) return { ok: false, placed, failed: b.id };
    danh(g, xong.m, xong.c, xong.r, 2);
    placed.push({ id: b.id, c: xong.c, r: xong.r, m: xong.m, goc: xong.m.goc });
  }
  return { ok: true, placed };
}

/**
 * Đổi kết quả xếp trên lưới thành toạ độ MÀN HÌNH cho autoplay.
 * container.shape là toạ độ cục bộ, gốc ở giữa đáy lòng túi, nên phải cộng (cx, bottom).
 * Ô (0,0) của mặt nạ ứng với điểm cục bộ (minX, minY) của món, nên tâm món nằm ở
 * mép lưới trừ đi minX/minY.
 */
function toPlan(placed, level) {
  const c = level.container || {};
  const ox = c.cx ?? 210, oy = c.bottom ?? 404;
  const bb = bbox(c.shape);
  return placed.map(p => ({
    id: p.id,
    x: Math.round(ox + bb.minX + p.c * CELL - p.m.minX),
    y: Math.round(oy + bb.minY + p.r * CELL - p.m.minY),
    angle: p.goc,
  }));
}

/**
 * Ước lượng xem có xếp hết đồ vào lòng túi không.
 *
 * Vẫn là ước lượng, không phải lời giải thật: xếp trên lưới ô CELL đơn vị, thử tám góc
 * xoay chứ không phải mọi góc, và không chạy physics (đồ dồn xuống, lèn vào nhau khi lắc).
 * Xếp được ở đây → gần như chắc chắn chơi được.
 * Không xếp được ở đây → vẫn có thể chơi được, chỉ là chặt tay.
 *
 * Món đã nằm sẵn trong túi (inBag, ví dụ chìa khoá) không phải xếp, nhưng chiếm chỗ thật.
 */
export function solve(level, { tries = 150, seed = 1 } = {}) {
  const g = rasterize(level.container);
  const bb = bbox(level.container.shape);
  const coRieng = it => Number(it.scale) || 1;

  // Món đặt sẵn trong túi: đánh dấu ô đã bận theo đúng hình và góc của nó
  for (const it of level.items) {
    if (!it.inBag) continue;
    const hinh = hinhMon(it.id); if (!hinh) continue;
    const m = matNa(hinh, it.angle || 0, coRieng(it));
    const c0 = Math.round(((it.x ?? 0) + m.minX - bb.minX) / CELL);
    const r0 = Math.round(((it.y ?? 0) + m.minY - bb.minY) / CELL);
    for (let r = 0; r < m.ch; r++) for (let c = 0; c < m.cw; c++) {
      if (!m.o[r * m.cw + c]) continue;
      const gr = r0 + r, gc = c0 + c;
      if (gr >= 0 && gr < g.rows && gc >= 0 && gc < g.cols) g.grid[gr * g.cols + gc] = 0;
    }
  }

  const mon = level.items
    .filter(it => !it.inBag && it.id !== 0)
    .map(it => {
      const hinh = hinhMon(it.id); if (!hinh) return null;
      const k = coRieng(it);
      const matNaTheoGoc = GOC.map(goc => Object.assign(matNa(hinh, goc, k), { goc }));
      return { id: it.id, matNa: matNaTheoGoc, so: matNaTheoGoc[0].so };
    })
    .filter(Boolean);

  const needCount = mon.length;
  if (!needCount) return { solvable: true, tries: 0, placedCount: 0, needCount: 0, plan: [] };

  const theoCo = mon.slice().sort((a, b) => b.so - a.so);   // món to xếp trước
  const rand = mulberry32(seed);
  let best = null;
  for (let t = 0; t < tries; t++) {
    let order = theoCo;
    if (t > 0) {
      const half = Math.ceil(theoCo.length / 2);
      order = theoCo.slice(0, half).concat(shuffle(rand, theoCo.slice(half)));
      if (t % 3 === 0) order = shuffle(rand, theoCo);
    }
    const r = tryOrder(g, order);
    if (!best || r.placed.length > best.placed.length) best = r;
    if (r.ok) return { solvable: true, tries: t + 1, placedCount: needCount, needCount, plan: toPlan(r.placed, level) };
  }
  return { solvable: false, tries, placedCount: best.placed.length, needCount, failed: best.failed, plan: toPlan(best.placed, level) };
}
