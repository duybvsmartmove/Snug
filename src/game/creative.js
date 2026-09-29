// Cầu nối với Creative Tool (creative.html). Game chạy trong iframe với ?creative=1,
// tool điều khiển bằng postMessage và nhận trạng thái đều đặn để vẽ thanh công cụ.
//
// Ở chế độ này game vẫn là game thật: HUD, bảng thắng thua, nhạc… không khác gì.
// Chỉ khác: không ghi tiến độ (progress.js), mọi màn đều mở, máy tự chơi không hiện toast.
//
//   tool → game
//     play {chapter, index}        vào chơi một level
//     screen {name:'home'|'map'}   về trang chủ / mở bản đồ
//     restart                      chơi lại màn đang mở
//     auto {mode:'full'|'step'}    máy chơi một mạch / xếp một món rồi chờ
//     autostop                     dừng máy
//     autoboost {on}               máy được dùng booster khi hết chỗ (mặc định không)
//     human {on}                   máy chơi kiểu người: kéo thả thật, thả cho rơi, có nhịp nghĩ
//     audio {sfx, music}           bật tắt tiếng hiệu ứng / nhạc nền
//     speed {play, time}           nhịp máy chơi · tốc độ thời gian game (0.25–3)
//     hud {hide:{timer,dock,title,pause}}
//     timer {on}                   đếm giờ hay đóng băng
//     boosts {n}                   ép số lượt booster, null = theo level
//     finger {on}                  ngón tay giả: khi máy chơi, và thay con trỏ chuột khi tự kéo
//     lang {lang}                  đổi ngôn ngữ
//     shake {dx, dy}               một cú lắc, (dx,dy) là hướng đồ bị hất: ←(-1,0) ↑(0,-1)…
//     shakeburst {truc}            một tràng lắc qua lại như tay người: 'x' | 'y' | 'cheo'
//   game → tool
//     ready                        đã nạp xong, nhận lệnh được
//     status {...}                 mỗi 200ms: màn đang mở, thắng/thua, máy đang làm gì, màu nền
import { S, W, H } from './state.js';
import { autoplay, autoStep, stopAutoplay, autoState, autoMode, setPlaySpeed, setAutoQuiet, playSpeed, setAutoBoosters, autoBoosters, isAutoplaying, setAutoHuman, autoHuman } from './autoplay.js';
import { setSfxOn, setMusicOn, isSfxOn, isMusicOn, initAudio } from '../ui/sfx.js';
import { setBoostOverride, resetBoosts } from './boosters.js';
import { restart } from './level.js';
import { setLang, getLang } from '../i18n.js';
import { lacHuong, lacQuaLai } from './shake.js';
import { IMAGE_SCENES } from '../art/scene-registry.js';
import { artUrl } from '../content/loader.js';
import { currentScreen } from '../ui/home.js';

export const isCreative = new URLSearchParams(location.search).get('creative') === '1';
const HUD_PARTS = ['timer', 'dock', 'title', 'pause'];
const kep = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 1));

export function initCreative({ startLevel, vaoNgay, choiSplash, goHome, showMap, chapterById }) {
  if (!isCreative) return;
  setAutoQuiet(true);
  tayChuot.lap();
  const phone = document.getElementById('phone');
  const post = msg => window.parent.postMessage(msg, '*');

  window.addEventListener('message', async e => {
    const m = e.data || {};
    try {
      switch (m.type) {
        case 'play': {
          const ch = chapterById(m.chapter); if (!ch) return;
          stopAutoplay();
          await vaoNgay(ch, m.index | 0);   // thẳng vào màn chơi, không lộ trang chủ hay tấm màn
          break;
        }
        case 'splash': {
          const ch = chapterById(m.chapter); if (!ch) return;
          await choiSplash(ch, m.index | 0, m.level || null, { logo: m.logo !== false });
          break;
        }
        case 'screen':
          stopAutoplay();
          await goHome();
          if (m.name === 'map') showMap();
          break;
        case 'restart': stopAutoplay(); if (S.LEVEL) restart(); break;
        case 'auto': m.mode === 'step' ? autoStep() : autoplay({ mode: 'full' }); break;
        case 'autostop': stopAutoplay(); break;
        case 'autoboost': setAutoBoosters(!!m.on); break;
        case 'human': setAutoHuman(!!m.on); break;
        case 'audio':   // tiếng hiệu ứng và nhạc nền của game, bật tắt từ thanh công cụ Creative
          await initAudio();
          if (m.sfx != null && !!m.sfx !== isSfxOn()) setSfxOn(!!m.sfx);
          if (m.music != null && !!m.music !== isMusicOn()) setMusicOn(!!m.music);
          break;
        case 'speed':
          if (m.play != null) setPlaySpeed(kep(m.play, .1, 4));
          if (m.time != null) S.timeScale = kep(m.time, .1, 4);
          break;
        case 'hud': for (const k of HUD_PARTS) phone.classList.toggle('hide-' + k, !!m.hide?.[k]); break;
        case 'timer': S.timerOn = !!m.on; break;
        case 'boosts': setBoostOverride(m.n); if (S.LEVEL) resetBoosts(); break;
        case 'finger': S.showFinger = !!m.on; if (!m.on) S.finger = null; tayChuot.bat(S.showFinger); break;
        case 'lang': setLang(m.lang); break;
        case 'shake': lacHuong(Math.sign(m.dx || 0), Math.sign(m.dy || 0)); break;
        case 'shakeburst': lacQuaLai(['x', 'y', 'cheo'].includes(m.truc) ? m.truc : 'x'); break;
      }
    } catch (err) { console.error('creative:', err); }
  });

  // Phím tắt của tool bấm lúc iframe đang giữ focus thì chuyển ra ngoài; tool lo phần còn lại
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Phím mũi tên game tự lắc túi (shake.js); chuyển ra ngoài nữa là tool lắc thêm lần hai
    if (e.key.startsWith('Arrow')) return;
    post({ type: 'key', key: e.key });
  });

  // Trạng thái gửi đều: rẻ, và tool không phải đoán lúc nào có gì đổi
  setInterval(() => post(status()), 200);
  post({ type: 'ready' });
}

