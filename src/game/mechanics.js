// Cơ chế đặc biệt: hộp bí ẩn + chìa khóa, đồ buộc dây, điện thoại rung, bóng xì hơi, lắc túi.
import Matter from 'matter-js';
import { KEY_ID } from '../data/items.js';
import { S, isHeld, partsOf } from './state.js';
import { replaceBody, removeBody, makeItem } from './physics.js';
import { bagZone, computeGhost, findFreeSpot } from './rules.js';
import { toast, repaintSlot } from '../ui/hud.js';
import { sfx } from '../ui/sfx.js';
import { sparkle, ring } from './fx.js';
import { ctx } from './canvas.js';
import { theme } from '../art/helpers.js';
import { t, itemName } from '../i18n.js';

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
  if (!S.unlockHinted && isHeld(box)) { S.unlockHinted = true; toast(t('unlockHint'), 2200); }
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
  const noiMo = { x: box.position.x, y: box.position.y };
  let khongVua = false;

  if (isHeld(box)) { // đang cầm: đổi hình ngay trong tay
    const d = S.drag;
    const nb = makeItem(real, box.position.x, box.position.y);
    Body.setAngle(nb, box.angle); nb.label = box.label; nb.realDef = real;
    S.bodies.splice(S.bodies.indexOf(box), 1, nb);
    // Thay cả trong nhóm đang cầm. Bỏ sót thì phép kiểm tra "có vừa không" vẫn đi soi
    // cái hộp cũ đã bị gỡ khỏi màn, người chơi nhìn viền xanh đỏ của một hình
    // không còn tồn tại, còn món thật thì chẳng ai xét.
    d.group = d.group.map(x => (x === box ? nb : x));
    d.rel = d.rel.map(r => (r.b === box ? { ...r, b: nb } : r));
    d.body = nb; d.offsetLocal = { x: 0, y: 0 }; d.lastValid = null;
  } else {
    const nb = replaceBody(box, real); nb.locked = false;
    // Món thật gần như luôn to hơn cái hộp. Thay hình xong phải xét lại chỗ đó có còn
    // chứa nổi không — không xét thì món vừa hiện ra nằm lồng vào những món xung quanh.
    if (computeGhost(nb)) {
      khongVua = true;
      findFreeSpot(nb);
      Body.setVelocity(nb, { x: 0, y: 0 }); Body.setAngularVelocity(nb, 0);
      nb.stuck = 0; nb.thaLuc = performance.now();
      S.puffs.push({ x: nb.position.x, y: nb.position.y, t: 0 });
    }
  }
  repaintSlot(real.id, real);
  sfx('unlock');
  ring(noiMo.x, noiMo.y, { color: '#E2B04A', r1: 64, life: 620, width: 5 });
  sparkle(noiMo.x, noiMo.y, { n: 18, color: '#FFD98A', speed: 1.4, life: 780 });
  toast(t(khongVua ? 'unlockedNoFit' : 'unlocked', { name: itemName(real) }), khongVua ? 2000 : 1600);
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

