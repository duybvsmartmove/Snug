// Điểm vào của game. Tải content pack, dựng level, chạy loop. Nghe postMessage từ Level Editor để live preview.
import { S } from './game/state.js';
import { defById } from './data/items.js';
import { resize } from './game/canvas.js';
import { bindInput } from './game/input.js';
import { bindBoosters } from './game/boosters.js';
import { build, loadAndBuild, restart, nextLevel, prevLevel } from './game/level.js';
import { startLoop } from './game/render.js';
import { bindOverlayButtons, hideLose, toast, renderList } from './ui/hud.js';
import { bindImpacts } from './game/rules.js';
import { loadBook, chapters, chapterById, loadChapterAssets, loadItemManifests, whenSpriteReady } from './content/loader.js';
import { autoplay, stopAutoplay } from './game/autoplay.js';
import * as FX from './game/fx.js';
import { initHome, showHome, hideHome } from './ui/home.js';
import { setSilent, unlockOnFirstGesture, initAudio, startMusic, duckMusic } from './ui/sfx.js';

const params = new URLSearchParams(location.search);

function extraTime() { // booster Extra Time (GDD): +60s sau khi hết giờ lần 1
  S.timeLeft = 60000; S.lost = false; S.shownSec = -1; hideLose(); toast('+60 giây!');
}

async function boot() {
  bindOverlayButtons({ onAgain: restart, onNext: nextLevel, onPrev: prevLevel, onExtraTime: extraTime, onHome: goHome });
  bindInput();
  bindBoosters();
  bindImpacts();
  resize();
  startLoop();

  whenSpriteReady(() => { if (S.LEVEL) renderList(); });

  S.preview = params.get('preview') === '1';
  setSilent(S.preview);            // khung xem thử trong editor thì im lặng
  if (!S.preview) unlockOnFirstGesture();

  // Toàn bộ nội dung nằm trong bản build: một file sắp xếp và thư mục ảnh. Không gọi mạng.
  await loadBook({ fresh: S.preview });

  // Live preview từ editor: level gửi qua postMessage, không tải từ content
  window.addEventListener('message', e => {
    const m = e.data || {};
    if (m.type === 'level' && m.level) {
      S.levelIdx = m.index ?? S.levelIdx;
      if (m.chapter) S.map = { ...(S.map || {}), no: m.chapter.no, name: m.chapter.name, levels: S.map?.levels || [] };
      // Editor có thể vừa thêm món chưa nằm trong danh sách ảnh của chương.
      // Không nạp ảnh trước thì món có hình vật lý mà không có gì để vẽ: chiếm chỗ mà vô hình.
      buildWithArt(m.level);
    }
    if (m.type === 'restart') { stopAutoplay(); restart(); }
    if (m.type === 'autoplay') autoplay();
    if (m.type === 'assets') { // editor vừa thêm/sửa art → nạp lại rồi dựng lại level
      loadBook({ fresh: true }).then(() => loadChapterAssets(S.map)).then(() => { if (S.LEVEL) build(S.LEVEL); });
    }
    if (m.type === 'timer') { S.timerOn = !!m.on; }
  });
  if (S.preview) {
    const ch = chapterById(params.get('map') || chapters()[0]?.id);
    S.mapId = ch.id; S.map = ch;
    await loadChapterAssets(ch);
    window.parent.postMessage({ type: 'ready' }, '*');
    return;
  }

  initHome({ chapters: chapters(), onPlay: startLevel });

  // Mở thẳng một level qua địa chỉ (?level=… hoặc ?i=…) thì bỏ qua trang chủ
  const byId = params.get('level'), byIdx = params.get('i');
  if (byId != null || byIdx != null) {
    const ch = chapterById(params.get('map') || chapters()[0]?.id);
    const idx = byId ? Math.max(0, ch.levels.findIndex(l => l.id === byId)) : Number(byIdx || 0);
    await startLevel(ch, idx);
  } else {
    showHome();
  }
}

/** Vào chơi một level: đổi chương thì nạp thêm art của chương đó trước */
async function startLevel(ch, idx) {
  if (!S.map || S.mapId !== ch.id) {
    S.mapId = ch.id; S.map = ch;
    await loadChapterAssets(ch);
  }
  hideHome();
  await initAudio();
  startMusic();
  await loadAndBuild(idx);
}

/** Về trang chủ: dừng ván đang chơi lại, không tính là thua */
function goHome() {
  S.paused = true; S.drag = null; S.selected = null;
  duckMusic(false);
  showHome();
}

/** Dựng level trong khung xem thử, nạp trước ảnh của những món chưa có */
async function buildWithArt(level) {
  const missing = [...new Set((level.items || []).map(it => Number(it.id)))]
    .filter(id => { const d = defById(id); return !d || !d.sprite; });
  if (missing.length) await loadItemManifests(missing);
  build(level);
}

// Hook debug ở chế độ dev: mở console gõ __game.S để xem trạng thái, __game.drag(id, x, y) để thử kéo.
if (import.meta.env?.DEV) {
  window.__game = {
    S, FX, restart, nextLevel, prevLevel, autoplay,
    body: id => S.bodies.find(b => b.label === id),
    async drag(id, tx, ty, steps = 10) {
      const cv = document.getElementById('game'), r = cv.getBoundingClientRect();
      const b = S.bodies.find(x => x.label === id); if (!b) return 'not found: ' + id;
      const send = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true, cancelable: true, clientX: r.left + x * r.width / 420, clientY: r.top + y * r.height / 760 }));
      const wait = ms => new Promise(res => setTimeout(res, ms));
      const sx = b.position.x, sy = b.position.y;
      send('pointerdown', sx, sy); await wait(60);
      for (let i = 1; i <= steps; i++) { send('pointermove', sx + (tx - sx) * i / steps, sy + (ty - sy) * i / steps); await wait(30); }
      await wait(200);
      const ghost = S.drag ? S.drag.ghost : null;
      send('pointerup', tx, ty); await wait(700);
      return { id, ghostBeforeDrop: ghost, checked: S.checked.has(id), pos: [Math.round(b.position.x), Math.round(b.position.y)] };
    },
  };
}

boot().catch(err => { console.error(err); toast('Lỗi tải level: ' + err.message, 5000); });
