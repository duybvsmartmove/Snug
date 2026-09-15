// Sinh lại vùng va chạm của từng món BÁM SÁT viền ảnh PNG, ghi vào manifest.
//
// Trước đây vùng va chạm nằm trong bảng viết tay src/data/items.js còn ảnh sinh riêng,
// hai bên không ai biết ai nên lệch nhau vài phần trăm: hai món chạm nhau đúng luật thì
// nét viền vẫn đè lên nhau, còn nhìn thì tưởng còn khe hở.
//
// Chạy: node build_colliders.mjs [--ghi]    (không có --ghi thì chỉ xem trước, không sửa file)
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CONTENT = resolve(ROOT, 'public/content');
const GHI = process.argv.includes('--ghi');

// ---------------- đọc PNG (RGBA 8 bit, không xen dòng) ----------------
function docPNG(duongDan) {
  const b = readFileSync(duongDan);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('không phải PNG');
  let i = 8, w = 0, h = 0, sauBit = 0, kieuMau = 0, xenDong = 0;
  const idat = [];
  while (i < b.length) {
    const len = b.readUInt32BE(i), ten = b.toString('ascii', i + 4, i + 8);
    const data = b.subarray(i + 8, i + 8 + len);
    if (ten === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      sauBit = data[8]; kieuMau = data[9]; xenDong = data[12];
    } else if (ten === 'IDAT') idat.push(data);
    else if (ten === 'IEND') break;
    i += 12 + len;
  }
  if (sauBit !== 8 || kieuMau !== 6 || xenDong !== 0)
    throw new Error(`chỉ đọc được RGBA 8 bit không xen dòng (nhận được sâu=${sauBit} kiểu=${kieuMau} xen=${xenDong})`);

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4, buocDong = w * bpp;
  const px = Buffer.alloc(w * h * bpp);
  let o = 0;
  for (let y = 0; y < h; y++) {
    const loc = raw[o++];
    const dong = raw.subarray(o, o + buocDong); o += buocDong;
    const ra = px.subarray(y * buocDong, (y + 1) * buocDong);
    const tren = y ? px.subarray((y - 1) * buocDong, y * buocDong) : null;
    for (let x = 0; x < buocDong; x++) {
      const A = x >= bpp ? ra[x - bpp] : 0;      // trái
      const B = tren ? tren[x] : 0;              // trên
      const C = tren && x >= bpp ? tren[x - bpp] : 0;  // chéo trên trái
      let v = dong[x];
      if (loc === 1) v += A;
      else if (loc === 2) v += B;
      else if (loc === 3) v += (A + B) >> 1;
      else if (loc === 4) {                       // Paeth
        const p = A + B - C, pa = Math.abs(p - A), pb = Math.abs(p - B), pc = Math.abs(p - C);
        v += (pa <= pb && pa <= pc) ? A : (pb <= pc ? B : C);
      }
      ra[x] = v & 255;
    }
  }
  return { w, h, px };
}

// ---------------- mặt nạ vùng có màu ----------------
const NGUONG_ALPHA = 24;

/** Giữ lại mảng liền nhau lớn nhất, bỏ những đốm lẻ do khử răng cưa để lại */
function matNa(anh) {
  const { w, h, px } = anh;
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = px[i * 4 + 3] > NGUONG_ALPHA ? 1 : 0;

  const nhan = new Int32Array(w * h).fill(-1);
  let nhanTot = -1, toNhat = 0;
  const hangDoi = new Int32Array(w * h);
  let soNhan = 0;
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || nhan[s] >= 0) continue;
    let dau = 0, cuoi = 0, dem = 0;
    hangDoi[cuoi++] = s; nhan[s] = soNhan;
    while (dau < cuoi) {
      const p = hangDoi[dau++]; dem++;
      const x = p % w, y = (p / w) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (m[q] && nhan[q] < 0) { nhan[q] = soNhan; hangDoi[cuoi++] = q; }
      }
    }
    if (dem > toNhat) { toNhat = dem; nhanTot = soNhan; }
    soNhan++;
  }
  for (let i = 0; i < w * h; i++) if (nhan[i] !== nhanTot) m[i] = 0;
  return { m, soO: toNhat };
}

// ---------------- dò viền (Moore) ----------------
const HUONG = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];

function doVien(m, w, h) {
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
function rutGon(pts, eps) {
  if (pts.length < 3) return pts.slice();
  let xa = 0, chiSo = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = khoangCach(pts[i], pts[0], pts[pts.length - 1]);
    if (d > xa) { xa = d; chiSo = i; }
  }
  if (xa <= eps) return [pts[0], pts[pts.length - 1]];
  return [...rutGon(pts.slice(0, chiSo + 1), eps).slice(0, -1), ...rutGon(pts.slice(chiSo), eps)];
}

