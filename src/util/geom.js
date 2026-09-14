// Tiện ích hình học + PRNG dùng chung cho game, generator và editor.

/** Diện tích đa giác (shoelace), luôn dương */
export function polygonArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Điểm (x,y) nằm trong đa giác? (ray casting) */
export function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

/** Khoảng cách từ điểm tới đoạn thẳng */
export function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

/**
 * Điểm nằm trong đa giác, có dung sai: điểm nằm ngoài nhưng cách biên <= tol vẫn tính là trong.
 * Cần thiết vì Matter.js cho vật lún nhẹ vào tường (collision slop), khiến đỉnh vượt biên vài phần trăm pixel.
 */
export function pointInPolygonTolerant(x, y, pts, tol = 2.5) {
  if (pointInPolygon(x, y, pts)) return true;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    if (distToSegment(x, y, x1, y1, x2, y2) <= tol) return true;
  }
  return false;
}

export function bbox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Bao lồi (monotone chain). pts: [[x,y],...] → [[x,y],...] theo chiều kim đồng hồ */
export function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

/** Đơn giản hoá đường gấp khúc (Douglas–Peucker) */
export function simplify(pts, tol = 2) {
  if (pts.length < 4) return pts;
  const sq = tol * tol;
  const dist2 = (p, a, b) => {
    let [x, y] = a; let dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) { const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy); if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; } }
    dx = p[0] - x; dy = p[1] - y; return dx * dx + dy * dy;
  };
  const keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop(); let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) { const d = dist2(pts[i], pts[s], pts[e]); if (d > maxD) { maxD = d; idx = i; } }
    if (maxD > sq) { keep[idx] = true; stack.push([s, idx], [idx, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Đa giác có lồi không */
export function isConvex(pts) {
  let sign = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n], [cx, cy] = pts[(i + 2) % n];
    const cr = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (cr !== 0) { if (sign === 0) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false; }
  }
  return true;
}

/** PRNG có seed (mulberry32). Trả về hàm rand() ∈ [0,1) */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const randInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
export const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
export function shuffle(rand, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
