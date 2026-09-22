// Dựng level từ JSON (content pack): túi polygon, block, rải đồ, dây buộc, hộp bí ẩn, chìa trong túi, HUD.
import Matter from 'matter-js';
import { S, setContainer, toAbs, W, TABLE_Y } from './state.js';
import { MYSTERY, defById, KEY_ID } from '../data/items.js';
import { theme } from '../art/helpers.js';
import { makeItem, createWorld } from './physics.js';
import { createTethers } from './mechanics.js';
import { resetBoosts } from './boosters.js';
import { renderHeader, renderList, hideWin, hideLose, hidePause } from '../ui/hud.js';
import { clearFx } from './fx.js';
import { duckMusic, sfx } from '../ui/sfx.js';
import { setSpot } from './progress.js';
import { t, chapterName, levelName, onLangChange } from '../i18n.js';

const { Body, World } = Matter;

// Màu mực và bảng màu HUD theo mã bối cảnh; không khai báo thì dùng mặc định
const SCENE_INK = { 1: '#3B2A4A', 2: '#3B2A4A', 3: '#4A2F3A' };
const SCENE_CLS = {};

/** Dựng level từ object JSON */
export function build(level) {
  S.LEVEL = level;
  setContainer(level.container || {});
  theme.ink = level.ink || SCENE_INK[Number(level.background)] || '#3B2A4A';
  // Chìa khoá là công cụ mở hộp bí ẩn, không phải món phải xếp → không tính vào packing list
  const playable = level.items.filter(it => it.id !== KEY_ID);
  const missing = playable.filter(it => !defById(it.id)).map(it => it.id);
  if (missing.length) console.warn('Level dùng món chưa có định nghĩa art:', missing.join(', '));
  S.ITEMS = playable.map(it => defById(it.id)).filter(Boolean);

  // HUD
  veThanhTen();
  hideWin(); hideLose(); hidePause();

  // trạng thái
  S.drag = null; S.selected = null; S.luuTui = null;
  S.checked = new Set(); S.gone = new Set(); S.winFrames = 0; S.won = false; S.lost = false; S.paused = false;
  S.unlockFrames = 0; S.unlockHinted = false; S.puffs = [];
  clearFx(); duckMusic(false);
  S.startTime = performance.now(); S.shownSec = -1;
  S.timeLeft = (level.timer || 90) * 1000;
  resetBoosts();

  // vật lý
  createWorld();
  S.bodies = [];
  level.items.forEach((it, i) => {
    const def = defById(it.id); if (!def) return;
    let x = it.x, y = it.y;
    if (it.inBag) { const a = toAbs(it.x ?? 0, it.y ?? -30); x = a.x; y = a.y; }
    if (x == null || y == null) { const col = i % 6, row = Math.floor(i / 6); x = 40 + col * ((W - 80) / 5); y = TABLE_Y + 30 + row * 70; }
    const b = makeItem(it.locked ? MYSTERY : def, x, y);
    b.itemId = def.id; b.label = def.slug; b.realDef = def; b.locked = !!it.locked;
    b.datSan = !!it.inBag;
    // Cỡ riêng của món trong CHÍNH level này, không đụng tới món ở level khác
    const k = Number(it.scale) || 1;
    if (k !== 1) { Body.scale(b, k, k); b.artScale *= k; b.levelScale = k; }
    Body.setAngle(b, it.angle || 0);
    S.bodies.push(b);
  });
  thaDoVaoSan();
  sfx('whoosh', { gain: .34, rate: .88 });   // một nhịp mở màn trước khi đồ đổ xuống
  createTethers();
  renderList(true);
}

/** Thanh tên level trên HUD; gọi lại khi đổi ngôn ngữ giữa ván */
function veThanhTen() {
  const level = S.LEVEL; if (!level) return;
  renderHeader({
    eyebrow: S.map ? t('eyebrow', { no: S.map.no || 1, name: chapterName(S.map), n: S.levelIdx + 1 }) : t('level', { n: S.levelIdx + 1 }),
    title: levelName(level) || 'Level',
    cls: SCENE_CLS[Number(level.background)] || '',
  });
}
onLangChange(veThanhTen);

// Mở màn: đồ rơi xuống lần lượt chứ không đổ ụp một lúc.
// Rơi cùng lúc thì mấy chục cú va chạm dồn vào một phần tư giây, nghe thành một tiếng ù
// và mắt cũng không kịp thấy gì. Thả từ món gần sàn nhất trở lên để món phía trên rơi
// xuống chồng lên món đã nằm yên, đúng thứ tự người thiết kế xếp.
const NHIP_THA = 75;          // mili giây giữa hai món
const CHO_DAU = 120;          // nghỉ một nhịp trước khi món đầu tiên rơi

function thaDoVaoSan() {
  const datSan = S.bodies.filter(b => b.datSan);
  const roiXuong = S.bodies.filter(b => !b.datSan).sort((a, b) => b.position.y - a.position.y);
  World.add(S.world, datSan);                      // món đặt sẵn trong túi có mặt ngay
  const t0 = S.clock + CHO_DAU;
  roiXuong.forEach((b, i) => { b.chuaVao = true; b.vaoLuc = t0 + i * NHIP_THA; });
}

/** Gọi mỗi khung hình: thả những món đã tới lượt vào thế giới vật lý */
export function tickEntrance() {
  if (!S.world) return;
  const now = S.clock;
  for (const b of S.bodies) {
    if (!b.chuaVao || now < b.vaoLuc) continue;
    b.chuaVao = false;
    // Ném nhẹ xuống thay vì thả rơi từ đứng yên: hàng đồ dưới cùng chỉ cách sàn vài chục
    // pixel, buông không thì chạm đất quá nhẹ, không ra tiếng mà cũng không tung bụi.
    Body.setVelocity(b, { x: (Math.random() - .5) * 1.5, y: 3.2 });
    World.add(S.world, b);
  }
}

/** Tải level thứ idx của map hiện tại rồi dựng */
export async function loadAndBuild(idx) {
  S.levelIdx = Math.max(0, Math.min(idx, S.map.levels.length - 1));
  if (S.map && !S.preview) setSpot(S.map.id, S.levelIdx);
  const level = S.map.levels[S.levelIdx];   // level nằm sẵn trong file sắp xếp
  build(level);
  return level;
}

export function restart() { build(S.LEVEL); }
export function nextLevel() { return loadAndBuild((S.levelIdx + 1) % S.map.levels.length); }
export function prevLevel() { return loadAndBuild((S.levelIdx - 1 + S.map.levels.length) % S.map.levels.length); }
