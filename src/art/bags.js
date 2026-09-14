// Vẽ 3 chiếc túi của chương School Day theo sheet: Lunch Box, Tote Bag, Backpack.
// drawBag() vẽ phía sau đồ (thân + lót), drawBagFront() vẽ khung và trang trí phủ lên đồ.
// Lòng túi luôn là polygon BAG.poly, hình vẽ có thể phồng ra ngoài tuỳ ý.
import { ctx } from '../game/canvas.js';
import { BAG, S } from '../game/state.js';
import { theme, rrect } from './helpers.js';

const SKIN = {
  lunchbox: { body: '#E8434F', dark: '#B92A38', light: '#F4737C', lining: '#F7E9D6', trim: '#F6D34B', label: 'LUNCH' },
  tote:     { body: '#3FB8AF', dark: '#2A8B84', light: '#6FD3CB', lining: '#EAD9BE', trim: '#F2A33C', label: 'SCHOOL' },
  backpack: { body: '#4A63C8', dark: '#33489C', light: '#7387DE', lining: '#2A3468', trim: '#F6D34B', label: 'READY' },
};
const skin = () => SKIN[BAG.kind] || SKIN.backpack;

// ---------- silhouette ngoài (chỉ hình ảnh) ----------
const BULGE = 12;
function bagSilhouette(c) {
  const { BL, BR, BT, BB } = BAG;
  c.beginPath();
  if (BAG.kind === 'tote') {                         // hình thang: miệng rộng hơn đáy
    c.moveTo(BL - 10, BT); c.lineTo(BL + 14, BB - 18);
    c.quadraticCurveTo(BL + 16, BB, BL + 34, BB);
    c.lineTo(BR - 34, BB); c.quadraticCurveTo(BR - 16, BB, BR - 14, BB - 18);
    c.lineTo(BR + 10, BT); c.closePath(); return;
  }
  if (BAG.kind === 'lunchbox') {                     // hộp chữ nhật bo góc to
    c.roundRect(BL - 4, BT - 2, BR - BL + 8, BB - BT + 4, 18); return;
  }
  // backpack: đỉnh bo tròn
  c.moveTo(BL - 4, BB - 26);
  c.lineTo(BL - 4, BT + 34);
  c.quadraticCurveTo(BL - 4, BT - 2, BAG.cx, BT - 2);
  c.quadraticCurveTo(BR + 4, BT - 2, BR + 4, BT + 34);
  c.lineTo(BR + 4, BB - 26);
  c.quadraticCurveTo(BR + 4, BB, BR - 26, BB);
  c.lineTo(BL + 26, BB);
  c.quadraticCurveTo(BL - 4, BB, BL - 4, BB - 26);
  c.closePath();
}
function innerPath(c, append) {
  if (!append) c.beginPath();
  BAG.poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
}

/** Thân túi. frameOnly = chỉ phần viền quanh lòng túi, để đè lên đồ */
function paintBody(frameOnly) {
  const s = skin(), { BL, BR, BT, BB } = BAG;
  ctx.save();
  bagSilhouette(ctx);
  if (frameOnly) { innerPath(ctx, true); ctx.clip('evenodd'); } else ctx.clip();
  const g = ctx.createLinearGradient(BL, BT, BR, BB);
  g.addColorStop(0, s.light); g.addColorStop(.45, s.body); g.addColorStop(1, s.dark);
  ctx.fillStyle = g; ctx.fillRect(BL - 40, BT - 40, BR - BL + 80, BB - BT + 80);

  if (BAG.kind === 'backpack') {                     // vải dù: sọc dọc mảnh
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 2;
    for (let x = BL; x < BR; x += 9) { ctx.beginPath(); ctx.moveTo(x, BT - 20); ctx.lineTo(x, BB + 20); ctx.stroke(); }
  } else if (BAG.kind === 'tote') {                  // vải canvas: dệt ô
    ctx.strokeStyle = 'rgba(0,0,0,.07)'; ctx.lineWidth = 1.5;
    for (let y = BT; y < BB; y += 6) { ctx.beginPath(); ctx.moveTo(BL - 20, y); ctx.lineTo(BR + 20, y); ctx.stroke(); }
    for (let x = BL - 20; x < BR + 20; x += 6) { ctx.beginPath(); ctx.moveTo(x, BT); ctx.lineTo(x, BB); ctx.stroke(); }
  } else {                                           // lunchbox: nhựa bóng
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.ellipse(BAG.cx - 30, BT + 26, 46, 16, -.25, 0, Math.PI * 2); ctx.fill();
  }
  // khối sáng tối
  const sh = ctx.createLinearGradient(BL, 0, BR, 0);
  sh.addColorStop(0, 'rgba(0,0,0,.22)'); sh.addColorStop(.12, 'rgba(0,0,0,0)');
  sh.addColorStop(.88, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.22)');
  ctx.fillStyle = sh; ctx.fillRect(BL - 40, BT - 40, BR - BL + 80, BB - BT + 80);
  const sv = ctx.createLinearGradient(0, BT, 0, BB);
  sv.addColorStop(0, 'rgba(255,255,255,.16)'); sv.addColorStop(.45, 'rgba(255,255,255,0)'); sv.addColorStop(1, 'rgba(0,0,0,.2)');
  ctx.fillStyle = sv; ctx.fillRect(BL - 40, BT - 40, BR - BL + 80, BB - BT + 80);
  ctx.restore();
}

