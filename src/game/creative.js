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
//     speed {play, time}           nhịp máy chơi · tốc độ thời gian game (0.25–3)
//     hud {hide:{timer,dock,title,pause}}
//     timer {on}                   đếm giờ hay đóng băng
//     boosts {n}                   ép số lượt booster, null = theo level
//     finger {on}                  ngón tay giả khi máy chơi
//     lang {lang}                  đổi ngôn ngữ
//   game → tool
//     ready                        đã nạp xong, nhận lệnh được
//     status {...}                 mỗi 200ms: màn đang mở, thắng/thua, máy đang làm gì, màu nền
import { S } from './state.js';
import { autoplay, autoStep, stopAutoplay, autoState, autoMode, setPlaySpeed, setAutoQuiet, playSpeed, setAutoBoosters, autoBoosters } from './autoplay.js';
import { setBoostOverride, resetBoosts } from './boosters.js';
import { restart } from './level.js';
import { setLang, getLang } from '../i18n.js';
import { IMAGE_SCENES } from '../art/scene-registry.js';
import { artUrl } from '../content/loader.js';
import { currentScreen } from '../ui/home.js';

export const isCreative = new URLSearchParams(location.search).get('creative') === '1';
const HUD_PARTS = ['timer', 'dock', 'title', 'pause'];
const kep = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 1));

export function initCreative({ startLevel, goHome, showMap, chapterById }) {
  if (!isCreative) return;
  setAutoQuiet(true);
  const phone = document.getElementById('phone');
  const post = msg => window.parent.postMessage(msg, '*');

  window.addEventListener('message', async e => {
    const m = e.data || {};
    try {
      switch (m.type) {
        case 'play': {
          const ch = chapterById(m.chapter); if (!ch) return;
          stopAutoplay();
          await startLevel(ch, m.index | 0);
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
        case 'speed':
          if (m.play != null) setPlaySpeed(kep(m.play, .1, 4));
          if (m.time != null) S.timeScale = kep(m.time, .1, 4);
          break;
        case 'hud': for (const k of HUD_PARTS) phone.classList.toggle('hide-' + k, !!m.hide?.[k]); break;
        case 'timer': S.timerOn = !!m.on; break;
        case 'boosts': setBoostOverride(m.n); if (S.LEVEL) resetBoosts(); break;
        case 'finger': S.showFinger = !!m.on; if (!m.on) S.finger = null; break;
        case 'lang': setLang(m.lang); break;
      }
    } catch (err) { console.error('creative:', err); }
  });

  // Phím tắt của tool bấm lúc iframe đang giữ focus thì chuyển ra ngoài; tool lo phần còn lại
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
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
    finger: S.showFinger, lang: getLang(),
    scene: scene(),
  };
}
