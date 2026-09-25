// Nhập một ảnh túi DÁNG CỐ ĐỊNH (vẽ liền một tấm) vào bộ art.
//
// Chạy: node tools/import_bag.mjs <ảnh.png> --id backpack --name "Ba lô" --chapter 01-school-day
//                                  [--art cozy] [--rong 180] [--seed x,y] [--tol 46] [--ghi]
//
// Túi kiểu này không kéo giãn theo level: mỗi level chỉ phóng đều cả túi (container.scale)
// và đặt vật cản. Lòng túi là mảng màu nằm trong đường khoá kéo, công cụ tự dò:
//   1. Loang từ điểm hạt (mặc định tâm ảnh) sang những điểm cùng màu (sai khác < --tol),
//      lấp lỗ, giữ mảng liền lớn nhất → mặt nạ lòng túi.
//   2. Dò viền mặt nạ, rút gọn thành đa giác → vùng va chạm lòng túi (`inner`).
//   3. Hai lớp ảnh: body = nguyên cả túi (vẽ sau đồ), frame = túi trừ lòng túi (vẽ đè lên đồ,
//      để đồ trông như nằm trong túi). Không có lớp lót: lòng túi đã có sẵn trong body.
// Ở scale 1, lòng túi rộng --rong đơn vị. Gốc toạ độ là giữa đáy lòng túi, y âm hướng lên,
// đúng quy ước toạ độ của level.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { docPNG, ghiPNG } from './png.mjs';
import { lamSach, thuNho, LE } from './anh.mjs';
import { doVien, rutGon, dienTich } from './vien.mjs';
import { ART, ARGS, CONTENT } from './art.mjs';

const opt = k => { const i = ARGS.indexOf('--' + k); return i >= 0 ? ARGS[i + 1] : undefined; };
const FILE = ARGS.find((a, i) => !a.startsWith('--') && !ARGS[i - 1]?.startsWith('--'));
const ID = opt('id'), NAME = opt('name') || ID, CHAPTER = opt('chapter') || '01-school-day';
const RONG = Number(opt('rong') || 180), TOL = Number(opt('tol') || 46);
const GHI = ARGS.includes('--ghi');
const PPU = 3;
const TOI_DA_DINH = 28;
if (!FILE || !ID) { console.error('Cần ảnh và --id. Xem đầu file để biết cách chạy.'); process.exit(1); }

const anh = docPNG(FILE);
const { w, h, px } = anh;
const khung = lamSach(anh);

// ---------- 1. mặt nạ lòng túi ----------
const [sx, sy] = (opt('seed') || `${w >> 1},${h >> 1}`).split(',').map(Number);
const s0 = (sy * w + sx) * 4, mau = [px[s0], px[s0 + 1], px[s0 + 2]];
const gan = i => px[i * 4 + 3] > 200 && Math.hypot(px[i * 4] - mau[0], px[i * 4 + 1] - mau[1], px[i * 4 + 2] - mau[2]) < TOL;
function loang(batDau, duoc) {
  const m = new Uint8Array(w * h), hang = new Int32Array(w * h);
  let dau = 0, cuoi = 0;
  for (const s of batDau) if (duoc(s) && !m[s]) { m[s] = 1; hang[cuoi++] = s; }
  while (dau < cuoi) {
    const p = hang[dau++], x = p % w, y = (p / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = ny * w + nx;
      if (!m[q] && duoc(q)) { m[q] = 1; hang[cuoi++] = q; }
    }
  }
  return m;
}
let long = loang([sy * w + sx], gan);
// lấp lỗ: điểm nào không tới được từ mép ảnh mà không đi qua lòng túi thì thuộc lòng túi
const mep = [];
for (let x = 0; x < w; x++) mep.push(x, (h - 1) * w + x);
for (let y = 0; y < h; y++) mep.push(y * w, y * w + w - 1);
const ngoai = loang(mep, i => !long[i]);
for (let i = 0; i < w * h; i++) long[i] = ngoai[i] ? 0 : 1;
let x0 = w, y0 = h, x1 = 0, y1 = 0, soO = 0;
for (let i = 0; i < w * h; i++) if (long[i]) {
  const x = i % w, y = (i / w) | 0; soO++;
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
}
if (soO < w * h * .05) { console.error(`Lòng túi dò được quá nhỏ (${soO} điểm). Thử --seed x,y hoặc --tol lớn hơn.`); process.exit(1); }

