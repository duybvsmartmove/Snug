// Tự chơi: dùng solver tìm chỗ cho từng món rồi lần lượt nhấc và đặt vào, như người chơi thật.
// Dùng để kiểm tra nhanh một level có xếp được không mà không phải ngồi kéo tay.
import Matter from 'matter-js';
import { S, BAG } from './state.js';
import { solve } from '../gen/solver.js';
import { bagZone } from './rules.js';
import { toast } from '../ui/hud.js';

const { Body, World } = Matter;
const wait = ms => new Promise(r => setTimeout(r, ms));

let running = false;
export const isAutoplaying = () => running;

/** Đưa món từ chỗ hiện tại tới đích theo đường cong, trong lúc đó món không va chạm với ai */
async function moveTo(body, tx, ty, targetAngle, ms = 320) {
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

  const sol = solve(S.LEVEL, { tries: 200 });
  const plan = sol.plan || [];
  if (!plan.length) { running = false; return toast('Không tìm được cách xếp nào', 2500); }

  toast(sol.solvable ? 'Tự chơi: máy xếp được hết' : `Tự chơi: máy chỉ xếp được ${sol.placedCount}/${sol.needCount}`, 2600);
  await wait(500);

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
    await moveTo(body, step.x, step.y, step.rotated ? Math.PI / 2 : 0);
    World.add(S.world, body);                          // thả xuống
    Body.setVelocity(body, { x: 0, y: 0 }); Body.setAngularVelocity(body, 0);
    await wait(170);                                   // chờ đồ ổn định trước khi xếp món tiếp
  }

  await wait(600);
  if (running) {
    const left = S.ITEMS.filter(d => !S.checked.has(d.id)).length;
    toast(left ? `Tự chơi xong · còn ${left} món chưa vào túi` : 'Tự chơi xong · vừa khít!', 3000);
  }
  running = false;
}

export function stopAutoplay() { running = false; }
