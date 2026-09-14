// Điểm vào của game. Tải content pack, dựng level, chạy loop. Nghe postMessage từ Level Editor để live preview.
import { S } from './game/state.js';
import { resize } from './game/canvas.js';
import { bindInput } from './game/input.js';
import { bindBoosters } from './game/boosters.js';
import { build, loadAndBuild, restart, nextLevel, prevLevel } from './game/level.js';
import { startLoop } from './game/render.js';
import { bindOverlayButtons, hideLose, toast, renderList } from './ui/hud.js';
import { loadPack, loadMap, loadItemManifests, loadBackgrounds, whenSpriteReady } from './content/loader.js';
import { autoplay, stopAutoplay } from './game/autoplay.js';

const params = new URLSearchParams(location.search);

function extraTime() { // booster Extra Time (GDD): +60s sau khi hết giờ lần 1
  S.timeLeft = 60000; S.lost = false; S.shownSec = -1; hideLose(); toast('+60 giây!');
}

async function boot() {
  bindOverlayButtons({ onAgain: restart, onNext: nextLevel, onPrev: prevLevel, onExtraTime: extraTime });
  bindInput();
  bindBoosters();
  resize();
  startLoop();

  whenSpriteReady(() => { if (S.LEVEL) renderList(); });
  await Promise.all([loadItemManifests(), loadBackgrounds()]);
  const pack = await loadPack({ fresh: true });
  S.mapId = params.get('map') || pack.maps[0];
  S.map = await loadMap(S.mapId, { fresh: true });

  // Live preview từ editor: level gửi qua postMessage, không tải từ content
  S.preview = params.get('preview') === '1';
  window.addEventListener('message', e => {
    const m = e.data || {};
    if (m.type === 'level' && m.level) {
      S.levelIdx = m.index ?? S.levelIdx;
      if (m.chapter) S.map = { ...(S.map || {}), no: m.chapter.no, name: m.chapter.name, levels: S.map?.levels || [] };
      build(m.level);
    }
    if (m.type === 'restart') { stopAutoplay(); restart(); }
    if (m.type === 'autoplay') autoplay();
    if (m.type === 'assets') { // editor vừa thêm/sửa art → nạp lại rồi dựng lại level
      Promise.all([loadItemManifests(), loadBackgrounds()]).then(() => { if (S.LEVEL) build(S.LEVEL); });
    }
    if (m.type === 'timer') { S.timerOn = !!m.on; }
  });
  if (S.preview) { window.parent.postMessage({ type: 'ready' }, '*'); return; }

  const byId = params.get('level');
  const idx = byId ? Math.max(0, S.map.levels.indexOf(byId)) : Number(params.get('i') || 0);
  await loadAndBuild(idx);
}

// Hook debug ở chế độ dev: mở console gõ __game.S để xem trạng thái, __game.drag(id, x, y) để thử kéo.
if (import.meta.env?.DEV) {
  window.__game = {
    S, restart, nextLevel, prevLevel, autoplay,
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
