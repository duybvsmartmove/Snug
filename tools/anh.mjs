// Xử lý ảnh art dùng chung cho các công cụ nhập (import_items, import_bag):
// làm sạch nền rác, cắt sát viền, thu nhỏ đúng cỡ.
export const LE = 2;             // lề trong suốt quanh món sau khi cắt, px ảnh đích
const NHIEU = 12;                // alpha từ đây trở xuống là rác của khâu xoá nền
export const NGUONG = 24;        // alpha trên ngưỡng này là thân món (cùng ngưỡng build_colliders)
const VIEN = 3;                  // giữ thêm chừng này px quanh thân món cho viền khử răng cưa

/** Mặt nạ mảng liền (8 hướng) lớn nhất có alpha > NGUONG */
export function thanMon({ w, h, px }) {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = px[i * 4 + 3] > NGUONG ? 1 : 0;
  const nhan = new Int32Array(w * h).fill(-1), hang = new Int32Array(w * h);
  let tot = -1, toNhat = 0, so = 0;
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || nhan[s] >= 0) continue;
    let dau = 0, cuoi = 0;
    hang[cuoi++] = s; nhan[s] = so;
    while (dau < cuoi) {
      const p = hang[dau++], x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (m[q] && nhan[q] < 0) { nhan[q] = so; hang[cuoi++] = q; }
      }
    }
    if (cuoi > toNhat) { toNhat = cuoi; tot = so; }
    so++;
  }
  for (let i = 0; i < w * h; i++) m[i] = nhan[i] === tot ? 1 : 0;
  return { m, dem: toNhat };
}

/** Nở mặt nạ r px (hình vuông, tách hai chiều cho nhanh) */
export function no(m, w, h, r) {
  const a = new Uint8Array(w * h), b = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r) && !v; k++) v = m[y * w + k];
    a[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r) && !v; k++) v = a[k * w + x];
    b[y * w + x] = v;
  }
  return b;
}

export function lamSach(anh) {
  const { w, h, px } = anh;
  const { m, dem } = thanMon(anh);
  if (!dem) throw new Error('ảnh trống');
  const giu = no(m, w, h, VIEN);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!giu[i] || px[i * 4 + 3] <= NHIEU) { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = px[i * 4 + 3] = 0; continue; }
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1: x1 + 1, y1: y1 + 1, dem };
}

/** Thu nhỏ vùng khung của ảnh theo hệ số f: lọc hộp theo diện tích, alpha nhân trước, thêm lề LE */
export function thuNho(anh, khung, f) {
  const { w: W, px } = anh;
  const cw = khung.x1 - khung.x0, ch = khung.y1 - khung.y0;
  const ow = Math.max(1, Math.round(cw * f)), oh = Math.max(1, Math.round(ch * f));
  const sx = cw / ow, sy = ch / oh;
  // trọng số từng ô nguồn cho mỗi ô đích trên một trục
  const trongSo = (n, s) => Array.from({ length: n }, (_, o) => {
    const a = o * s, b = a + s, ra = [];
    for (let i = Math.floor(a); i < Math.min(Math.ceil(b), Math.round(n * s)); i++) ra.push([i, Math.min(b, i + 1) - Math.max(a, i)]);
    return ra;
  });
  const tx = trongSo(ow, sx), ty = trongSo(oh, sy);
  // lượt ngang
  const tam = new Float64Array(ow * ch * 4);
  for (let y = 0; y < ch; y++) for (let o = 0; o < ow; o++) {
    let r = 0, g = 0, b = 0, a = 0, t = 0;
    for (const [i, k] of tx[o]) {
      const p = ((khung.y0 + y) * W + khung.x0 + i) * 4, al = px[p + 3] / 255;
      r += px[p] * al * k; g += px[p + 1] * al * k; b += px[p + 2] * al * k; a += al * k; t += k;
    }
    const q = (y * ow + o) * 4;
    tam[q] = r / t; tam[q + 1] = g / t; tam[q + 2] = b / t; tam[q + 3] = a / t;
  }
  // lượt dọc, rồi chia alpha trở lại và thêm lề
  const w = ow + 2 * LE, h = oh + 2 * LE, ra = Buffer.alloc(w * h * 4);
  for (let o = 0; o < oh; o++) for (let x = 0; x < ow; x++) {
    let r = 0, g = 0, b = 0, a = 0, t = 0;
    for (const [i, k] of ty[o]) {
      const q = (i * ow + x) * 4;
      r += tam[q] * k; g += tam[q + 1] * k; b += tam[q + 2] * k; a += tam[q + 3] * k; t += k;
    }
    a /= t;
    const d = ((o + LE) * w + x + LE) * 4;
    if (a < 1 / 255) continue;
    ra[d] = Math.round(r / t / a); ra[d + 1] = Math.round(g / t / a); ra[d + 2] = Math.round(b / t / a);
    ra[d + 3] = Math.round(a * 255);
  }
  return { w, h, px: ra };
}

