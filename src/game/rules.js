// Luật của túi: đồ có nằm gọn trong lòng túi (polygon) không, ảo ảnh khi chồng lấn, đẩy đồ chòi mép ra, tính tiến độ.
import Matter from 'matter-js';
import { KEY_ID } from '../data/items.js';
import { S, BAG, PAD, W, TABLE_Y, FLOOR_Y, partsOf, isHeld } from './state.js';
import { pointInPolygonTolerant } from '../util/geom.js';
import { toast, renderList, showWin } from '../ui/hud.js';
import { sfx, sfxSeq, duckMusic } from '../ui/sfx.js';
import { sparkle, ring, confetti, shake, floatText } from './fx.js';
import { markDone, setSpot } from './progress.js';

const { Body, Bounds, Collision } = Matter;

// Dung sai khi kiểm tra đồ nằm trong lòng túi.
// Matter.js cho phép vật lún nhẹ vào tường (collision slop), nên đỉnh của món nằm sát đáy/thành
// thường vượt biên polygon vài phần trăm pixel. Không có dung sai thì món xếp đúng vẫn bị coi là không vừa.
const FIT_TOL = 3;

/** Mọi đỉnh của mọi part nằm trong polygon lòng túi (có dung sai) */
function allVerticesInside(body) {
  for (const p of partsOf(body)) {
    if (p.circleRadius) { // xấp xỉ hình tròn bằng 12 điểm trên biên
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        if (!pointInPolygonTolerant(p.position.x + Math.cos(a) * p.circleRadius, p.position.y + Math.sin(a) * p.circleRadius, BAG.poly, FIT_TOL)) return false;
      }
    } else for (const v of p.vertices) if (!pointInPolygonTolerant(v.x, v.y, BAG.poly, FIT_TOL)) return false;
  }
  return true;
}

/** inZone: đồ đang "dính" vào vùng túi. fullyInside: nằm gọn hẳn trong lòng túi. */
export function bagZone(body) {
  const bb = body.bounds;
  const inZone = bb.max.x > BAG.left - PAD && bb.min.x < BAG.right + PAD
    && bb.max.y > BAG.top - 14 && bb.min.y < BAG.bottom + PAD - 2;
  const fullyInside = inZone && bb.min.y >= BAG.top - FIT_TOL && allVerticesInside(body);
  return { inZone, fullyInside };
}

/** Đồ đang cầm có bị "ảo ảnh" không: chòi mép túi, hoặc chồng lên đồ khác / tường / block */
export function computeGhost(body, group = [body]) {
  const z = bagZone(body);
  if (z.inZone && !z.fullyInside) return true;
  const mine = partsOf(body);
  const others = S.bodies.filter(b => !group.includes(b)).flatMap(partsOf).concat(S.staticBodies);
  for (const a of mine) {
    for (const b of others) {
      if (!Bounds.overlaps(a.bounds, b.bounds)) continue;
      const c = Collision.collides(a, b);
      const isWall = b.label === 'wall' || b.label === 'block';
      if (c && c.collided && c.depth > (isWall ? 2.5 : 0.5)) return true;
    }
  }
  return false;
}

/** Tìm một chỗ trống trên khay để đặt đồ */
export function findFreeSpot(b, group = [b]) {
  const pad = group.length > 1 ? 46 : 0;   // cặp buộc dây cần chỗ rộng hơn
  const hx = (b.bounds.max.x - b.bounds.min.x) / 2 + pad, hy = (b.bounds.max.y - b.bounds.min.y) / 2 + pad;
  for (let t = 0; t < 40; t++) {
    Body.setPosition(b, {
      x: 20 + hx + Math.random() * Math.max(10, W - 40 - hx * 2),
      y: TABLE_Y + 10 + hy + Math.random() * Math.max(10, FLOOR_Y - TABLE_Y - 20 - hy * 2),
    });
    if (!computeGhost(b, group)) return;
  }
  Body.setPosition(b, { x: W / 2, y: TABLE_Y + 15 });
}

