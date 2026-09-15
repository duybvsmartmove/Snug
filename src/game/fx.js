// Hiệu ứng nhìn thấy trên canvas: tia sáng khi món vừa khít, pháo giấy khi thắng,
// vòng sáng lan ra, rung màn hình. Tất cả chạy theo dt nên không phụ thuộc tốc độ máy.
import { W, H } from './state.js';
import { ctx } from './canvas.js';

const parts = [];      // hạt bay
const rings = [];      // vòng sáng lan ra
const floats = [];     // chữ bay lên (+1, +60s…)

const RND = (a, b) => a + Math.random() * (b - a);

/** Chùm tia sáng bắn ra từ một điểm: món vừa khít, mở được hộp bí ẩn */
export function sparkle(x, y, { n = 14, color = '#5FBF9B', speed = 1, life = 620 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + RND(-.25, .25), v = RND(.9, 2.3) * speed;
    parts.push({ x, y, vx: Math.cos(a) * v * 60, vy: Math.sin(a) * v * 60, g: 260,
      t: 0, life: life * RND(.7, 1.2), size: RND(2.2, 4.4), color, shape: 'dot' });
  }
}

/** Vòng sáng lan ra rồi mờ dần */
export function ring(x, y, { color = '#5FBF9B', r0 = 8, r1 = 58, life = 480, width = 4 } = {}) {
  rings.push({ x, y, r0, r1, t: 0, life, color, width });
}

/** Pháo giấy rơi từ mép trên: dùng cho màn thắng */
export function confetti(n = 80) {
  const cols = ['#E2637F', '#E2B04A', '#5FBF9B', '#7B4FD8', '#3D8BFF', '#FFFFFF'];
  for (let i = 0; i < n; i++) {
    parts.push({
      x: RND(0, W), y: RND(-H * .25, -8),
      vx: RND(-42, 42), vy: RND(70, 190), g: 90,
      t: 0, life: RND(1800, 3200),
      size: RND(4, 8.5), color: cols[(Math.random() * cols.length) | 0],
      shape: 'flake', rot: RND(0, Math.PI * 2), vr: RND(-5, 5), wob: RND(1.5, 3.4), phase: RND(0, 6.28),
    });
  }
}

/** Chữ nhỏ bay lên rồi tan: +60 giây, tên món bị bỏ… */
export function floatText(x, y, text, { color = '#3B2A4A', life = 900, size = 15 } = {}) {
  floats.push({ x, y, text, t: 0, life, color, size });
}

// ---------- rung màn hình ----------
let shakeUntil = 0;
export function shake(ms = 380) {
  shakeUntil = performance.now() + ms;
  const cv = document.getElementById('game');
  if (!cv) return;
  cv.classList.remove('shake');
  void cv.offsetWidth;                 // ép trình duyệt chạy lại animation
  cv.classList.add('shake');
  setTimeout(() => cv.classList.remove('shake'), ms);
}
export const isShaking = () => performance.now() < shakeUntil;

/** Xoá sạch mọi hiệu ứng: gọi khi dựng lại level */
export function clearFx() { parts.length = 0; rings.length = 0; floats.length = 0; }

export const fxCount = () => parts.length + rings.length + floats.length;

// ---------- vẽ ----------
export function drawFx(dt) {
  const s = dt / 1000;

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t += dt;
    if (p.t >= p.life) { parts.splice(i, 1); continue; }
    p.vy += p.g * s;
    p.x += p.vx * s; p.y += p.vy * s;
    if (p.shape === 'flake') p.rot += p.vr * s;
    const k = 1 - p.t / p.life;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.8);
    ctx.fillStyle = p.color;
    if (p.shape === 'flake') {
      // mảnh giấy lật qua lật lại khi rơi
      const flip = Math.abs(Math.cos(p.phase + p.t / 1000 * p.wob));
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size * flip / 2, p.size, Math.max(1, p.size * flip));
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dt;
    if (r.t >= r.life) { rings.splice(i, 1); continue; }
    const k = r.t / r.life;
    ctx.save();
    ctx.globalAlpha = (1 - k) * .95;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width * (1 - k) + .6;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t += dt;
    if (f.t >= f.life) { floats.splice(i, 1); continue; }
    const k = f.t / f.life;
    ctx.save();
    ctx.globalAlpha = 1 - k * k;
    ctx.translate(f.x, f.y - k * 34);
    ctx.scale(1 + (1 - Math.pow(1 - k, 3)) * .12, 1 + (1 - Math.pow(1 - k, 3)) * .12);
    ctx.font = `800 ${f.size}px Nunito, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.strokeText(f.text, 0, 0);
    ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0);
    ctx.restore();
  }
}
