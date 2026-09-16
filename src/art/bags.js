// Vẽ túi bằng sprite. Ba lớp PNG cho mỗi kiểu túi, kéo giãn theo khung của từng level:
//
//   body    thân túi, nằm sau đồ
//   lining  lót trong lòng túi, CẮT THEO POLYGON của level nên hình khuyết góc vẫn đúng
//   frame   khung và trang trí, đè lên đồ để che phần đồ thò ra
//
// Những thứ phụ thuộc dữ liệu level thì vẫn vẽ lúc chơi: mép lòng túi, ngăn khoá, chữ gợi ý.
// Toàn bộ phần nhìn của túi đến từ ảnh, không còn hàm vẽ hình nào.
import { ctx } from '../game/canvas.js';
import { BAG, S } from '../game/state.js';
import { theme, rrect } from './helpers.js';
import { BAG_SKINS } from './scene-registry.js';

export const bagSkin = () => BAG_SKINS[BAG.kind] || BAG_SKINS.backpack || null;

const innerPath = c => { c.beginPath(); BAG.poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };

/** Vẽ một lớp ảnh phủ kín khung túi, kéo giãn từ khung chuẩn sang khung của level */
function drawLayer(img, m) {
  if (!img?.complete || !img.naturalWidth) return false;
  const x = BAG.BL - m, y = BAG.BT - m;
  ctx.drawImage(img, x, y, (BAG.BR + m) - x, (BAG.BB + m) - y);
  return true;
}

// Bóng túi đổ xuống sàn. Trước đây là một hình bầu dục đặc bôi qua ctx.filter='blur(6px)';
// bộ lọc canvas bắt trình duyệt dựng riêng một lớp rồi làm mờ thật, lại làm mỗi khung
// hình, và trên máy Android tầm trung một mình nó đã ăn vài mili giây mỗi frame. Vệt
// chuyển màu cho ra đúng mảng mờ ấy mà không tốn gì; bảng màu tạo một lần rồi dùng lại.
let bagShadow = null, bagShadowR = 0;
function drawBagShadow() {
  const rx = (BAG.BR - BAG.BL) / 2 + 14;
  if (!bagShadow || bagShadowR !== rx) {
    bagShadow = ctx.createRadialGradient(0, 0, rx * .45, 0, 0, rx);
    bagShadow.addColorStop(0, 'rgba(60,45,35,.30)');
    bagShadow.addColorStop(1, 'rgba(60,45,35,0)');
    bagShadowR = rx;
  }
  ctx.save();
  ctx.translate(BAG.cx + 3, BAG.BB + 10); ctx.scale(1, 19 / rx);
  ctx.fillStyle = bagShadow;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawBag() {
  const s = bagSkin(); if (!s) return;
  drawBagShadow();

  drawLayer(s.img?.body, s.margin);

  // lót cắt theo polygon thật của level: khuyết góc, chữ L… đều đúng hình
  ctx.save(); innerPath(ctx); ctx.clip();
  const li = s.img?.lining;
  if (li?.complete && li.naturalWidth) ctx.drawImage(li, BAG.left, BAG.top, BAG.innerW, BAG.innerH);
  ctx.restore();
}

export function drawBagFront() {
  const s = bagSkin(); if (!s) return;
  drawLayer(s.img?.frame, s.margin);
  drawBlocks();

  // mép lòng túi bám theo polygon của level
  ctx.save(); innerPath(ctx);
  ctx.lineWidth = 5; ctx.strokeStyle = s.edge || '#00000033'; ctx.stroke();
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.setLineDash([5, 5]); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();

  drawEmptyLabel();
}

/** Ngăn khoá đặt sẵn trong túi — dữ liệu của level, không bake vào ảnh được */
function drawBlocks() {
  for (const b of BAG.blocks || []) {
    ctx.save();
    rrect(ctx, b.x, b.y, b.w, b.h, 6);
    ctx.fillStyle = '#E9903B'; ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = theme.ink; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.font = '800 8px Nunito';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (b.w > 46 && b.h > 16) ctx.fillText('NGĂN KHOÁ', b.x + b.w / 2, b.y + b.h / 2);
    ctx.restore();
  }
}

/** Chữ gợi ý khi túi còn trống */
function drawEmptyLabel() {
  if (!S.LEVEL || S.checked.size > 0) return;
  const anyInside = S.bodies.some(b => b.bounds.min.y > BAG.top && b.bounds.max.y < BAG.bottom + 4
    && b.bounds.min.x > BAG.left - 4 && b.bounds.max.x < BAG.right + 4 && b.label !== 'key');
  if (anyInside) return;
  ctx.save();
  ctx.globalAlpha = .55; ctx.fillStyle = BAG.kind === 'backpack' ? '#C9D2F5' : '#8A7358';
  ctx.font = '600 15px "Baloo 2", Nunito, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(S.LEVEL.emptyText || 'Xếp đồ vào đây nào!', BAG.cx, (BAG.top + BAG.bottom) / 2);
  ctx.restore();
}
