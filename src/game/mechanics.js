// Cơ chế đặc biệt: hộp bí ẩn + chìa khóa, đồ buộc dây, điện thoại rung, bóng xì hơi, lắc túi.
import Matter from 'matter-js';
import { KEY_ID } from '../data/items.js';
import { S, isHeld, partsOf } from './state.js';
import { replaceBody, removeBody, makeItem } from './physics.js';
import { bagZone } from './rules.js';
import { toast, repaintSlot } from '../ui/hud.js';
import { sfx } from '../ui/sfx.js';
import { sparkle, ring } from './fx.js';
import { ctx } from './canvas.js';
import { theme } from '../art/helpers.js';

const { Body, World, Vector, Constraint } = Matter;

// ---------- Đồ buộc chung ----------
export function createTethers() {
  S.tethers = [];
  const pairs = (S.LEVEL.items || []).filter(it => it.link).map(it => [it.id, it.link]);
  for (const [ia, ib] of pairs) {
    const a = S.bodies.find(b => b.label === ia), bb = S.bodies.find(b => b.label === ib);
    if (!a || !bb) continue;
    const c = Constraint.create({ bodyA: a, bodyB: bb, length: 64, stiffness: .035, damping: .06 });
    World.add(S.world, c);
    const t = { c, a, b: bb };
    a.tether = bb.tether = t;
    S.tethers.push(t);
  }
}
/** Khi nhấc cặp buộc dây lên: tạm gỡ dây khỏi thế giới vật lý (cả hai món đều đang trên tay) */
export function tetherSuspend(t) {
  if (t.suspended) return;
  World.remove(S.world, t.c);
  t.suspended = true;
}
export function tetherRestore(t) {
  if (!t.suspended) return;
  World.add(S.world, t.c);
  t.suspended = false;
}

export function drawStrings() {
  for (const t of S.tethers) {
    const pa = t.a.position, pb = t.b.position;
    const d = Vector.magnitude(Vector.sub(pb, pa)), sag = Math.max(0, t.c.length - d) * .7 + 6;
    ctx.save(); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.quadraticCurveTo((pa.x + pb.x) / 2, (pa.y + pb.y) / 2 + sag, pb.x, pb.y);
    ctx.lineWidth = 4.5; ctx.strokeStyle = theme.ink; ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = S.LEVEL.string || '#E2637F'; ctx.stroke();
    for (const q of [pa, pb]) {
      ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = S.LEVEL.string || '#E2637F'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------- Hộp bí ẩn + chìa khóa (GDD: chìa nằm sẵn trong túi, kéo hộp chạm chìa) ----------
export function checkUnlock() {
  const box = S.bodies.find(b => b.locked), key = S.bodies.find(b => b.itemId === KEY_ID);
  if (!box || !key || isHeld(key)) return;
  if (!S.unlockHinted && isHeld(box)) { S.unlockHinted = true; toast('Kéo hộp bí ẩn chạm vào chìa khóa trong túi', 2200); }
  let hit = false;
  for (const a of partsOf(box)) for (const k of partsOf(key)) {
    if (!Matter.Bounds.overlaps(a.bounds, k.bounds)) continue;
    const c = Matter.Collision.collides(a, k);
    if (c && c.collided) { hit = true; break; }
  }
  if (!hit) return;
  S.puffs.push({ x: box.position.x, y: box.position.y, t: 0 }, { x: key.position.x, y: key.position.y, t: 0 });
  removeBody(key);
  const real = box.realDef;
  if (isHeld(box)) { // đang cầm: đổi hình ngay trong tay
    const d = S.drag;
    const nb = makeItem(real, box.position.x, box.position.y);
    Body.setAngle(nb, box.angle); nb.label = box.label; nb.realDef = real;
    S.bodies.splice(S.bodies.indexOf(box), 1, nb);
    d.body = nb; d.offsetLocal = { x: 0, y: 0 }; d.lastValid = null;
  } else {
    const nb = replaceBody(box, real); nb.locked = false;
  }
  repaintSlot(real.id, real);
  sfx('unlock');
  ring(box.position.x, box.position.y, { color: '#E2B04A', r1: 64, life: 620, width: 5 });
  sparkle(box.position.x, box.position.y, { n: 18, color: '#FFD98A', speed: 1.4, life: 780 });
  toast(`Mở khóa: ${real.name}!`, 1600);
}

// ---------- Điện thoại rung ----------
export function tickPhone(dt) {
  const ph = S.bodies.find(b => b.def.slug === 'phone');
  if (!ph || isHeld(ph)) return;
  ph.vibrating = false;
  if (!bagZone(ph).fullyInside) { ph.vibClock = 0; return; }
  ph.vibClock = (ph.vibClock || 0) + dt;
  if (ph.vibClock % 5200 < 900) {
    ph.vibrating = true;
    Body.applyForce(ph, ph.position, { x: (Math.random() - .5) * .006 * ph.mass, y: (Math.random() - .6) * .006 * ph.mass });
    Body.setAngularVelocity(ph, ph.angularVelocity + (Math.random() - .5) * .12);
  }
}

// ---------- Lắc túi ----------
/**
 * Lắc túi: đẩy đồ bên trong nhảy lên cho lèn khít hơn, và rung RIÊNG hình cái túi.
 * Không rung cả màn hình — chỉ chiếc túi lắc, giống như cầm túi rồi giằng vài cái.
 */
export function jiggle() {
  if (S.won || S.lost) return;
  S.jiggle = { t: 0, dur: 420 };          // render.js đọc mốc này để rung hình túi
  for (const b of S.bodies) {
    if (isHeld(b)) continue;
    const z = bagZone(b);
    if (!z.inZone) continue;              // đồ ngoài túi không bị ảnh hưởng
    const k = z.fullyInside ? 1 : .5;
    Body.applyForce(b, b.position, {
      x: (Math.random() - .5) * .013 * b.mass * k,
      y: -(0.011 + Math.random() * .013) * b.mass * k,
    });
    Body.setAngularVelocity(b, b.angularVelocity + (Math.random() - .5) * .28 * k);
  }
}

/** Độ lệch của hình túi trong lúc lắc: dao động tắt dần */
export function jiggleOffset(dt) {
  const j = S.jiggle;
  if (!j) return null;
  j.t += dt;
  if (j.t >= j.dur) { S.jiggle = null; return null; }
  const p = j.t / j.dur, fade = 1 - p;
  return {
    x: Math.sin(p * Math.PI * 7) * 7 * fade,
    y: Math.sin(p * Math.PI * 9 + 1) * 3.5 * fade,
    rot: Math.sin(p * Math.PI * 6) * .035 * fade,
  };
}