/** Màu nền và ảnh bối cảnh của màn đang mở, để tool tô phần khung thừa ở tỉ lệ 1:1, 4:5 */
function scene() {
  const id = Number(S.LEVEL?.background ?? 1);
  const def = IMAGE_SCENES[id]; if (!def) return null;
  const src = def.layers?.find(l => l.src)?.src;
  return { fill: def.fill || '#F2EAD2', bg: src ? new URL(artUrl(src), location.href).href : null };
}

function status() {
  const scr = currentScreen();
  return {
    type: 'status',
    screen: scr || (S.LEVEL ? 'level' : 'none'),
    chapter: S.mapId, index: S.levelIdx, levelId: S.LEVEL?.id || null,
    won: S.won, lost: S.lost, paused: S.paused, timerOn: S.timerOn,
    items: S.ITEMS.length, left: Math.max(0, S.ITEMS.length - S.checked.size),
    auto: autoState(), autoMode: autoMode(), autoBoost: autoBoosters(), playSpeed, timeScale: S.timeScale,
    finger: S.showFinger, lang: getLang(), human: autoHuman(), sfx: isSfxOn(), music: isMusicOn(),
    scene: scene(),
  };
}

/**
 * Bàn tay thay con trỏ chuột khi tự chơi bằng tay trong Creative Tool.
 *
 * Quay video trên máy tính mà thấy con trỏ chuột là lộ ngay không phải người chơi điện
 * thoại. Bật "👆 Tay" thì con trỏ thật bị ẩn trong khung game, thay bằng đúng bàn tay mà
 * máy tự chơi dùng: đầu ngón đặt đúng chỗ chuột, ấn xuống thì bàn tay nhún nhẹ.
 *
 * Làm bằng một lớp nổi trên cùng chứ không vẽ lên canvas như bàn tay của máy: người chơi
 * còn bấm booster, bấm bảng thắng, mà mấy thứ đó là HTML nằm đè lên canvas, vẽ trên canvas
 * thì bàn tay chui xuống dưới chúng. Máy đang tự chơi thì lớp này ẩn, nhường bàn tay canvas.
 */
const HAND_PATH = 'M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74c-3.6-.76-3.54-.75-3.67-.75-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z';
const tayChuot = (() => {
  let el = null, bat = false, trong = false, an = false, x = 0, y = 0;
  const canvas = () => document.getElementById('game');
  // cỡ bàn tay theo đúng tỉ lệ bàn tay canvas: 24 đơn vị icon × 2,6 đơn vị logic × hệ số màn
  const heSo = () => { const r = canvas()?.getBoundingClientRect(); return r ? Math.min(r.width / W, r.height / H) : 1; };
  function ve() {
    if (!el) return;
    const hien = bat && trong && !isAutoplaying();
    el.style.display = hien ? 'block' : 'none';
    if (!hien) return;
    const k = 2.6 * heSo();
    // đầu ngón tay là điểm (11.5, 3) của icon
    el.style.width = el.style.height = (24 * k) + 'px';
    el.style.transform = `translate(${x - 11.5 * k}px, ${y - 3 * k}px)`;
    el.classList.toggle('an', an);
  }
  return {
    lap() {
      el = document.createElement('div');
      el.className = 'tay-chuot';
      el.innerHTML = `<svg viewBox="0 0 24 24"><path d="${HAND_PATH}"/></svg>`;
      document.body.appendChild(el);
      const theo = e => { x = e.clientX; y = e.clientY; trong = true; ve(); };
      window.addEventListener('pointermove', theo, { capture: true, passive: true });
      window.addEventListener('pointerdown', e => { an = true; theo(e); }, { capture: true, passive: true });
      window.addEventListener('pointerup', e => { an = false; theo(e); }, { capture: true, passive: true });
      window.addEventListener('pointercancel', () => { an = false; ve(); }, { capture: true });
      document.addEventListener('pointerleave', () => { trong = false; ve(); });
      window.addEventListener('blur', () => { trong = false; an = false; ve(); });
      // máy bắt đầu hay thôi tự chơi thì bật tắt theo, không cần đợi chuột nhúc nhích
      setInterval(ve, 250);
      this.bat(S.showFinger);
    },
    bat(on) { bat = !!on; document.documentElement.classList.toggle('tay-gia', bat); ve(); },
  };
})();
