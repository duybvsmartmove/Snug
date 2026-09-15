// Booster theo GDD: Jiggle (lắc túi), Resize (thu nhỏ 20% món lớn nhất ngoài túi), Throw Out (bỏ 1 món thường).
// Mỗi loại có số lượt riêng, hiện badge trên nút.
import Matter from 'matter-js';
import { S, isHeld, daVao } from './state.js';
import { areaOf } from '../data/items.js';
import { removeBody } from './physics.js';
import { bagZone } from './rules.js';
import { jiggle } from './mechanics.js';
import { toast } from '../ui/hud.js';
import { sfx } from '../ui/sfx.js';
import { sparkle, ring, shake, floatText } from './fx.js';

const { Body } = Matter;

const els = {
  jiggle: document.getElementById('bJiggle'),
  resize: document.getElementById('bResize'),
  throw: document.getElementById('bThrow'),
};

/** Số lượt mặc định mỗi level (GDD "Free ban đầu"); level JSON ghi đè qua level.boosters */
export const DEFAULT_BOOSTS = { jiggle: 2, resize: 2, throw: 1 };

export function renderBoosts() {
  for (const k of Object.keys(els)) {
    const el = els[k];
    el.querySelector('.badge').textContent = S.boosts[k] ?? 0;
    el.disabled = (S.boosts[k] ?? 0) <= 0;
  }
}

export function resetBoosts() {
  S.boosts = { ...DEFAULT_BOOSTS, ...(S.LEVEL?.boosters || {}) };
  renderBoosts();
}

const largeIds = () => S.ITEMS.slice().sort((a, b) => areaOf(b) - areaOf(a)).slice(0, 3).map(d => d.id);

/** Món được phép bỏ: không phải 3 món lớn nhất, không buộc dây, không phải hộp bí ẩn hay chìa khóa */
function throwableItems() {
  const big = largeIds();
  return S.bodies.filter(b => daVao(b) && !b.tether && !b.locked && b.label !== 'key' && !big.includes(b.itemId) && !isHeld(b));
}

/** Throw Out: bỏ ngẫu nhiên một món thường, ưu tiên món còn nằm ngoài túi */
function useThrow() {
  if (S.boosts.throw <= 0 || S.won || S.lost) return;
  const all = throwableItems();
  if (!all.length) { sfx('nope'); return toast('Không có món nào bỏ được'); }
  const outside = all.filter(b => !bagZone(b).fullyInside);
  const pool = outside.length ? outside : all;
  const b = pool[Math.floor(Math.random() * pool.length)];
  S.puffs.push({ x: b.position.x, y: b.position.y, t: 0 });
  sfx('trash'); sparkle(b.position.x, b.position.y, { n: 16, color: '#E8434F', speed: 1.3 });
  floatText(b.position.x, b.position.y - 16, 'Bỏ đi', { color: '#E8434F' });
  removeBody(b); S.gone.add(b.itemId);
  S.boosts.throw--; renderBoosts();
  toast(`Đã bỏ ${b.realDef.name}`);
}

function useJiggle() {
  if (S.boosts.jiggle <= 0 || S.won || S.lost) return;
  S.boosts.jiggle--; renderBoosts();
  sfx('jiggle'); shake(420);
  jiggle();
}

function useResize() {
  if (S.boosts.resize <= 0 || S.won || S.lost) return;
  const cands = S.bodies.filter(b => daVao(b) && !bagZone(b).fullyInside && !isHeld(b) && b.label !== 'key');
  if (!cands.length) { sfx('nope'); return toast('Không còn món nào ngoài túi'); }
  const b = cands.sort((x, y) => y.area - x.area)[0];
  Body.scale(b, .8, .8); b.artScale *= .8;   // GDD: thu nhỏ 20%
  S.puffs.push({ x: b.position.x, y: b.position.y, t: 0 });
  sfx('shrink'); ring(b.position.x, b.position.y, { color: '#3D8BFF', r1: 40, life: 420 });
  floatText(b.position.x, b.position.y - 18, '−20%', { color: '#2A66C8' });
  S.boosts.resize--; renderBoosts();
  toast(`Đã thu nhỏ ${b.realDef.name} 20%`);
}

export function bindBoosters() {
  els.jiggle.addEventListener('click', useJiggle);
  els.resize.addEventListener('click', useResize);
  els.throw.addEventListener('click', useThrow);
}
