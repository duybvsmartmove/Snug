// Nhập ảnh giao diện (icon booster, nút, khung đồng hồ…) vào bộ art.
//
// Chạy: node tools/import_ui.mjs <file PNG…> [--art cozy] [--cao 192] [--ghi]
//
// Mỗi ảnh được làm sạch nền rác, cắt sát viền, thu về cao --cao px (hiển thị ~1/3 cỡ đó trên
// màn, đủ nét cho màn 3x), ghi vào assets/ui/<tên>.png. Tên lấy từ tên file, bỏ tiền tố "ic_":
// ic_pause.png → "pause". Mục lục assets/index.json có thêm nhóm "ui": tên → đường dẫn;
// HUD thấy tên nào có ảnh thì dùng ảnh, không thì giữ icon vẽ sẵn.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { docPNG, ghiPNG } from './png.mjs';
import { lamSach, thuNho, LE } from './anh.mjs';
import { ART, ARGS, CONTENT } from './art.mjs';

const i = ARGS.indexOf('--cao');
const CAO = i >= 0 ? Number(ARGS[i + 1]) : 192;
const GHI = ARGS.includes('--ghi');
const files = ARGS.filter((a, k) => !a.startsWith('--') && ARGS[k - 1] !== '--cao');
if (!files.length) { console.error('Cần ít nhất một file PNG.'); process.exit(1); }

const idxFile = resolve(CONTENT, 'assets/index.json');
const index = JSON.parse(readFileSync(idxFile, 'utf8'));
index.ui = index.ui || {};
const bang = [];
for (const f of files) {
  const ten = basename(f, '.png').replace(/^ic_/, '');
  const anh = docPNG(f);
  const k = lamSach(anh);
  const ra = thuNho(anh, k, Math.min(1, (CAO - 2 * LE) / (k.y1 - k.y0)));
  bang.push({ file: basename(f), tên: ten, ảnh: `${ra.w}×${ra.h}` });
  if (GHI) {
    mkdirSync(resolve(CONTENT, 'assets/ui'), { recursive: true });
    ghiPNG(resolve(CONTENT, `assets/ui/${ten}.png`), ra);
    index.ui[ten] = `assets/ui/${ten}.png`;
  }
}
console.log(`Bộ art ${ART}`);
console.table(bang);
if (GHI) { writeFileSync(idxFile, JSON.stringify(index, null, 2) + '\n'); console.log('Đã ghi ảnh và mục lục.'); }
else console.log('\nXem trước, chưa ghi gì. Thêm --ghi để ghi thật.');