// ---------- 2. đa giác lòng túi ----------
const vien = doVien(long, w, h);
let eps = Math.max(1.5, (x1 - x0) * .004), gon = vien;
for (let i = 0; i < 30; i++) {
  gon = rutGon([...vien, vien[0]], eps); gon.pop();
  if (gon.length <= TOI_DA_DINH) break;
  eps *= 1.2;
}
const donVi = RONG / (x1 - x0 + 1);                 // đơn vị logic trên mỗi px ảnh nguồn
const goc = [(x0 + x1 + 1) / 2, y1 + 1];            // giữa đáy lòng túi
const inner = gon.map(([x, y]) => [+((x + .5 - goc[0]) * donVi).toFixed(1), +((y + .5 - goc[1]) * donVi).toFixed(1)]);

// ---------- 3. hai lớp ảnh ----------
const f = donVi * PPU;
const body = thuNho(anh, khung, f);
const frameSrc = { w, h, px: Buffer.from(px) };
for (let i = 0; i < w * h; i++) if (long[i]) frameSrc.px[i * 4 + 3] = 0;
const frame = thuNho(frameSrc, khung, f);
const image = {
  x: +((khung.x0 - goc[0]) * donVi - LE / PPU).toFixed(2),
  y: +((khung.y0 - goc[1]) * donVi - LE / PPU).toFixed(2),
  w: +(body.w / PPU).toFixed(2), h: +(body.h / PPU).toFixed(2),
};

const xs = inner.map(p => p[0]), ys = inner.map(p => p[1]);
console.log(`Bộ art ${ART} · túi "${ID}"`);
console.table([{
  'lòng túi (scale 1)': `${(Math.max(...xs) - Math.min(...xs)).toFixed(0)}×${(-Math.min(...ys)).toFixed(0)}`,
  đỉnh: inner.length, 'diện tích': Math.abs(dienTich(inner)).toFixed(0),
  'cả túi': `${image.w.toFixed(0)}×${image.h.toFixed(0)}`, ảnh: `${body.w}×${body.h}`,
  'màu lòng túi': `rgb(${mau.join(',')})`,
}]);

// --xuat file.json: ghi đường viền lòng túi theo toạ độ ẢNH GỐC, để vẽ đè lên ảnh mà soi bằng mắt
if (opt('xuat')) writeFileSync(opt('xuat'), JSON.stringify({ file: FILE, w, h, poly: gon, mau, seed: [sx, sy] }));
if (!GHI) { console.log('\nXem trước, chưa ghi gì. Thêm --ghi để ghi thật.'); process.exit(0); }
const thuMuc = `assets/${CHAPTER}/bags`;
mkdirSync(resolve(CONTENT, thuMuc), { recursive: true });
ghiPNG(resolve(CONTENT, thuMuc, `${ID}-body.png`), body);
ghiPNG(resolve(CONTENT, thuMuc, `${ID}-frame.png`), frame);
const man = {
  id: ID, name: NAME, fixed: true, pixelsPerUnit: PPU,
  // Không vẽ mép lòng túi bằng code: đường khoá kéo đã có trong ảnh
  edge: null,
  inner, image,
  layers: { body: `${thuMuc}/${ID}-body.png`, frame: `${thuMuc}/${ID}-frame.png` },
};
const duong = `${thuMuc}/${ID}.json`;
writeFileSync(resolve(CONTENT, duong), JSON.stringify(man, null, 2) + '\n');
const idxFile = resolve(CONTENT, 'assets/index.json');
const index = JSON.parse(readFileSync(idxFile, 'utf8'));
index.bags = { ...(index.bags || {}), [ID]: duong };
writeFileSync(idxFile, JSON.stringify(index, null, 2) + '\n');
console.log(`\nĐã ghi ${duong} và hai lớp ảnh, cập nhật mục lục.`);
