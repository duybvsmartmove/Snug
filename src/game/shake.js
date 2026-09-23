// Lắc điện thoại: đồ TRONG TÚI lắc theo tay người chơi, mọi thứ khác đứng yên.
//
// Đọc gia tốc ngang của máy (devicemotion). Máy giật sang phải thì đồ trong túi, theo quán
// tính, bị dồn sang trái so với túi: đặt lên mỗi món một lực NGƯỢC chiều gia tốc, tỉ lệ với
// độ mạnh của cú lắc. Lắc nhẹ thì đồ chỉ lắc lư, trượt vào khe hở bên cạnh; lắc mạnh thì
// thêm một chút lực nhấc cho đồ đang chèn nhau nới ra rồi rơi xuống khít hơn.
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
const TRAN = 16;             // m/s²: lắc mạnh hơn nữa cũng chỉ tính bằng chừng này
const DO_NHAY = .55;         // 1 = lực ngang đúng bằng gia tốc thật; nhỏ hơn cho đồ lắc lư êm
const NHAC_TU = 5;           // m/s²: từ mức này trở lên thì thêm lực nhấc cho đồ nới ra
const NHAC = .22;            // độ mạnh lực nhấc so với lực ngang
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

/** Lắc giả lập: gia tốc a (m/s², dương là giật sang phải) trong ms mili giây */
export function shakeImpulse(a, ms = 200) { giaLap = a; giaLapToi = performance.now() + ms; }

/** Gọi mỗi bước vật lý, trước Engine.update */
export function tickShake() {
  if (!S.world || S.won || S.lost || S.paused) return;
  let a = ax;
  if (giaLapToi > performance.now()) a = giaLap;
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
    // Quán tính: máy giật sang phải thì đồ dồn sang trái so với túi
    Body.applyForce(b, b.position, { x: -a * don * b.mass, y: -nhac * don * b.mass });
    co = true;
  }
  // tiếng sột soạt khi lắc mạnh, không dồn dập
  if (co && manh > 6 && performance.now() > tiengLuc) {
    tiengLuc = performance.now() + 450;
    sfx('jiggle', { gain: Math.min(.5, manh / 30), rate: .9 + Math.random() * .2 });
  }
}
