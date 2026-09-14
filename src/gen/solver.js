// Solver ước lượng: có xếp hết đồ vào lòng túi được không.
// Raster hoá polygon thành lưới ô CELL px, xếp từng món (bounding box, xoay 0°/90°) theo bottom-left greedy,
// thử nhiều thứ tự. Đây là ước lượng (không chạy physics) — đủ để loại level bất khả thi rõ ràng.
import { pointInPolygon, bbox, mulberry32, shuffle } from '../util/geom.js';
import { defById } from '../data/items.js';

const CELL = 6;

/**
 * Khung bao của HÌNH VẬT LÝ (không phải khung vẽ).
 * Khung vẽ thường lớn hơn vì gồm cả chi tiết trang trí — ví dụ cuống quả táo, quai ô —
 * những thứ không có trong collider nên không chiếm chỗ khi xếp.
 */
function itemBox(id) {
  const d = defById(id); if (!d) return null;
  const parts = d.kind === 'compound' ? d.parts : [d, ...(d.extra ? [d.extra] : [])];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of parts) {
    const dx = p.dx || 0, dy = p.dy || 0;
    let x0, y0, x1, y1;
    if (p.kind === 'circle') { x0 = dx - p.r; x1 = dx + p.r; y0 = dy - p.r; y1 = dy + p.r; }
    else if (p.kind === 'rect') { x0 = dx - p.w / 2; x1 = dx + p.w / 2; y0 = dy - p.h / 2; y1 = dy + p.h / 2; }
    else if (p.kind === 'poly') {
      const xs = p.pts.map(v => v[0]), ys = p.pts.map(v => v[1]);
      x0 = dx + Math.min(...xs); x1 = dx + Math.max(...xs); y0 = dy + Math.min(...ys); y1 = dy + Math.max(...ys);
    } else continue;
    minX = Math.min(minX, x0); maxX = Math.max(maxX, x1);
    minY = Math.min(minY, y0); maxY = Math.max(maxY, y1);
  }
  if (!isFinite(minX)) { const [a, b, c2, d2] = d.box; return { w: c2 - a, h: d2 - b }; }
  return { w: Math.round(maxX - minX), h: Math.round(maxY - minY) };
}

function rasterize(container) {
  const shape = container.shape, bb = bbox(shape);
  const cols = Math.ceil(bb.w / CELL), rows = Math.ceil(bb.h / CELL);
  const grid = new Uint8Array(cols * rows); // 1 = trống hợp lệ
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = bb.minX + c * CELL + CELL / 2, y = bb.minY + r * CELL + CELL / 2;
    let ok = pointInPolygon(x, y, shape);
    for (const b of container.blocks || []) if (ok && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) ok = false;
    grid[r * cols + c] = ok ? 1 : 0;
  }
  return { grid, cols, rows };
}

function fits(g, c0, r0, cw, ch) {
  if (c0 < 0 || r0 < 0 || c0 + cw > g.cols || r0 + ch > g.rows) return false;
  for (let r = r0; r < r0 + ch; r++) for (let c = c0; c < c0 + cw; c++) if (g.grid[r * g.cols + c] !== 1) return false;
  return true;
}
function place(g, c0, r0, cw, ch, v) { for (let r = r0; r < r0 + ch; r++) for (let c = c0; c < c0 + cw; c++) g.grid[r * g.cols + c] = v; }

function tryOrder(g0, boxes) {
  const g = { grid: g0.grid.slice(), cols: g0.cols, rows: g0.rows };
  const placed = [];
  for (const b of boxes) {
    let done = false;
    // xoay 0 hoặc 90, quét từ đáy lên, trái sang phải (bottom-left)
    for (const [w, h] of [[b.w, b.h], [b.h, b.w]]) {
      const cw = Math.ceil(w / CELL), ch = Math.ceil(h / CELL);
      outer: for (let r = g.rows - ch; r >= 0; r--) for (let c = 0; c <= g.cols - cw; c++) {
        if (fits(g, c, r, cw, ch)) {
          place(g, c, r, cw, ch, 2);
          placed.push({ id: b.id, c, r, cw, ch, rotated: w !== b.w });
          done = true; break outer;
        }
      }
      if (done) break;
    }
    if (!done) return { ok: false, placed, failed: b.id };
  }
  return { ok: true, placed };
}

