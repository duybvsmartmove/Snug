// Tự chơi: dùng solver tìm chỗ cho từng món rồi lần lượt nhấc và đặt vào, như người chơi thật.
// Dùng để kiểm tra nhanh một level có xếp được không mà không phải ngồi kéo tay.
import Matter from 'matter-js';
import { S, BAG } from './state.js';
import { KEY_ID } from '../data/items.js';
import { solve } from '../gen/solver.js';
import { bagZone } from './rules.js';
import { toast } from '../ui/hud.js';

const { Body, World } = Matter;
const wait = ms => new Promise(r => setTimeout(r, ms));

let running = false;
export const isAutoplaying = () => running;

// Nhịp của máy tự chơi, tính bằng mili giây.
// "nghi" là quãng chờ cho món vừa thả lắng xuống trước khi đặt món tiếp: rút quá tay
// thì món sau đè lên món trước lúc nó còn đang xê dịch, máy xếp được ít đi.
const NHIP = { moDau: 300, bay: 210, nghi: 110, ketThuc: 420 };

/** Đưa món từ chỗ hiện tại tới đích theo đường cong, trong lúc đó món không va chạm với ai */
async function moveTo(body, tx, ty, targetAngle, ms = NHIP.bay) {
  const sx = body.position.x, sy = body.position.y, sa = body.angle;
  const t0 = performance.now();
  for (;;) {
    const k = Math.min(1, (performance.now() - t0) / ms);
    const e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;         // ease in-out
    Body.setPosition(body, { x: sx + (tx - sx) * e, y: sy + (ty - sy) * e - Math.sin(e * Math.PI) * 26 });
    Body.setAngle(body, sa + (targetAngle - sa) * e);
    if (k >= 1) break;
    await wait(16);
    if (!running) return;
  }
}

/** Chạy tự chơi cho level đang mở */
export async function autoplay() {
  if (running || S.won || S.lost) return;
  running = true;
  S.selected = null; S.drag = null;

  // Đầu màn đồ vào sân lần lượt. Bấm tự chơi ngay lúc đó thì món chưa tới lượt vẫn bị
  // máy nhấc đi đặt, mà nó chưa được vẽ nên nhìn như biến mất. Cho vào sân hết trước đã.
  for (const b of S.bodies) if (b.chuaVao) { b.chuaVao = false; World.add(S.world, b); }

  const sol = solve(S.LEVEL, { tries: 300 });   // chỉ ~50ms, đáng để lấy cách xếp gọn nhất
  const plan = sol.plan || [];
  if (!plan.length) { running = false; return toast('Không tìm được cách xếp nào', 2500); }

  toast(sol.solvable ? 'Tự chơi: máy xếp được hết' : `Tự chơi: máy chỉ xếp được ${sol.placedCount}/${sol.needCount}`, 2600);
  await wait(NHIP.moDau);

  for (const step of plan) {
    if (!running) break;
    const body = S.bodies.find(b => b.itemId === step.id);
    if (!body) continue;

    // Món buộc dây đi theo cặp, xếp tay khó mô phỏng — bỏ qua, để người chơi tự làm
    if (body.tether) continue;

    // Bỏ qua nếu solver trả vị trí lạc ra ngoài lòng túi
    if (step.x < BAG.left - 40 || step.x > BAG.right + 40 || step.y < BAG.top - 40 || step.y > BAG.bottom + 40) continue;

    World.remove(S.world, body);                       // nhấc lên: tạm rời khỏi thế giới vật lý
    Body.setVelocity(body, { x: 0, y: 0 }); Body.setAngularVelocity(body, 0);
    await moveTo(body, step.x, step.y, step.angle || 0);
    World.add(S.world, body);                          // thả xuống
    Body.setVelocity(body, { x: 0, y: 0 }); Body.setAngularVelocity(body, 0);
    await wait(NHIP.nghi);                             // chờ đồ ổn định trước khi xếp món tiếp
  }

  // Xếp một lượt xong vẫn thường sót vài món: vật lý làm đống đồ xê dịch so với bản vẽ
  // của máy xếp. Quay lại nhặt những món chưa vào, tính lại chỗ dựa trên đống đồ ĐANG
  // nằm thật trong túi rồi đặt lại — đúng cách người chơi làm khi thấy còn thừa đồ.
  for (let vong = 0; vong < 2 && running; vong++) {
    await wait(NHIP.nghi * 2);
    const sot = S.bodies.filter(b => !b.chuaVao && !b.tether && b.itemId !== KEY_ID
      && !S.checked.has(b.itemId) && !S.gone.has(b.itemId));
    if (!sot.length) break;
    if (!await xepLai(sot)) break;
  }

  await wait(NHIP.ketThuc);
  if (running) {
    const left = S.ITEMS.filter(d => !S.checked.has(d.id)).length;
    toast(left ? `Tự chơi xong · còn ${left} món chưa vào túi` : 'Tự chơi xong · vừa khít!', 3000);
  }
  running = false;
}

/**
 * Tính lại chỗ cho những món còn sót, lấy đống đồ đang nằm trong túi làm vật cản.
 * Trả về true nếu có đặt được thêm món nào.
 */
async function xepLai(sot) {
  const c = S.LEVEL?.container; if (!c) return false;
  const cx = c.cx ?? 210, bottom = c.bottom ?? 404;
  const sotId = new Set(sot.map(b => b.itemId));

  // Món đã nằm gọn trong túi → khai là "đặt sẵn" để máy xếp coi là vật cản,
  // đúng hình và đúng góc nó đang nằm.
  const daVao = S.bodies.filter(b => !b.chuaVao && !sotId.has(b.itemId) && S.checked.has(b.itemId));
  const tam = {
    container: c,
    items: [
      ...daVao.map(b => ({ id: b.itemId, inBag: true, angle: b.angle, scale: b.levelScale,
        x: b.position.x - cx, y: b.position.y - bottom })),
      ...sot.map(b => ({ id: b.itemId, scale: b.levelScale })),
    ],
  };

  const sol = solve(tam, { tries: 300 });
  let datDuoc = 0;
  for (const step of sol.plan || []) {
    if (!running) break;
    const body = sot.find(b => b.itemId === step.id); if (!body) continue;
    if (step.x < BAG.left - 40 || step.x > BAG.right + 40 || step.y < BAG.top - 40 || step.y > BAG.bottom + 40) continue;
    World.remove(S.world, body);
    Body.setVelocity(body, { x: 0, y: 0 }); Body.setAngularVelocity(body, 0);
    await moveTo(body, step.x, step.y, step.angle || 0);
    World.add(S.world, body);
    Body.setVelocity(body, { x: 0, y: 0 }); Body.setAngularVelocity(body, 0);
    await wait(NHIP.nghi);
    datDuoc++;
  }
  return datDuoc > 0;
}

export function stopAutoplay() { running = false; }