/** Lót trong lòng túi */
function paintLining() {
  const s = skin();
  ctx.save(); innerPath(ctx); ctx.clip();
  const lg = ctx.createLinearGradient(0, BAG.top, 0, BAG.bottom);
  lg.addColorStop(0, s.lining); lg.addColorStop(1, BAG.kind === 'backpack' ? '#1E2550' : '#D9C6A8');
  ctx.fillStyle = lg; ctx.fillRect(BAG.left, BAG.top, BAG.innerW, BAG.innerH);
  if (BAG.kind === 'lunchbox') {                    // khay chia ô mờ
    ctx.strokeStyle = 'rgba(120,90,60,.18)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(BAG.cx, BAG.top + 8); ctx.lineTo(BAG.cx, BAG.bottom - 8); ctx.stroke();
  } else if (BAG.kind === 'tote') {
    ctx.strokeStyle = 'rgba(120,90,60,.12)'; ctx.lineWidth = 1.5;
    for (let y = BAG.top; y < BAG.bottom; y += 5) { ctx.beginPath(); ctx.moveTo(BAG.left, y); ctx.lineTo(BAG.right, y); ctx.stroke(); }
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 6;
    for (let d = -300; d < 600; d += 24) { ctx.beginPath(); ctx.moveTo(BAG.left + d, BAG.top); ctx.lineTo(BAG.left + d - 110, BAG.bottom); ctx.stroke(); }
  }
  // tối dần ở miệng và hai bên cho có chiều sâu
  const ig = ctx.createLinearGradient(0, BAG.top, 0, BAG.top + 64);
  ig.addColorStop(0, 'rgba(0,0,0,.4)'); ig.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ig; ctx.fillRect(BAG.left, BAG.top, BAG.innerW, 64);
  const sg = ctx.createLinearGradient(BAG.left, 0, BAG.right, 0);
  sg.addColorStop(0, 'rgba(0,0,0,.28)'); sg.addColorStop(.1, 'rgba(0,0,0,0)');
  sg.addColorStop(.9, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.28)');
  ctx.fillStyle = sg; ctx.fillRect(BAG.left, BAG.top, BAG.innerW, BAG.innerH);
  ctx.restore();
}

/** Block chặn đặt sẵn trong túi */
function drawBlocks() {
  for (const b of BAG.blocks) {
    ctx.save();
    rrect(ctx, b.x, b.y, b.w, b.h, 5); ctx.fillStyle = '#F2A33C'; ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(59,42,74,.55)'; ctx.lineWidth = 5;
    for (let d = -b.h; d < b.w + b.h; d += 14) { ctx.beginPath(); ctx.moveTo(b.x + d, b.y); ctx.lineTo(b.x + d + b.h, b.y + b.h); ctx.stroke(); }
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = theme.ink; rrect(ctx, b.x, b.y, b.w, b.h, 5); ctx.stroke();
    // nhãn "ngăn khóa" cho biết đây là vật cản, không phải chỗ trống
    if (b.w > 60) {
      ctx.fillStyle = 'rgba(59,42,74,.75)'; ctx.font = '800 8px Nunito';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '1px';
      ctx.fillText('NGĂN KHOÁ', b.x + b.w / 2, b.y + b.h / 2); ctx.letterSpacing = '0px';
    }
  }
}

/** Dòng chữ mời gọi khi lòng túi còn trống */
function drawEmptyLabel() {
  if (!S.LEVEL || S.checked.size > 0) return;
  const anyInside = S.bodies.some(b => b.bounds.min.y > BAG.top && b.bounds.max.y < BAG.bottom + 4
    && b.bounds.min.x > BAG.left - 4 && b.bounds.max.x < BAG.right + 4 && b.label !== 'key');
  if (anyInside) return;
  ctx.save();
  ctx.globalAlpha = .55; ctx.fillStyle = BAG.kind === 'backpack' ? '#C9D2F5' : '#8A7358';
  ctx.font = '600 15px Fredoka, Nunito, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(S.LEVEL.emptyText || 'Xếp đồ vào đây nào!', BAG.cx, (BAG.top + BAG.bottom) / 2);
  ctx.restore();
}