/**
 * Đổi kết quả xếp trên lưới thành toạ độ MÀN HÌNH để autoplay dùng.
 * container.shape là toạ độ cục bộ, gốc ở giữa đáy lòng túi, nên phải cộng thêm (cx, bottom).
 */
function toPlan(placed, level) {
  const c = level.container || {};
  const ox = c.cx ?? 210, oy = c.bottom ?? 404;
  const bb = bbox(c.shape);
  return placed.map(p => ({
    id: p.id,
    x: Math.round(ox + bb.minX + (p.c + p.cw / 2) * CELL),
    y: Math.round(oy + bb.minY + (p.r + p.ch / 2) * CELL),
    rotated: !!p.rotated,
  }));
}

/**
 * Ước lượng xem có xếp hết đồ vào lòng túi không.
 *
 * Đây là ước lượng THẬN TRỌNG, không phải lời giải thật:
 *  - dùng khung chữ nhật bao quanh món, không dùng hình thật (món lồi lõm lọt khe mà khung thì không)
 *  - chỉ thử xoay 0° và 90°, trong khi người chơi xoay được mọi góc
 *  - không mô phỏng physics (đồ dồn xuống, lèn vào nhau khi lắc túi)
 * Vì vậy: xếp được ở đây → gần như chắc chắn chơi được.
 * Không xếp được ở đây → vẫn có thể chơi được, chỉ là chặt tay.
 *
 * Món đã nằm sẵn trong túi (inBag, ví dụ chìa khóa) không phải xếp, nhưng chiếm chỗ thật.
 *
 * @returns { solvable, tries, placedCount, needCount, failed, fill }
 */
export function solve(level, { tries = 60, seed = 1 } = {}) {
  const g = rasterize(level.container);
  const bb = bbox(level.container.shape);

  // Món có sẵn trong túi: đánh dấu ô đã bận, không tính vào danh sách cần xếp
  for (const it of level.items) {
    if (!it.inBag) continue;
    const box = itemBox(it.id); if (!box) continue;
    const c0 = Math.floor(((it.x ?? 0) - box.w / 2 - bb.minX) / CELL);
    const r0 = Math.floor(((it.y ?? 0) - box.h / 2 - bb.minY) / CELL);
    const cw = Math.ceil(box.w / CELL), ch = Math.ceil(box.h / CELL);
    for (let r = Math.max(0, r0); r < Math.min(g.rows, r0 + ch); r++) {
      for (let c = Math.max(0, c0); c < Math.min(g.cols, c0 + cw); c++) g.grid[r * g.cols + c] = 0;
    }
  }

  const boxes = level.items
    .filter(it => !it.inBag && it.id !== 0)
    .map(it => ({ id: it.id, ...itemBox(it.id) }))
    .filter(b => b.w);
  const needCount = boxes.length;
  if (!needCount) return { solvable: true, tries: 0, placedCount: 0, needCount: 0 };

  const bySize = boxes.slice().sort((a, b) => b.w * b.h - a.w * a.h);
  const rand = mulberry32(seed);
  let best = null;
  for (let t = 0; t < tries; t++) {
    // lần đầu: lớn → nhỏ. Các lần sau: xáo trộn nửa sau để tìm thứ tự khác.
    let order = bySize;
    if (t > 0) {
      const half = Math.ceil(bySize.length / 2);
      order = bySize.slice(0, half).concat(shuffle(rand, bySize.slice(half)));
      if (t % 3 === 0) order = shuffle(rand, bySize);
    }
    const r = tryOrder(g, order);
    if (!best || r.placed.length > best.placed.length) best = r;
    if (r.ok) return { solvable: true, tries: t + 1, placedCount: needCount, needCount, plan: toPlan(r.placed, level) };
  }
  return { solvable: false, tries, placedCount: best.placed.length, needCount, failed: best.failed, plan: toPlan(best.placed, level) };
}
