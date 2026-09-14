// Bối cảnh chương School Day: góc học tập buổi sáng.
// Nửa trên là tường và bàn học, nửa dưới là mặt bàn nơi đồ nằm rải.
import { ctx } from '../../src/game/canvas.js';
import { S, W, H, TABLE_Y } from '../../src/game/state.js';
import { rrect } from '../../src/art/helpers.js';
import { SCENES, IMAGE_SCENES, registerScene } from '../../src/art/scene-registry.js';

let wallPattern = null, woodPattern = null;

function makeWallPattern() {
  const p = document.createElement('canvas'); p.width = p.height = 34;
  const g = p.getContext('2d');
  g.strokeStyle = 'rgba(150,175,150,.22)'; g.lineWidth = 2; g.lineCap = 'round';
  // ô vở kẻ caro nhạt, gợi giấy kẻ ô
  g.beginPath(); g.moveTo(0, 17); g.lineTo(34, 17); g.moveTo(17, 0); g.lineTo(17, 34); g.stroke();
  return ctx.createPattern(p, 'repeat');
}
function makeWoodPattern() {
  const p = document.createElement('canvas'); p.width = 60; p.height = 40;
  const g = p.getContext('2d');
  g.strokeStyle = 'rgba(120,80,45,.16)'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(0, 9); g.bezierCurveTo(18, 12, 38, 5, 60, 9); g.stroke();
  g.beginPath(); g.moveTo(0, 27); g.bezierCurveTo(20, 23, 40, 31, 60, 26); g.stroke();
  return ctx.createPattern(p, 'repeat');
}

/** Đồng hồ treo tường, gợi giờ đi học */
function drawClock(x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFDF6'; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = '#E8734A'; ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(60,45,40,.5)';
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r - 7), y + Math.sin(a) * (r - 7));
    ctx.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3));
    ctx.stroke();
  }
  ctx.strokeStyle = '#3B2A4A'; ctx.lineCap = 'round';
  ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - r * .5); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r * .6, y + r * .18); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#E8734A'; ctx.fill();
}

/** Giá sách nhỏ trên tường */
function drawShelf(x, y, w) {
  const cols = ['#E8434F', '#4FB3E8', '#2FB57A', '#F2A33C', '#7B4FD8'];
  cols.forEach((col, i) => {
    const bw = 13 + (i % 3) * 3, bh = 34 + (i % 2) * 8;
    rrect(ctx, x + i * 17, y - bh, bw, bh, 2);
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(60,45,40,.45)'; ctx.stroke();
  });
  rrect(ctx, x - 8, y, w, 8, 3); ctx.fillStyle = '#C98A4B'; ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(80,55,30,.55)'; ctx.stroke();
}

