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
import { duckMusic } from '../ui/sfx.js';
import { setSpot } from './progress.js';

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
  const ch = S.map ? `CHƯƠNG ${S.map.no || 1} · ${S.map.name} — ` : '';
  renderHeader({
    eyebrow: `${ch}LEVEL ${S.levelIdx + 1}`,
    title: level.name || 'Level',
    cls: SCENE_CLS[Number(level.background)] || '',
  });
  hideWin(); hideLose(); hidePause();

  // trạng thái
  S.drag = null; S.selected = null;
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
    // Cỡ riêng của món trong CHÍNH level này, không đụng tới món ở level khác
    const k = Number(it.scale) || 1;
    if (k !== 1) { Body.scale(b, k, k); b.artScale *= k; b.levelScale = k; }
    Body.setAngle(b, it.angle || 0);
    S.bodies.push(b);
    // Đồ ngoài túi rơi tự do xuống sàn, nằm lộn xộn tự nhiên thay vì xếp thành lưới
    if (!it.inBag) Body.setVelocity(b, { x: (Math.random() - .5) * 1.5, y: 0 });
  });
  World.add(S.world, S.bodies);
  createTethers();
  renderList(true);
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
