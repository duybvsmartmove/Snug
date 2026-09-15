// Vòng lặp game: cập nhật vật lý + cơ chế + timer, rồi vẽ bối cảnh → túi → đồ → dây → khung túi → hiệu ứng.
import Matter from 'matter-js';
import { S, BAG, W, H, partsOf, isHeld } from './state.js';
import { ctx } from './canvas.js';
import { drawScene } from '../art/scenes.js';
import { drawBag, drawBagFront } from '../art/bags.js';
import { moveHeld, tickRotation, rotateButtonPos, rotButtonR } from './input.js';
import { checkEject, updateChecked } from './rules.js';
import { tickPhone, checkUnlock, drawStrings, jiggleOffset } from './mechanics.js';
import { updateClock, showLose } from '../ui/hud.js';

const { Engine } = Matter;

function strokeShape(b, grow = 1) {
  for (const p of partsOf(b)) {
    ctx.beginPath();
    if (p.circleRadius) ctx.arc(p.position.x, p.position.y, p.circleRadius + grow, 0, Math.PI * 2);
    else { p.vertices.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y))); ctx.closePath(); }
    ctx.stroke();
  }
}

/** Mọi món đều vẽ bằng sprite. Ảnh căn giữa theo trọng tâm body, đúng cách sinh ở tools/gen-sprites. */
function drawArt(b) {
  const sp = b.def.sprite;
  if (!sp?.ready) return;
  const w = sp.img.width / sp.ppu, h = sp.img.height / sp.ppu;
  ctx.drawImage(sp.img, -w / 2, -h / 2, w, h);
}

function drawBody(b) {
  const held = isHeld(b), ghost = held && S.drag.ghost, ok = S.checked.has(b.itemId);
  const shake = ghost ? (Math.random() - .5) * 2.5 : 0;   // GDD: không vừa → rung nhẹ
  ctx.save();
  if (ghost) ctx.globalAlpha = .6;
  else if (held) { ctx.shadowColor = 'rgba(59,42,74,.4)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10; }
  ctx.translate(b.position.x + shake, b.position.y); ctx.rotate(b.angle);
  ctx.scale(b.artScale || 1, b.artScale || 1);
  ctx.lineJoin = 'round';
  drawArt(b);
  ctx.restore();

  if (held) { // GDD: vừa → viền xanh sáng, không vừa → đỏ
    ctx.save(); ctx.lineJoin = 'round';
    if (ghost) { ctx.strokeStyle = '#E5484D'; ctx.lineWidth = 3.5; ctx.setLineDash([7, 5]); }
    else { ctx.strokeStyle = '#3DDC84'; ctx.lineWidth = 3.5; ctx.shadowColor = '#3DDC84'; ctx.shadowBlur = 14; }
    strokeShape(b, 2);
    ctx.restore();
  } else if (ok) {
    ctx.save(); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(95,191,155,.9)'; strokeShape(b, 1); ctx.restore();
  }
  if (b.vibrating) {
    ctx.save(); ctx.strokeStyle = '#4A90D9'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    const j = (Math.random() - .5) * 3;
    for (const s of [-1, 1]) for (const r of [30, 38]) {
      ctx.beginPath(); ctx.arc(b.position.x + j, b.position.y, r, s > 0 ? -.5 : Math.PI - .5, s > 0 ? .5 : Math.PI + .5); ctx.stroke();
    }
    ctx.restore();
  }
}

/** Món đang chọn: viền nét đứt + nút xoay ở góc trên phải */
function drawSelection() {
  const b = S.selected;
  if (!b || !S.bodies.includes(b) || isHeld(b)) return;
  ctx.save();
  ctx.strokeStyle = '#E2637F'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineJoin = 'round';
  strokeShape(b, 3);
  ctx.setLineDash([]);
  const c = rotateButtonPos(b), R = rotButtonR(b);
  ctx.beginPath(); ctx.arc(c.x, c.y + R * .18, R, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(59,42,74,.22)'; ctx.fill();                        // bóng nút
  ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
  ctx.fillStyle = '#E2637F'; ctx.fill();
  ctx.lineWidth = Math.max(1.6, R * .18); ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
  // hai mũi tên đối nhau trên một vòng cung, kiểu nút xoay tự do
  ctx.save(); ctx.translate(c.x, c.y);
  const rr = R * .44, lw = Math.max(1.5, R * .2), t = R * .3;
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s0 of [0, Math.PI]) {
    ctx.beginPath(); ctx.arc(0, 0, rr, s0 + .42, s0 + Math.PI - .42); ctx.stroke();
    const a = s0 + Math.PI - .42;                       // đầu cung, gắn mũi tên
    const ex = Math.cos(a) * rr, ey = Math.sin(a) * rr;
    const tx = -Math.sin(a), ty = Math.cos(a);          // hướng tiếp tuyến
    const nx = Math.cos(a), ny = Math.sin(a);           // hướng bán kính
    ctx.beginPath();
    ctx.moveTo(ex + tx * -t * .1 + nx * t * .55, ey + ty * -t * .1 + ny * t * .55);
    ctx.lineTo(ex + tx * t, ey + ty * t);
    ctx.lineTo(ex + tx * -t * .1 - nx * t * .55, ey + ty * -t * .1 - ny * t * .55);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function drawPuffs(dt) {
  for (let i = S.puffs.length - 1; i >= 0; i--) {
    const p = S.puffs[i]; p.t += dt / 380;
    if (p.t >= 1) { S.puffs.splice(i, 1); continue; }
    ctx.save(); ctx.globalAlpha = 1 - p.t; ctx.strokeStyle = '#E2637F'; ctx.lineWidth = 4 * (1 - p.t) + 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 10 + p.t * 46, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3 + .4, r = 14 + p.t * 40;
      ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 3.5 * (1 - p.t), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function tickTimer(dt) {
  if (S.won || S.lost || !S.timerOn) return;
  S.timeLeft -= dt;
  if (S.timeLeft <= 0) { S.timeLeft = 0; S.lost = true; showLose(); }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(now - last, 33); last = now;
  const active = !S.won && !S.lost && !S.paused && S.engine;

  if (S.engine) {
    if (active) moveHeld(dt);
    if (active) { tickPhone(dt); tickRotation(dt); Engine.update(S.engine, dt); checkUnlock(); tickTimer(dt); }
    checkEject();
    updateChecked();
    updateClock();

    ctx.clearRect(0, 0, W, H);
    drawScene();

    // Lắc túi: chỉ hình chiếc túi rung, đồ bên trong nhảy theo lực vật lý
    const jig = active ? jiggleOffset(dt) : null;
    const withJiggle = draw => {
      if (!jig) return draw();
      ctx.save();
      ctx.translate(BAG.cx + jig.x, BAG.bottom + jig.y);
      ctx.rotate(jig.rot);
      ctx.translate(-BAG.cx, -BAG.bottom);
      draw();
      ctx.restore();
    };

    withJiggle(drawBag);
    const order = S.bodies.slice().sort((a, b) => (isHeld(a) ? 1 : isHeld(b) ? -1 : 0));
    for (const b of order) drawBody(b);
    drawStrings();
    withJiggle(drawBagFront);
    drawSelection();
    drawPuffs(dt);
  }
  requestAnimationFrame(frame);
}

export function startLoop() { last = performance.now(); requestAnimationFrame(frame); }