/** Cửa sổ sáng buổi sớm */
function drawWindow(x, y, w, h, T) {
  rrect(ctx, x, y, w, h, 8);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); rrect(ctx, x, y, w, h, 8); ctx.clip();
  ctx.fillStyle = T.sun; ctx.beginPath(); ctx.arc(x + w * .72, y + h * T.sunY, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.beginPath(); ctx.arc(x + 20, y + h * .5, 10, 0, Math.PI * 2); ctx.arc(x + 34, y + h * .46, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8FD68A'; ctx.fillRect(x, y + h - 18, w, 18);
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = '#FFFDF6'; ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(60,45,40,.4)'; rrect(ctx, x, y, w, h, 8); ctx.stroke();
}

export function drawScene() {
  const bg = Number(S.LEVEL?.background ?? 1);
  const img = IMAGE_SCENES[bg];
  if (img) return drawImageScene(img);
  (SCENES[bg]?.draw || SCENES[1].draw)();
}

/** Vẽ nền bằng ảnh: các lớp xếp chồng, mỗi lớp có y và opacity riêng */
function drawImageScene(def) {
  ctx.fillStyle = def.fill || '#F2EAD2';
  ctx.fillRect(0, 0, W, H);
  for (const layer of def.layers || []) {
    if (!layer.img?.complete || !layer.img.naturalWidth) continue;
    ctx.save();
    if (layer.opacity != null) ctx.globalAlpha = layer.opacity;
    const w = layer.w ?? W, h = layer.h ?? (layer.img.height * (w / layer.img.width));
    ctx.drawImage(layer.img, layer.x ?? 0, layer.y ?? 0, w, h);
    ctx.restore();
  }
}

// Ba thời điểm trong ngày, chỉ khác ánh sáng và màu — cùng một căn phòng
const TIME = {
  morning: { wall: ['#FBF6E4', '#F2EAD2'], grid: 'rgba(150,175,150,.22)', sky: ['#BFE8F5', '#EAF7DA'],
             sun: '#FFF0A8', sunY: .28, wood: ['#E0A86C', '#C07F45'], glow: null },
  noon:    { wall: ['#FFFCEC', '#F8F0D6'], grid: 'rgba(160,180,140,.2)', sky: ['#A8DFF2', '#DFF3C8'],
             sun: '#FFF6C8', sunY: .16, wood: ['#E8B276', '#C8874A'], glow: 'rgba(255,240,170,.18)' },
  dusk:    { wall: ['#F6E6D4', '#E9D2BC'], grid: 'rgba(150,120,110,.2)', sky: ['#F7C98F', '#F3A columns'],
             sun: '#FFC46B', sunY: .52, wood: ['#C98F5C', '#A46A38'], glow: 'rgba(255,170,90,.16)' },
};
TIME.dusk.sky = ['#F7C98F', '#F0A07A'];

function drawClassroom(when = 'morning') {
  const T = TIME[when] || TIME.morning;
  // ---- tường ----
  const sky = ctx.createLinearGradient(0, 0, 0, TABLE_Y);
  sky.addColorStop(0, T.wall[0]); sky.addColorStop(1, T.wall[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, TABLE_Y);
  if (!wallPattern) wallPattern = makeWallPattern();
  ctx.fillStyle = wallPattern; ctx.fillRect(0, 0, W, TABLE_Y);

  // ---- trang trí tường (đặt xa vùng HUD và túi) ----
  drawWindow(16, 96, 96, 84, T);
  drawClock(372, 128, 26);
  drawShelf(300, 260, 100);

  // ---- mặt bàn gỗ ----
  const wood = ctx.createLinearGradient(0, TABLE_Y, 0, H);
  wood.addColorStop(0, T.wood[0]); wood.addColorStop(1, T.wood[1]);
  ctx.fillStyle = wood; ctx.fillRect(0, TABLE_Y, W, H - TABLE_Y);
  if (!woodPattern) woodPattern = makeWoodPattern();
  ctx.fillStyle = woodPattern; ctx.fillRect(0, TABLE_Y, W, H - TABLE_Y);
  // mép bàn
  ctx.fillStyle = '#F0C089'; ctx.fillRect(0, TABLE_Y, W, 6);
  ctx.fillStyle = 'rgba(90,55,25,.25)'; ctx.fillRect(0, TABLE_Y + 6, W, 3);
  // bóng đổ nhẹ dưới chân tường
  const sh = ctx.createLinearGradient(0, TABLE_Y, 0, TABLE_Y + 40);
  sh.addColorStop(0, 'rgba(80,50,20,.18)'); sh.addColorStop(1, 'rgba(80,50,20,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, TABLE_Y, W, 40);
  // vệt nắng chiếu qua cửa sổ
  if (T.glow) {
    ctx.save(); ctx.fillStyle = T.glow;
    ctx.beginPath(); ctx.moveTo(20, 180); ctx.lineTo(116, 180); ctx.lineTo(210, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

registerScene(1, 'Góc học tập · sáng',  () => drawClassroom('morning'));
registerScene(2, 'Góc học tập · trưa',  () => drawClassroom('noon'));
registerScene(3, 'Góc học tập · chiều', () => drawClassroom('dusk'));
