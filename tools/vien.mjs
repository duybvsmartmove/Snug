// Dò đường viền của một mặt nạ điểm ảnh và rút gọn thành đa giác.
// build_colliders (vùng va chạm món) và import_bag (lòng túi) dùng chung.

// ---------------- dò viền (Moore) ----------------
const HUONG = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];

export function doVien(m, w, h) {
  const co = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1;
  let s = -1;
  for (let i = 0; i < w * h && s < 0; i++) if (m[i]) s = i;
  if (s < 0) return [];

  const sx = s % w, sy = (s / w) | 0;
  const vien = [[sx, sy]];
  // Ô nền mà ta "đi tới từ đó". Ô đầu tiên tìm được là ô trên cùng bên trái nên
  // bên trái nó chắc chắn là nền.
  let bx = sx - 1, by = sy, cx = sx, cy = sy;

  for (let buoc = 0, toiDa = w * h * 8; buoc < toiDa; buoc++) {
    let goc = HUONG.findIndex(([dx, dy]) => cx + dx === bx && cy + dy === by);
    if (goc < 0) goc = 4;
    let thay = false;
    for (let k = 1; k <= 8; k++) {
      const d = (goc + k) % 8;
      const nx = cx + HUONG[d][0], ny = cy + HUONG[d][1];
      if (co(nx, ny)) {
        const truoc = (d + 7) % 8;                  // ô nền ngay trước ô vừa tìm được
        bx = cx + HUONG[truoc][0]; by = cy + HUONG[truoc][1];
        cx = nx; cy = ny; thay = true; break;
      }
    }
    if (!thay) break;
    if (cx === sx && cy === sy) break;
    vien.push([cx, cy]);
  }
  return vien;
}

// ---------------- rút gọn đường viền (Ramer–Douglas–Peucker) ----------------
function khoangCach(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (!l2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
export function rutGon(pts, eps) {
  if (pts.length < 3) return pts.slice();
  let xa = 0, chiSo = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = khoangCach(pts[i], pts[0], pts[pts.length - 1]);
    if (d > xa) { xa = d; chiSo = i; }
  }
  if (xa <= eps) return [pts[0], pts[pts.length - 1]];
  return [...rutGon(pts.slice(0, chiSo + 1), eps).slice(0, -1), ...rutGon(pts.slice(chiSo), eps)];
}

export const dienTich = pts => {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
};
/** Trọng tâm theo diện tích, đúng công thức Matter dùng để đặt tâm vật */
export function trongTam(pts) {
  const A = dienTich(pts);
  if (Math.abs(A) < 1e-9) {
    const n = pts.length;
    return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0, cy = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const f = a[0] * b[1] - b[0] * a[1];
    cx += (a[0] + b[0]) * f; cy += (a[1] + b[1]) * f;
  }
  return [cx / (6 * A), cy / (6 * A)];
}

