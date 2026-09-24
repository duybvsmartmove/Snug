// Lắc điện thoại: đồ TRONG TÚI lắc theo tay người chơi, mọi thứ khác đứng yên.
//
// Đọc gia tốc ngang của máy (devicemotion). Máy giật sang phải thì đồ trong túi, theo quán
// tính, bị dồn sang trái so với túi: đặt lên mỗi món một lực NGƯỢC chiều gia tốc, tỉ lệ với
// độ mạnh của cú lắc. Lắc nhẹ thì đồ chỉ lắc lư, trượt vào khe hở bên cạnh; lắc mạnh thì
// thêm một chút lực nhấc cho đồ đang chèn nhau nới ra rồi rơi xuống khít hơn.
//
// Chỉ đẩy ngang thì không đủ: đồ nằm chồng lên nhau ghì bằng ma sát tĩnh ~0,8 trọng lực, cú lắc
// thật lại ngắn (vài chục mili giây) và đổi chiều liên tục, nên đo trên máy thật đồ đứng im.
// Ngoài đời lắc túi thì đồ nảy khẽ, lúc lơ lửng không còn bị ghì. Làm giống vậy: trong lúc lắc
// hạ tạm ma sát của đồ trong túi và rung dọc rất nhẹ, thôi lắc một nhịp thì trả ma sát như cũ.
// Túi, đồ trên sàn, món đang cầm và món đang đóng băng không bị ảnh hưởng.
//
// iOS chỉ cho đọc cảm biến sau khi người chơi đồng ý, và chỉ hỏi được trong một lần chạm:
// lần chạm đầu tiên vào game sẽ xin quyền. Không có cảm biến (máy tính) thì dùng phím ← →
// để thử, và Creative Tool / console gọi shakeImpulse() được.
import Matter from 'matter-js';
import { S, isHeld, daVao } from './state.js';
import { bagZone } from './rules.js';
import { sfx } from '../ui/sfx.js';

const { Body } = Matter;

const G = 9.81;              // m/s², để đổi gia tốc thật sang đơn vị trọng lực của game
const VUNG_CHET = .7;        // m/s²: tay cầm run nhẹ dưới mức này thì bỏ qua
const TRAN = 14;             // m/s²: lắc mạnh hơn nữa cũng chỉ tính bằng chừng này
// Khuếch đại cú lắc: theo tỉ lệ vật lý của game chiếc túi to cỡ 1,6 m ngoài đời, lắc tay thật
// chỉ làm đồ nhích chưa tới 1 cm, mắt không thấy. Nhân lên cho đồ lắc lư rõ mà không văng.
const DO_NHAY = 4.5;
const NHAC_TU = 5;           // m/s²: từ mức này trở lên thì thêm lực nhấc cho đồ nới ra
const NHAC = .22;            // độ mạnh lực nhấc so với lực ngang
const RUNG = .35;            // rung dọc ngẫu nhiên, theo phần của lực ngang
const MA_SAT_KHI_LAC = .15;  // ma sát còn lại khi đang lắc, theo phần ma sát gốc
const GIU_NOI = 280;         // thôi lắc chừng này mili giây thì trả ma sát như cũ
const LOC = .8;              // hệ số lọc bỏ trọng lực khi máy chỉ báo gia tốc kèm trọng lực

let ax = 0;                  // gia tốc ngang đã lọc, m/s², dương = máy giật sang phải
let trongLuc = 0;            // thành phần trọng lực trên trục ngang (khi phải tự lọc)
let giaLap = 0, giaLapToi = 0;   // lắc giả lập (phím, Creative Tool)
let tiengLuc = 0;
let batDau = false;

function onMotion(e) {
  const a = e.acceleration;
  if (a && a.x != null) { ax = a.x; return; }
  // Máy chỉ có gia tốc kèm trọng lực: lọc thông thấp lấy trọng lực rồi trừ đi
  const g = e.accelerationIncludingGravity;
  if (!g || g.x == null) return;
  trongLuc = LOC * trongLuc + (1 - LOC) * g.x;
  ax = g.x - trongLuc;
}

/** Bật cảm biến. Gọi một lần lúc khởi động game. */
export function bindShake() {
  if (batDau) return; batDau = true;
  const lang = () => window.addEventListener('devicemotion', onMotion);
  const DM = window.DeviceMotionEvent;
  if (DM && typeof DM.requestPermission === 'function') {
    // iOS 13+: phải xin quyền trong một lần chạm của người chơi
    const xin = () => DM.requestPermission().then(r => { if (r === 'granted') lang(); }).catch(() => {});
    window.addEventListener('pointerdown', xin, { once: true, capture: true });
  } else if (DM) lang();

  // Máy tính: giữ phím ← hoặc → để lắc thử
  window.addEventListener('keydown', e => {
    if (e.target?.matches?.('input,select,textarea')) return;
    if (e.key === 'ArrowLeft') shakeImpulse(-7, 180);
    if (e.key === 'ArrowRight') shakeImpulse(7, 180);
  });
}

