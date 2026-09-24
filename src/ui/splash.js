// Màn Splash lúc mở game, theo tinh thần Snug gốc: đồ đạc của chương đầu mưa từ trên cao
// xuống, va nhau và chất thành đống thật bằng vật lý, logo nằm giữa. Không có nút: hiện
// DUNG_LAU rồi tự sang trang chủ (trang chủ đã có nút Start); chạm vào đâu cũng bỏ qua sớm.
//
// Dùng một thế giới Matter RIÊNG, không đụng tới sân chơi: màn này tắt là thế giới bị bỏ đi.
// Đồ rơi một loạt đầu cho đầy đống rồi rơi lác đác mãi; món cũ nhất mờ dần biến mất để đống
// không cao quá logo.
// Ảnh và vùng va chạm là của bộ art đang chọn, nên cozy và casual tự ra đúng đồ của mình.
import Matter from 'matter-js';
import { ITEM_DEFS } from '../data/items.js';
import { makeItem } from '../game/physics.js';

const { Engine, World, Bodies, Body } = Matter;
const $ = id => document.getElementById(id);

const W = 420;                 // bề ngang logic, như sân chơi; chiều cao theo màn thật
const CO = .86;                // đồ ở splash nhỏ hơn trong game một chút cho đống gọn
const LOAT_DAU = 24;           // số món rơi dồn dập lúc mở
const NHIP_DAU = 95;           // mili giây giữa hai món trong loạt đầu
const NHIP_SAU = 1100;         // sau đó cứ chừng này rơi thêm một món
const TOI_DA = 28;             // quá số này thì món cũ nhất mờ đi nhường chỗ
const MO_DI = 450;             // thời gian mờ đi của một món
export const DUNG_LAU = 3000;  // Splash hiện chừng này rồi tự sang trang chủ

let run = null;                // { engine, bodies, raf, ... } khi màn đang chạy

/**
 * Mở app bình thường thì Splash hiện ngay từ khung đầu và tấm màn chuyển cảnh bị ẩn hẳn
 * (lớp splash-boot trên <html>, đặt trong index.html). Splash xong thì trả tấm màn về trạng
 * thái mở sẵn để các lần chuyển màn sau vẫn dùng được, không để nó hiện lại che Home.
 */
export function hetSplashBoot() {
  const veil = document.getElementById('veil');
  if (veil) { veil.classList.remove('boot'); veil.classList.add('off'); }
  document.documentElement.classList.remove('splash-boot');
}

/**
 * Mở màn Splash. Trả về Promise xong khi màn đã khép lại (hết giờ hoặc người chơi chạm).
 * Không có món nào có ảnh (content lỗi) thì bỏ qua luôn.
 *
 * `khiKhep` (tuỳ chọn) được gọi đúng lúc màn BẮT ĐẦU khép, trước quãng mờ dần 380ms —
 * để ai muốn che tấm màn chuyển cảnh lên thì che kịp trong lúc Splash còn đang mờ.
 * Chờ Promise trả về mới che thì Splash đã tan hẳn, sân trống lộ ra một nhịp.
 */