const dienTich = pts => {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
};
/** Trọng tâm theo diện tích, đúng công thức Matter dùng để đặt tâm vật */
function trongTam(pts) {
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

// ---------------- sinh collider cho một món ----------------
const TOI_DA_DINH = 16;

function sinhCollider(duongDanAnh, ppu, buocLaCircle) {
  const anh = docPNG(duongDanAnh);
  const { m, soO } = matNa(anh);
  if (!soO) throw new Error('ảnh trống');
  const vien = doVien(m, anh.w, anh.h);
  if (vien.length < 8) throw new Error('viền quá ít điểm');

  // rút gọn dần cho tới khi đủ ít đỉnh; sai số tính bằng pixel ảnh
  let eps = Math.max(1.5, Math.min(anh.w, anh.h) * 0.012), gon = vien;
  for (let i = 0; i < 24; i++) {
    gon = rutGon([...vien, vien[0]], eps);
    gon.pop();
    if (gon.length <= TOI_DA_DINH) break;
    eps *= 1.28;
  }

  // đổi sang đơn vị game, gốc đặt ở TÂM ẢNH (đúng chỗ renderer vẽ ảnh)
  const cx = anh.w / 2, cy = anh.h / 2;
  let pts = gon.map(([x, y]) => [(x + .5 - cx) / ppu, (y + .5 - cy) / ppu]);

  // Dời sao cho TRỌNG TÂM đa giác về gốc. Matter đặt vật theo trọng tâm, còn renderer
  // vẽ ảnh căn giữa tại đúng chỗ đó — không dời thì hình lệch khỏi vùng va chạm.
  const [tx, ty] = trongTam(pts);
  pts = pts.map(([x, y]) => [+(x - tx).toFixed(2), +(y - ty).toFixed(2)]);

  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const rong = Math.max(...xs) - Math.min(...xs), cao = Math.max(...ys) - Math.min(...ys);

  // Món vốn là hình tròn thì giữ hình tròn: lăn đúng chất hơn và rẻ hơn nhiều.
  if (buocLaCircle) {
    const r = +(pts.reduce((s, p) => s + Math.hypot(p[0], p[1]), 0) / pts.length).toFixed(2);
    return { collider: { kind: 'circle', r }, soDinh: 0, rong, cao, dt: Math.PI * r * r };
  }
  return { collider: { kind: 'poly', pts }, soDinh: pts.length, rong, cao, dt: Math.abs(dienTich(pts)) };
}

// ---------------- chạy ----------------
const index = JSON.parse(readFileSync(resolve(CONTENT, 'assets/index.json'), 'utf8'));
const { ITEM_DEFS, defById } = await import('./src/data/items.js');

const bang = [];
let loi = 0;
for (const [id, duong] of Object.entries(index.items)) {
  const fileManifest = resolve(CONTENT, duong);
  const man = JSON.parse(readFileSync(fileManifest, 'utf8'));
  if (!man.sprite?.src) { bang.push({ id, ten: man.name, ghiChu: 'không có ảnh' }); continue; }
  const cu = defById(Number(id));
  try {
    const ppu = man.sprite.pixelsPerUnit || 3;
    const kq = sinhCollider(resolve(CONTENT, man.sprite.src), ppu, cu?.kind === 'circle');
    const cuRong = cu ? cu.box[2] - cu.box[0] : 0, cuCao = cu ? cu.box[3] - cu.box[1] : 0;
    bang.push({
      id, ten: man.name || cu?.name, kieu: kq.collider.kind, dinh: kq.soDinh,
      cu: `${cuRong}x${cuCao}`, moi: `${kq.rong.toFixed(0)}x${kq.cao.toFixed(0)}`,
      lech: cuRong ? `${((kq.rong / cuRong - 1) * 100).toFixed(0)}% / ${((kq.cao / cuCao - 1) * 100).toFixed(0)}%` : '—',
    });
    if (GHI) {
      man.collider = kq.collider;
      writeFileSync(fileManifest, JSON.stringify(man, null, 2) + '\n');
    }
  } catch (e) {
    loi++;
    bang.push({ id, ten: man.name, ghiChu: 'LỖI: ' + e.message });
  }
}

console.table(bang);
console.log(GHI ? `\nĐã ghi collider vào ${bang.length - loi} manifest.` : '\nXem trước, chưa ghi gì. Thêm --ghi để ghi thật.');
if (loi) console.log(`${loi} món lỗi.`);
