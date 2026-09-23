// Sinh lại vùng va chạm của từng món BÁM SÁT viền ảnh PNG, ghi vào manifest.
//
// Trước đây vùng va chạm nằm trong bảng viết tay src/data/items.js còn ảnh sinh riêng,
// hai bên không ai biết ai nên lệch nhau vài phần trăm: hai món chạm nhau đúng luật thì
// nét viền vẫn đè lên nhau, còn nhìn thì tưởng còn khe hở.
//
// Chạy: node build_colliders.mjs [--ghi] [--art casual] [mã món…]
//   không có --ghi thì chỉ xem trước; không ghi mã món thì làm mọi món của bộ art
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { docPNG } from './tools/png.mjs';
import { doVien, rutGon, dienTich } from './tools/vien.mjs';

import { CONTENT, ARGS } from './tools/art.mjs';
const CHI = new Set(ARGS.filter(a => /^-?\d+$/.test(a)));
const GHI = process.argv.includes('--ghi');

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

  // Đổi sang đơn vị game, gốc đặt ở TÂM ẢNH: đa giác nằm đúng chỗ nó nằm trên ảnh.
  // Không dời về trọng tâm nữa. Trước đây có dời, để trọng tâm về (0,0) cho khớp chỗ Matter đặt
  // thân; nhưng dời đa giác là dời nó so với ảnh, món cân đối thì lệch vài px không thấy, quả
  // chuối cong thì vùng va chạm trượt hẳn ra ngoài. Giờ renderer vẽ ảnh bù độ lệch trọng tâm
  // (body.origin), đa giác giữ nguyên chỗ trên ảnh.
  const cx = anh.w / 2, cy = anh.h / 2;
  const pts = gon.map(([x, y]) => [+((x + .5 - cx) / ppu).toFixed(2), +((y + .5 - cy) / ppu).toFixed(2)]);

  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const rong = Math.max(...xs) - Math.min(...xs), cao = Math.max(...ys) - Math.min(...ys);

  // Món vốn là hình tròn thì giữ hình tròn: lăn đúng chất hơn và rẻ hơn nhiều.
  // Chỉ khi ảnh vẫn tròn thật: art mới có thể vẽ lại dáng khác (hộp tai nghe tròn → viên thuốc).
  // Quả táo hơi dẹt (0,84) vẫn tính là tròn; viên thuốc (1,34) thì không.
  const tronThat = Math.abs(Math.log(rong / cao)) < Math.log(1.25) && Math.abs(dienTich(pts)) / (Math.PI * (rong + cao) ** 2 / 16) > .85;
  if (buocLaCircle && tronThat) {
    // Hình tròn thì tâm đặt tại tâm ảnh: cách đo bán kính theo gốc chỉ đúng khi món nằm giữa ảnh,
    // mà ảnh đã cắt sát viền nên đúng.
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
  if (CHI.size && !CHI.has(id)) continue;
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
