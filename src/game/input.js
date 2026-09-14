// Điều khiển cảm ứng:
//  - Chạm nhẹ vào món (không kéo) = CHỌN, hiện nút xoay ở góc món.
//    Bấm nút xoay để xoay từng bước, giữ để xoay liên tục. Món vẫn nằm trong thế giới vật lý
//    nên khi xoay nó đẩy các món xung quanh như thật.
//    Chạm lại chính món đó, hoặc bắt đầu kéo, thì bỏ chọn.
//  - Chạm giữ rồi kéo = NHẤC LÊN: món rời khỏi thế giới vật lý, đi theo ngón tay.
//    Chồng lên món khác hoặc chòi mép túi thì thành ảo ảnh, thả ra sẽ bật ngược ra ngoài.
//  - Món buộc dây được nhấc theo cặp, coi như một khối, để dây không kéo lê món kia.
import Matter from 'matter-js';
import { S, partsOf } from './state.js';
import { canvas, toLogical } from './canvas.js';
import { computeGhost, findFreeSpot, bagZone } from './rules.js';
import { tetherSuspend, tetherRestore } from './mechanics.js';
import { toast, hideHint } from '../ui/hud.js';

const { Body, World, Query, Vector } = Matter;

const DRAG_PX = 7;                 // di chuyển quá ngưỡng này thì coi là kéo, không phải chạm chọn
const ROTATE_STEP = Math.PI / 2;   // mỗi lần bấm xoay 90°
const ROTATE_MS = 170;             // thời gian quay hết 90°, để vật lý kịp đẩy đồ xung quanh
/** Bán kính nút xoay: co theo món để không lấn át vật, nhưng vẫn đủ to để chạm trúng */
export function rotButtonR(body) {
  const [x0, y0, x1, y1] = body.def.box;
  return Math.max(8, Math.min(12, Math.min(x1 - x0, y1 - y0) * .3));
}

/**
 * Vị trí nút xoay: bám đúng GÓC TRÊN PHẢI của món và xoay theo món,
 * nhờ vậy nút luôn nằm ở một góc cố định của vật thay vì nhảy quanh khung bao.
 */
export function rotateButtonPos(body) {
  const [, y0, x1] = body.def.box;
  const c = Vector.rotate({ x: x1, y: y0 }, body.angle);
  return { x: body.position.x + c.x, y: body.position.y + c.y };
}

/** Các món được nhấc cùng nhau: món buộc dây đi theo cặp */
function groupOf(body) {
  if (!body.tether) return [body];
  const other = body.tether.a === body ? body.tether.b : body.tether.a;
  return other && other !== body ? [body, other] : [body];
}

export function pickUp(body, p) {
  S.selected = null;
  const group = groupOf(body);
  for (const b of group) {
    b.rotTarget = null;
    if (b.isStatic) Body.setStatic(b, false);
    Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0);
    World.remove(S.world, b);
  }
  if (body.tether) tetherSuspend(body.tether);
  S.drag = {
    body, group,
    // vị trí tương đối của các món còn lại so với món chính, tính theo hệ toạ độ của món chính
    rel: group.map(b => ({ b, d: Vector.rotate(Vector.sub(b.position, body.position), -body.angle), a: b.angle - body.angle })),
    target: p, startP: p,
    offsetLocal: Vector.rotate(Vector.sub(p, body.position), -body.angle),
    ghost: true, lastValid: null,
  };
  hideHint();
}

/** Đặt lại vị trí các món phụ trong nhóm theo món chính */
function syncGroup(d) {
  const b0 = d.body;
  for (const r of d.rel) {
    if (r.b === b0) continue;
    const pos = Vector.add(b0.position, Vector.rotate(r.d, b0.angle));
    Body.setPosition(r.b, pos);
    Body.setAngle(r.b, b0.angle + r.a);
  }
}

/** Gọi mỗi frame trước Engine.update */
export function moveHeld() {
  const d = S.drag; if (!d) return;
  const b = d.body;
  const want = Vector.sub(d.target, Vector.rotate(d.offsetLocal, b.angle));
  Body.setPosition(b, { x: b.position.x + (want.x - b.position.x) * .55, y: b.position.y + (want.y - b.position.y) * .55 });
  syncGroup(d);
  d.ghost = d.group.some(x => computeGhost(x, d.group));
  if (!d.ghost) d.lastValid = { x: b.position.x, y: b.position.y, angle: b.angle };
}

