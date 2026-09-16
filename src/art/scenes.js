// Bối cảnh: toàn bộ là ảnh nạp từ content pack, không còn hàm vẽ nền nào.
// Mỗi bối cảnh là một hoặc nhiều lớp ảnh xếp chồng, khai báo trong assets/backgrounds/<id>.json.
import { ctx, VIEW } from '../game/canvas.js';
import { S, W, H } from '../game/state.js';
import { IMAGE_SCENES } from './scene-registry.js';

/**
 * Kéo dài lớp nền ra ngoài sân chơi cho kín màn hình.
 *
 * Sân chơi cao đúng 760 đơn vị, màn điện thoại thì cao hơn thế, nên trên và dưới ảnh
 * nền còn thừa một dải. Không thể phóng to ảnh cho vừa: làm vậy là cắt mất hai bên,
 * mà đồng hồ với khung tranh nằm sát mép. Cũng không kéo giãn được, hình sẽ méo.
 *
 * Nhưng mép trên của những bối cảnh này là mảng tường trơn và mép dưới là mặt bàn trơn,
 * nên chỉ cần lấy đúng HÀNG ĐIỂM ẢNH ngoài cùng rồi kéo dài ra là dải thừa nối liền
 * vào ảnh, không thấy đường nối mà cũng không mất gì của bức hình.
 */
function bleedEdges(img, x, y, w, h) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (VIEW.y0 < y) ctx.drawImage(img, 0, 0, iw, 1, x, VIEW.y0, w, y - VIEW.y0);
  if (VIEW.y1 > y + h) ctx.drawImage(img, 0, ih - 1, iw, 1, x, y + h, w, VIEW.y1 - (y + h));
  if (VIEW.x0 < x) ctx.drawImage(img, 0, 0, 1, ih, VIEW.x0, y, x - VIEW.x0, h);
  if (VIEW.x1 > x + w) ctx.drawImage(img, iw - 1, 0, 1, ih, x + w, y, VIEW.x1 - (x + w), h);
}

export function drawScene() {
  const id = Number(S.LEVEL?.background ?? 1);
  const def = IMAGE_SCENES[id] || IMAGE_SCENES[Object.keys(IMAGE_SCENES)[0]];
  const vw = VIEW.x1 - VIEW.x0, vh = VIEW.y1 - VIEW.y0;
  if (!def) { ctx.fillStyle = '#F2EAD2'; ctx.fillRect(VIEW.x0, VIEW.y0, vw, vh); return; }

  ctx.fillStyle = def.fill || '#F2EAD2';
  ctx.fillRect(VIEW.x0, VIEW.y0, vw, vh);
  for (const layer of def.layers || []) {
    if (!layer.img?.complete || !layer.img.naturalWidth) continue;
    ctx.save();
    if (layer.opacity != null) ctx.globalAlpha = layer.opacity;
    const x = layer.x ?? 0, y = layer.y ?? 0;
    const w = layer.w ?? W, h = layer.h ?? (layer.img.height * (w / layer.img.width));
    ctx.drawImage(layer.img, x, y, w, h);
    // Chỉ lớp nào phủ kín sân chơi mới kéo ra mép — lớp trang trí (một cái kệ, một ô
    // cửa sổ) mà kéo giãn thì thành một vệt màu chạy dọc màn hình.
    if (x <= 0 && y <= 0 && x + w >= W && y + h >= H) bleedEdges(layer.img, x, y, w, h);
    ctx.restore();
  }
}