function ejectOne(b) {
  S.puffs.push({ x: b.position.x, y: b.position.y, t: 0 });
  sfx('eject'); shake(320);
  findFreeSpot(b);
  Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0);
  b.stuck = 0;
}

/** Đẩy đồ không vừa ra khay. Đồ buộc chung thì đẩy cả cặp, giữ nguyên khoảng cách. */
export function eject(b) {
  const pair = b.tether ? [b, b.tether.a === b ? b.tether.b : b.tether.a] : [b];
  if (pair.some(x => isHeld(x))) return;
  const d = pair.length > 1 ? Matter.Vector.sub(pair[1].position, pair[0].position) : null;
  ejectOne(pair[0]);
  if (d) {
    Body.setPosition(pair[1], Matter.Vector.add(pair[0].position, d));
    Body.setVelocity(pair[1], { x: 0, y: 0 }); Body.setAngularVelocity(pair[1], 0); pair[1].stuck = 0;
    S.puffs.push({ x: pair[1].position.x, y: pair[1].position.y, t: 0 });
    toast('Đồ buộc chung phải vào túi cùng nhau');
  } else toast('Không vừa! Đồ bị đẩy ra ngoài');
}

/** Đồ nằm yên mà vẫn chòi ra khỏi miệng túi → đẩy ra */
export function checkEject() {
  for (const b of S.bodies) {
    if (isHeld(b)) continue;
    const z = bagZone(b);
    if (z.inZone && !z.fullyInside && b.speed < .5 && b.angularSpeed < .05) { if (++b.stuck > 28) eject(b); }
    else b.stuck = 0;
  }
}

const fmt = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Cập nhật packing list + điều kiện thắng */
export function updateChecked() {
  let changed = false;
  for (const b of S.bodies) {
    if (b.itemId === KEY_ID) continue;
    const ok = bagZone(b).fullyInside && !b.locked && (b.speed < .9 || b.isStatic) && !isHeld(b);
    if (ok !== S.checked.has(b.itemId)) {
      if (ok) {
        S.checked.add(b.itemId);
        // vừa khít: tiếng chuông cao dần theo số món đã xếp, kèm vòng sáng và tia
        const n = S.checked.size;
        sfx('fit', { rate: 1 + Math.min(6, n - 1) * .045 });
        ring(b.position.x, b.position.y, { color: '#5FBF9B', r1: 46 });
        sparkle(b.position.x, b.position.y, { n: 10, color: '#8FE0C1', life: 520 });
      } else S.checked.delete(b.itemId);
      changed = true;
    }
  }
  for (const id of S.gone) if (!S.checked.has(id)) { S.checked.add(id); changed = true; }
  if (changed) renderList(false);

  if (S.checked.size === S.ITEMS.length && !S.drag && !S.lost) {
    if (++S.winFrames > 45 && !S.won) {
      S.won = true;
      const used = (S.LEVEL.timer || 0) - Math.ceil(S.timeLeft / 1000);
      if (S.map) {
        const lanDau = markDone(S.map.id, S.levelIdx);
        setSpot(S.map.id, Math.min(S.levelIdx + 1, S.map.levels.length - 1));
        // lần đầu qua được và còn level phía sau → báo có màn mới mở
        if (lanDau && S.levelIdx + 1 < S.map.levels.length) sfx('unlockLv', { delay: 1.15, gain: .9 });
      }
      confetti(90); sfx('win'); sfxSeq('star', 3, { step: .16, rate: 1, up: .14 }); duckMusic(true);
      floatText(210, 300, 'Vừa khít!', { color: '#5FBF9B', size: 26, life: 1200 });
      // Bảng thắng có lớp mờ phủ kín màn: hiện ngay thì che mất pháo giấy vừa bắn.
      // Chờ một nhịp cho người chơi nhìn thấy ăn mừng rồi bảng mới trượt vào.
      const txt = `Cả ${S.ITEMS.length} món đã nằm gọn trong túi · ${fmt(Math.max(0, used))}`;
      setTimeout(() => { if (S.won) showWin(txt); }, 700);
    }
  } else S.winFrames = 0;
}