export function showSplash({ khiKhep } = {}) {
  // Món có ảnh sẵn lúc này (ít nhất là chương đầu); những món khác của bộ art đang nạp dở
  // sẽ được góp vào lúc rút, xem rutMon.
  const sanSang = () => ITEM_DEFS.filter(d => d.id > 0 && d.sprite?.ready);
  const el = $('splash'), cv = $('splashCv');
  if (!sanSang().length || !el) { hetSplashBoot(); if (el) el.classList.remove('show'); return Promise.resolve(); }
  // Rút món theo bộ đã xáo: dùng hết cả bộ mới xáo lại, nên không món nào rơi hai lần khi
  // còn món chưa rơi. Mỗi lần xáo lấy lại danh sách để món vừa nạp xong cũng được góp mặt.
  let tui = [];
  const rutMon = () => {
    if (!tui.length) { tui = sanSang(); for (let i = tui.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tui[i], tui[j]] = [tui[j], tui[i]]; } }
    return tui.pop();
  };
  const ctx = cv.getContext('2d');

  const engine = Engine.create({ positionIterations: 6, velocityIterations: 4 });
  engine.gravity.y = 1.05;
  const r = { engine, bodies: [], raf: 0, H: 760, k: 1, dpr: 1, t: 0, next: 0, spawned: 0, walls: [] };
  run = r;

  // khung giữ đống đồ: sàn đúng mép dưới màn, hai vách hai bên cao hơn cả màn
  function dungTuong() {
    if (r.walls.length) World.remove(engine.world, r.walls);
    const o = { isStatic: true, friction: .9, restitution: .05 };
    r.walls = [
      Bodies.rectangle(W / 2, r.H + 40, W * 2, 80, o),
      Bodies.rectangle(-40, r.H / 2 - 400, 80, r.H + 1200, o),
      Bodies.rectangle(W + 40, r.H / 2 - 400, 80, r.H + 1200, o),
    ];
    World.add(engine.world, r.walls);
  }
  function doCo() {
    const b = cv.getBoundingClientRect();
    if (!b.width) return;
    r.dpr = Math.min(window.devicePixelRatio || 1, 2);
    r.k = b.width / W; r.H = b.height / r.k;
    cv.width = Math.round(b.width * r.dpr); cv.height = Math.round(b.height * r.dpr);
    dungTuong();
  }
  r.onResize = doCo;
  window.addEventListener('resize', doCo);
  doCo();

  function tha() {
    const def = rutMon(); if (!def) return;
    // thả ngay trên mép trên màn, món vào khung hình trong vài khung đầu chứ không rơi mất nửa giây
    const b = makeItem(def, 40 + Math.random() * (W - 80), -40 - Math.random() * 60);
    Body.scale(b, CO, CO); b.artScale = CO;
    Body.setAngle(b, Math.random() * Math.PI * 2);
    Body.setVelocity(b, { x: (Math.random() - .5) * 2, y: 2 + Math.random() * 3 });
    Body.setAngularVelocity(b, (Math.random() - .5) * .16);
    b.sinhLuc = r.t;
    r.bodies.push(b); World.add(engine.world, b);
    r.spawned++;
    // đống đã đủ: món cũ nhất còn nguyên thì cho mờ đi
    const conNguyen = r.bodies.filter(x => x.moTu == null);
    if (conNguyen.length > TOI_DA) conNguyen[0].moTu = r.t;
  }

  function ve() {
    ctx.setTransform(r.dpr * r.k, 0, 0, r.dpr * r.k, 0, 0);
    ctx.clearRect(0, 0, W, r.H);
    for (const b of r.bodies) {
      const sp = b.def.sprite;
      if (!sp?.ready) continue;
      const a = b.moTu == null ? 1 : Math.max(0, 1 - (r.t - b.moTu) / MO_DI);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
      const o = b.origin || { x: 0, y: 0 };
      ctx.translate(o.x * b.artScale, o.y * b.artScale);   // bù độ lệch trọng tâm ↔ tâm ảnh, như render.js
      const s = b.artScale * (b.moTu == null ? 1 : .6 + .4 * a);
      ctx.scale(s, s);
      const w = sp.img.width / sp.ppu, h = sp.img.height / sp.ppu;
      ctx.drawImage(sp.img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  let truoc = performance.now();
  function khung(now) {
    if (run !== r) return;
    const dt = Math.min(34, now - truoc); truoc = now;
    r.t += dt;
    const nhip = r.spawned < LOAT_DAU ? NHIP_DAU : NHIP_SAU;
    if (r.t >= r.next) { tha(); r.next = r.t + nhip * (.7 + Math.random() * .6); }
    // bước vật lý đều 1/60 giây, dù màn hình 90 hay 120Hz
    r.du = (r.du || 0) + dt;
    while (r.du >= 1000 / 60) { Engine.update(engine, 1000 / 60); r.du -= 1000 / 60; }
    for (const b of r.bodies.slice()) {
      if (b.moTu != null && r.t - b.moTu > MO_DI) { World.remove(engine.world, b); r.bodies.splice(r.bodies.indexOf(b), 1); }
    }
    ve();
    // Đếm giờ từ lúc tấm màn mở game vừa mở ra, không phải từ lúc dựng: màn còn che thì
    // người chơi chưa thấy gì, tính cả quãng đó là Splash hiện chưa tới DUNG_LAU đã tắt.
    const veil = document.getElementById('veil');
    if (!r.batDau && (!veil || veil.classList.contains('off') || document.documentElement.classList.contains('splash-boot'))) { r.batDau = true; r.onStart?.(); }
    r.raf = requestAnimationFrame(khung);
  }
  r.raf = requestAnimationFrame(khung);

  el.classList.add('show');
  el.classList.remove('go');
  el.style.setProperty('--splash-ms', `${DUNG_LAU}ms`);   // thanh chạy khớp đúng thời gian hiện
  return new Promise(xong => {
    let dong = false, hen = 0;
    const khep = async () => {
      if (dong) return; dong = true;
      clearTimeout(hen);
      el.removeEventListener('pointerdown', khep);
      el.classList.remove('show');
      hetSplashBoot();
      // Gọi SAU hetSplashBoot: hàm đó vừa đặt tấm màn về trạng thái "mở" (lớp off), gọi trước
      // thì ai kéo màn che vào sẽ bị nó mở toang lại ngay lập tức.
      try { khiKhep?.(); } catch (e) { console.warn('splash khiKhep', e); }
      await new Promise(res => setTimeout(res, 380));   // chờ màn mờ hẳn rồi mới dọn
      window.removeEventListener('resize', doCo);
      cancelAnimationFrame(r.raf);
      World.clear(engine.world, false); Engine.clear(engine);
      run = null;
      xong();
    };
    r.onStart = () => { el.classList.add('go'); hen = setTimeout(khep, DUNG_LAU); };
    el.addEventListener('pointerdown', khep);
  });
}