export function drop() {
  const d = S.drag; if (!d) return;
  const b = d.body;
  let bounce = false;
  if (d.ghost) {
    if (d.group.some(x => bagZone(x).inZone)) {          // không vừa trong túi → bật ngược ra ngoài
      findFreeSpot(b, d.group); syncGroup(d); bounce = true;
    } else if (d.lastValid) {
      Body.setPosition(b, d.lastValid); Body.setAngle(b, d.lastValid.angle); syncGroup(d);
    } else { findFreeSpot(b, d.group); syncGroup(d); }
  }
  for (const x of d.group) {
    Body.setVelocity(x, bounce ? { x: (Math.random() - .5) * 4, y: -6 } : { x: 0, y: 0 });
    Body.setAngularVelocity(x, 0);
    World.add(S.world, x);
  }
  if (b.tether) tetherRestore(b.tether);
  if (bounce) { S.puffs.push({ x: b.position.x, y: b.position.y, t: 0 }); toast('Không vừa!'); }
  S.drag = null;
}

// ---------- xoay bằng nút ----------
/** Bấm một cái: đặt mục tiêu quay thêm 90°. Quay dần trong ROTATE_MS để vật lý kịp đẩy đồ xung quanh. */
function rotateStep() {
  const b = S.selected; if (!b) return;
  b.rotTarget = (b.rotTarget ?? b.angle) + ROTATE_STEP;
}

/** Gọi mỗi frame: đưa món tới góc mục tiêu */
export function tickRotation(dt) {
  for (const b of S.bodies) {
    if (b.rotTarget == null) continue;
    const diff = b.rotTarget - b.angle;
    const step = (ROTATE_STEP / ROTATE_MS) * dt;
    if (Math.abs(diff) <= step) { Body.setAngle(b, b.rotTarget); b.rotTarget = null; }
    else Body.setAngle(b, b.angle + Math.sign(diff) * step);
    Body.setAngularVelocity(b, 0);
    if (b.tether) {                       // xoay một món thì món buộc cùng không bị giật theo
      const o = b.tether.a === b ? b.tether.b : b.tether.a;
      if (o) Body.setVelocity(o, { x: o.velocity.x * .4, y: o.velocity.y * .4 });
    }
  }
}

function hitRotateButton(p) {
  if (!S.selected) return false;
  const c = rotateButtonPos(S.selected);
  return Math.hypot(p.x - c.x, p.y - c.y) <= rotButtonR(S.selected) + 12;   // vùng chạm rộng hơn nút để dễ bấm
}

// ---------- pointer ----------
let pending = null;   // món vừa chạm xuống, chưa biết là chạm chọn hay kéo

function onDown(e) {
  if (S.won || S.lost || S.paused) return;
  canvas.setPointerCapture(e.pointerId);
  const p = toLogical(e);
  if (S.drag) return;

  if (hitRotateButton(p)) { rotateStep(); return; }   // bấm nút xoay: mỗi lần 90°

  const hit = Query.point(S.bodies.flatMap(partsOf), p);
  const body = hit.length ? hit[0].parent : null;

  if (!body) { S.selected = null; return; }
  pending = { body, startP: p, id: e.pointerId };
}

function onMove(e) {
  const p = toLogical(e);
  if (pending && e.pointerId === pending.id) {
    if (Vector.magnitude(Vector.sub(p, pending.startP)) > DRAG_PX) {   // đã kéo đủ xa → nhấc lên
      pickUp(pending.body, pending.startP);
      S.drag.id = e.pointerId; S.drag.target = p;
      pending = null;
    }
    return;
  }
  if (S.drag && e.pointerId === S.drag.id) S.drag.target = p;
}

function onUp(e) {
  if (pending && e.pointerId === pending.id) {          // chạm nhẹ → chọn hoặc bỏ chọn
    S.selected = S.selected === pending.body ? null : pending.body;
    pending = null;
    return;
  }
  if (S.drag && e.pointerId === S.drag.id) drop();
}

export function bindInput() {
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
}