export function drawBag() {
  const { BL, BR, BB } = BAG;
  // bóng đổ xuống sàn
  ctx.save(); ctx.filter = 'blur(6px)'; ctx.fillStyle = 'rgba(60,45,35,.3)';
  ctx.beginPath(); ctx.ellipse(BAG.cx + 3, BB + 10, (BR - BL) / 2 + 8, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  paintBody(false);
  paintLining();
}

export function drawBagFront() {
  const s = skin(), { BL, BR, BT, BB } = BAG;
  paintBody(true);
  drawBlocks();

  // mép lòng túi
  ctx.save(); innerPath(ctx); ctx.lineWidth = 5; ctx.strokeStyle = s.dark; ctx.stroke();
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  // viền ngoài
  ctx.save(); bagSilhouette(ctx); ctx.lineWidth = 3.2; ctx.strokeStyle = theme.ink; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();

  if (BAG.kind === 'lunchbox') {
    // khóa gài hai bên + quai nhỏ trên nắp
    for (const x of [BL + 12, BR - 30]) {
      rrect(ctx, x, BT - 12, 18, 16, 4); ctx.fillStyle = s.trim; ctx.fill();
      ctx.lineWidth = 2.4; ctx.strokeStyle = theme.ink; ctx.stroke();
    }
    ctx.strokeStyle = s.trim; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(BAG.cx - 26, BT - 6); ctx.quadraticCurveTo(BAG.cx, BT - 26, BAG.cx + 26, BT - 6); ctx.stroke();
    ctx.lineWidth = 2.6; ctx.strokeStyle = theme.ink; ctx.stroke();
  } else if (BAG.kind === 'tote') {
    // hai quai vải vòng lên
    ctx.save(); ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const ax = BAG.cx + side * 54;
      ctx.beginPath(); ctx.moveTo(ax - side * 14, BT + 4);
      ctx.quadraticCurveTo(ax, BT - 62, ax + side * 22, BT + 4);
      ctx.lineWidth = 13; ctx.strokeStyle = theme.ink; ctx.stroke();
      ctx.lineWidth = 9; ctx.strokeStyle = s.trim; ctx.stroke();
    }
    ctx.restore();
    // dải vải miệng túi
    rrect(ctx, BL - 12, BT - 4, BR - BL + 24, 16, 5);
    ctx.fillStyle = s.trim; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = theme.ink; ctx.stroke();
  } else {
    // backpack: nắp trên, khóa gài, hai dây đeo ló ra hai bên
    ctx.save();
    for (const side of [-1, 1]) {
      const ax = BAG.cx + side * (BAG.innerW / 2 + 6);
      ctx.beginPath(); ctx.moveTo(ax, BT + 20);
      ctx.quadraticCurveTo(ax + side * 30, BT + 90, ax - side * 2, BB - 16);
      ctx.lineWidth = 17; ctx.strokeStyle = theme.ink; ctx.lineCap = 'round'; ctx.stroke();
      ctx.lineWidth = 12; ctx.strokeStyle = s.dark; ctx.stroke();
    }
    ctx.restore();
    // nắp trên bo tròn (giữ thấp để không đè lên HUD)
    ctx.beginPath();
    ctx.moveTo(BL - 4, BT + 18);
    ctx.quadraticCurveTo(BAG.cx, BT - 12, BR + 4, BT + 18);
    ctx.quadraticCurveTo(BAG.cx, BT + 8, BL - 4, BT + 18);
    ctx.closePath();
    ctx.fillStyle = s.dark; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = theme.ink; ctx.stroke();
    // khóa gài giữa
    rrect(ctx, BAG.cx - 15, BT + 5, 30, 17, 5);
    ctx.fillStyle = s.trim; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = theme.ink; ctx.stroke();
    ctx.fillStyle = theme.ink; rrect(ctx, BAG.cx - 7, BT + 10, 14, 5, 2); ctx.fill();
  }

  // nhãn dệt ở đáy
  const ty = BB - 26;
  rrect(ctx, BAG.cx - 34, ty, 68, 19, 5);
  ctx.fillStyle = s.trim; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = theme.ink; ctx.stroke();
  ctx.fillStyle = theme.ink; ctx.font = '800 9px Nunito'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.letterSpacing = '1.6px';
  ctx.fillText(s.label, BAG.cx, ty + 10);
  ctx.letterSpacing = '0px';

  drawEmptyLabel();
}