/**
 * Mách người chơi một lần trên máy có cảm biến: lắc máy là đồ trong túi xê dịch.
 * Nhớ trong máy để không nhắc lại mỗi màn.
 */
export function goiYLacMotLan(toast, text) {
  const KEY = 'snug.shakeHint.v1';
  if (!('ontouchstart' in window) || !window.DeviceMotionEvent) return;
  try { if (localStorage.getItem(KEY)) return; localStorage.setItem(KEY, '1'); } catch { return; }
  setTimeout(() => toast(text, 3200), 1200);
}

/**
 * Túi lắc theo tay: hình túi lệch ngược chiều gia tốc (quán tính, như đồ bên trong) và nghiêng
 * nhẹ, bám theo bằng lò xo có giảm chấn nên lắc nhanh hay chậm đều ra nhịp đúng. Chỉ là hình
 * vẽ, thành túi vật lý đứng yên; lệch tối đa vài đơn vị nên không thấy đồ hở ra khỏi thành.
 */
const tui = { x: 0, v: 0 };
export function lacTui(dt = 16) {
  let a = ax;
  if (giaLapToi > performance.now()) a = giaLap;
  if (Math.abs(a) < VUNG_CHET) a = 0;
  const muc = Math.max(-1, Math.min(1, -a / TRAN)) * 12;          // đích: tối đa 12 đơn vị
  const k = .12, c = .28;                                          // độ cứng, giảm chấn
  tui.v += (muc - tui.x) * k - tui.v * c;
  tui.x += tui.v * Math.min(2, dt / 16);
  return { x: tui.x, rot: tui.x * .0035 };
}

/** Lắc giả lập: gia tốc a (m/s², dương là giật sang phải) trong ms mili giây */
export function shakeImpulse(a, ms = 200) { giaLap = a; giaLapToi = performance.now() + ms; }

/** Gọi mỗi bước vật lý, trước Engine.update */
/** Trả ma sát gốc cho món đã thôi bị lắc một lúc */
function traMaSat(now, tatCa = false) {
  for (const b of S.bodies) {
    if (!b.maSatGoc || (!tatCa && now < b.noiToi)) continue;
    b.friction = b.maSatGoc[0]; b.frictionStatic = b.maSatGoc[1];
    b.maSatGoc = null;
  }
}

export function tickShake() {
  if (!S.world) return;
  const now = performance.now();
  if (S.won || S.lost || S.paused) { traMaSat(now, true); return; }
  traMaSat(now);
  let a = ax;
  if (giaLapToi > now) a = giaLap;
  if (Math.abs(a) < VUNG_CHET) return;
  a = Math.max(-TRAN, Math.min(TRAN, a));

  // Trọng lực của game (gravity.y × scale trên mỗi đơn vị khối lượng) ứng với 9,81 m/s² ngoài đời
  const g = S.engine.gravity, don = g.y * g.scale * DO_NHAY / G;
  const manh = Math.abs(a);
  const nhac = manh >= NHAC_TU ? (manh - NHAC_TU) * NHAC : 0;
  let co = false;
  for (const b of S.bodies) {
    if (!daVao(b) || b.isStatic || isHeld(b)) continue;
    if (!bagZone(b).inZone) continue;          // chỉ đồ trong túi, đồ trên sàn đứng yên
    // Nới ma sát trong lúc lắc (nhớ giá trị gốc để trả lại)
    if (!b.maSatGoc) b.maSatGoc = [b.friction, b.frictionStatic];
    b.friction = b.maSatGoc[0] * MA_SAT_KHI_LAC; b.frictionStatic = b.maSatGoc[1] * MA_SAT_KHI_LAC;
    b.noiToi = now + GIU_NOI;
    // Quán tính: máy giật sang phải thì đồ dồn sang trái so với túi; thêm rung dọc khẽ
    const rung = (Math.random() - .5) * 2 * RUNG * manh;
    Body.applyForce(b, b.position, { x: -a * don * b.mass, y: -(nhac + Math.max(0, rung)) * don * b.mass });
    co = true;
  }
  // tiếng sột soạt khi lắc mạnh, không dồn dập
  if (co && manh > 6 && now > tiengLuc) {
    tiengLuc = now + 450;
    sfx('jiggle', { gain: Math.min(.5, manh / 30), rate: .9 + Math.random() * .2 });
  }
}
