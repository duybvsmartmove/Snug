// Điểm vào của game. Tải content pack, dựng level, chạy loop. Nghe postMessage từ Level Editor để live preview.
import { S, BAG } from './game/state.js';
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
import * as RULES from './game/rules.js';
import * as SCORE from './game/score.js';
import { initHome, showHome, hideHome } from './ui/home.js';
import { setSilent, unlockOnFirstGesture, initAudio, startMusic, duckMusic } from './ui/sfx.js';
import { chuyenMan, moMan } from './ui/veil.js';

const params = new URLSearchParams(location.search);

/**
 * Mở tấm màn lần đầu, khi giao diện đã sẵn sàng thật.
 *
 * "Sẵn sàng" ở đây là hai điều kiện, thiếu điều nào cũng lộ ra cái xấu cũ:
 *   - chữ đã dựng xong   → không còn cảnh chữ hiện bằng font hệ thống rồi nhảy sang font thật
 *   - ảnh trang chủ đã về → không còn thẻ chương trắng trơn rồi ảnh mới đắp vào
 *
 * Kèm hạn chót 6 giây: một tấm ảnh hỏng đường dẫn không được phép giữ người chơi
 * ngồi nhìn tấm màn mãi.
 */
async function moManLanDau() {
  const anh = [...document.querySelectorAll('#home img')]
    .filter(n => n.src && !n.complete)
    .map(n => new Promise(r => { n.addEventListener('load', r, { once: true }); n.addEventListener('error', r, { once: true }); }));
  const hetGio = new Promise(r => setTimeout(r, 6000));
  await Promise.race([Promise.all([document.fonts?.ready, ...anh]), hetGio]);
  await moMan();
}

async function boot() {
  bindOverlayButtons({
    onAgain: restart,                              // chơi lại cùng màn: dựng tức thì, che màn chỉ tổ chậm tay
    onNext: () => chuyenMan(nextLevel),
    onPrev: () => chuyenMan(prevLevel),
    onExtraTime: extraTime,
    onHome: goHome,
  });
  bindInput();
  bindBoosters();
  bindImpacts();
  resize();
  startLoop();

  whenSpriteReady(() => { if (S.LEVEL) renderList(); });

  S.preview = params.get('preview') === '1';
  // Khung xem thử trong editor mặc định im lặng cho đỡ ồn lúc dựng level;
  // bật công tắc "Bật tiếng khi xem thử" thì mới kêu. Tiếng chỉ mở được sau khi
  // người dùng chạm vào chính khung đó, nên cứ chạm vào là nghe.
  setSilent(S.preview && params.get('audio') !== '1');
  unlockOnFirstGesture();

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
    donNutKhongDungCho();
    window.parent.postMessage({ type: 'ready' }, '*');
    moMan();
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
  await moManLanDau();
}

/**
 * Vào chơi một level: đổi chương thì nạp thêm art của chương đó trước.
 * Cả quãng ấy nằm sau tấm màn — nạp ảnh của một chương mới mất vài trăm mili giây, để
 * hở là người chơi thấy sân trống rồi đồ đạc lần lượt mọc lên.
 */
async function startLevel(ch, idx) {
  await chuyenMan(async () => {
    if (!S.map || S.mapId !== ch.id) {
      S.mapId = ch.id; S.map = ch;
      await loadChapterAssets(ch);
    }
    hideHome();
    await initAudio();
    startMusic();
    await loadAndBuild(idx);
  });
}

/**
 * Khung xem thử trong editor chỉ có MỘT level: cái đang sửa, do editor gửi sang.
 * Những nút đưa người chơi đi chỗ khác không có chỗ ở đây — "Về trang chủ" mở ra một
 * màn Home rỗng vì danh sách chương chưa bao giờ được dựng, còn "Level tiếp" thì nhảy
 * sang một level đã lưu, người dựng mất luôn thứ đang làm dở.
 */
function donNutKhongDungCho() {
  for (const id of ['homeBtn', 'winHome', 'loseHome', 'next']) {
    const el = document.getElementById(id); if (el) el.hidden = true;
  }
  document.querySelectorAll('.lvnav').forEach(el => { el.hidden = true; });
}

/** Về trang chủ: dừng ván đang chơi lại, không tính là thua */
function goHome() {
  return chuyenMan(async () => {
    S.paused = true; S.drag = null; S.selected = null;
    duckMusic(false);
    showHome();
  });
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
    S, BAG, FX, RULES, SCORE, restart, nextLevel, prevLevel, autoplay, stopAutoplay,
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

boot().catch(err => {
  console.error(err);
  moMan();                          // hỏng thì cũng phải cho người chơi thấy màn hình
  toast('Lỗi tải level: ' + err.message, 5000);
});
