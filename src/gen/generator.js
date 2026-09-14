// Sinh level từ template + seed theo flow trong GDD:
// chọn shape → tính usable area → random item theo density + size distribution → gán mechanic → tính Difficulty → solver → trả candidate.
import { defById } from '../data/items.js';
import { mulberry32, randInt, pick, shuffle } from '../util/geom.js';
import { difficulty, containerArea, TIERS } from './difficulty.js';
import { solve } from './solver.js';

const TRAY = { x0: 40, x1: 380, y0: 450, y1: 600 };

/**
 * template = {
 *   seed, pool: [ids], count: [min,max], density: [min,max], sizeDist: {L,M,S},
 *   mechanics: { rolling, linked, locked }, tier: 'Medium' | null, container: {...level.container}
 * }
 * areaOf(id) → diện tích món. Trả về { level, report } hoặc null nếu không tìm được.
 */
export function generate(template, areaOf, { attempts = 120 } = {}) {
  const rand = mulberry32(template.seed >>> 0 || 1);
  const usable = containerArea(template.container);
  const pool = template.pool.map(defById).filter(d => d && d.id !== 0);
  let best = null;

  for (let a = 0; a < attempts; a++) {
    const count = randInt(rand, template.count[0], template.count[1]);
    const target = template.density[0] + rand() * (template.density[1] - template.density[0]);
    const chosen = pickItems(rand, pool, count, target * usable, template.sizeDist, areaOf);
    if (!chosen) continue;
    const gotDensity = chosen.reduce((s, d) => s + (areaOf(d.id) || 0), 0) / usable;
    const items = chosen.map(d => ({ id: d.id, x: 0, y: 0, angle: 0 }));
    assignMechanics(rand, items, template.mechanics || {});
    if (items.some(it => it.locked)) items.push({ id: 0, inBag: true, x: randInt(rand, -60, 60), y: -30, angle: 0 });
    layoutTray(rand, items);
    const level = { ...baseLevel(template), items };
    const diff = difficulty(level, areaOf);
    const inTier = !template.tier || diff.tier === template.tier;
    const sol = solve(level, { tries: 30, seed: template.seed + a });
    const densErr = Math.abs(diff.density - target);
    const score = (inTier ? 0 : 10) + (sol.solvable ? 0 : 20) + densErr * 40;
    if (!best || score < best.score) best = { score, level, diff, sol, attempt: a + 1, target, densErr };
    if (inTier && sol.solvable && densErr < .04) break;
  }
  if (best) {
    // Pool không đủ diện tích để đạt density mong muốn → báo cho GD biết
    const maxArea = pool.map(d => areaOf(d.id)).sort((x, y) => y - x).slice(0, template.count[1]).reduce((s, v) => s + v, 0);
    best.maxDensity = maxArea / usable;
    best.hint = best.densErr > .06
      ? (best.maxDensity < template.density[0]
        ? `Pool chỉ đạt tối đa ${(best.maxDensity * 100).toFixed(0)}% với ${template.count[1]} món — thêm món lớn, tăng count, hoặc thu nhỏ lòng túi.`
        : 'Chưa bám sát density mong muốn — thử Reroll hoặc nới count.')
      : '';
  }
  return best;
}

function baseLevel(t) {
  return {
    id: t.id || 'gen', name: t.name || 'Generated', timer: t.timer || 90, background: t.background || 'vanity',
    container: JSON.parse(JSON.stringify(t.container)), mode: 'generated', reward: { coin: 20 },
    generate: { seed: t.seed, pool: t.pool, count: t.count, density: t.density, sizeDist: t.sizeDist, mechanics: t.mechanics, tier: t.tier },
  };
}

/**
 * Chọn `count` món sao cho tổng diện tích bám sát targetArea, tôn trọng sizeDist {L, M} (S = phần còn lại).
 * Tham lam có mục tiêu: mỗi bước chọn món làm tổng tiến gần target nhất, sau đó hoán đổi để tinh chỉnh.
 */
function pickItems(rand, pool, count, targetArea, sizeDist = {}, areaOf) {
  if (pool.length < count) return null;
  const A = d => areaOf(d.id) || 1;
  const byS = { L: pool.filter(d => d.meta.size === 'L'), M: pool.filter(d => d.meta.size === 'M'), S: pool.filter(d => d.meta.size === 'S') };
  const want = { L: Math.min(sizeDist.L ?? 0, byS.L.length), M: Math.min(sizeDist.M ?? 0, byS.M.length) };
  want.S = Math.max(0, count - want.L - want.M);

  // 1) lấp theo size distribution, trong mỗi nhóm chọn món đưa tổng tới gần target nhất
  const chosen = [];
  const takeFrom = (list, n) => {
    const avail = shuffle(rand, list.filter(d => !chosen.includes(d)));
    for (let i = 0; i < n && avail.length; i++) {
      const remainSlots = count - chosen.length - 1;
      const cur = chosen.reduce((s, d) => s + A(d), 0);
      // diện tích lý tưởng cho món này: phần còn thiếu chia đều cho các slot còn lại
      const ideal = remainSlots > 0 ? (targetArea - cur) / (remainSlots + 1) : targetArea - cur;
      avail.sort((a, b) => Math.abs(A(a) - ideal) - Math.abs(A(b) - ideal));
      chosen.push(avail.shift());
    }
  };
  takeFrom(byS.L, want.L); takeFrom(byS.M, want.M); takeFrom(byS.S, want.S);
  while (chosen.length < count) {
    const avail = pool.filter(d => !chosen.includes(d));
    if (!avail.length) break;
    const cur = chosen.reduce((s, d) => s + A(d), 0);
    const ideal = targetArea - cur;
    avail.sort((a, b) => Math.abs(A(a) - ideal) - Math.abs(A(b) - ideal));
    chosen.push(avail[0]);
  }

  // 2) tinh chỉnh bằng hoán đổi. Pass A giữ nguyên size distribution;
  //    nếu vẫn lệch > 6% thì Pass B nới ràng buộc để bám density (density quan trọng hơn với GD).
  const err = list => Math.abs(list.reduce((s, d) => s + A(d), 0) - targetArea);
  const refine = keepSize => {
    for (let pass = 0; pass < 80; pass++) {
      let improved = false;
      const outside = pool.filter(d => !chosen.includes(d));
      for (let i = 0; i < chosen.length && !improved; i++) {
        for (const cand of outside) {
          if (keepSize && cand.meta.size !== chosen[i].meta.size) continue;
          const trial = chosen.slice(); trial[i] = cand;
          if (err(trial) < err(chosen) - 1) { chosen[i] = cand; improved = true; break; }
        }
      }
      if (!improved) break;
    }
  };
  refine(!!(want.L || want.M));
  if (err(chosen) / targetArea > .06) refine(false);
  return chosen;
}

function assignMechanics(rand, items, m) {
  const cands = () => shuffle(rand, items.filter(it => !it.link && !it.linkedTo && !it.locked));
  for (let i = 0; i < (m.linked || 0); i++) {
    const c = cands().filter(it => defById(it.id).meta.canLink);
    if (c.length >= 2) { c[0].link = c[1].id; c[1].linkedTo = c[0].id; }
  }
  for (let i = 0; i < (m.locked || 0); i++) {
    const c = cands().filter(it => defById(it.id).meta.canLock);
    if (c.length) c[0].locked = true;
  }
  for (const it of items) delete it.linkedTo;
  // rolling: ưu tiên có sẵn trong pool; nếu thiếu, không thêm món mới (generator chỉ chọn trong pool)
}

/** Rải đồ lên khay theo lưới, xáo nhẹ */
export function layoutTray(rand, items) {
  const tray = items.filter(it => !it.inBag);
  const cols = tray.length > 12 ? 6 : 5, rowGap = tray.length > 12 ? 62 : 80;
  tray.forEach((it, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    it.x = Math.round(TRAY.x0 + col * ((TRAY.x1 - TRAY.x0) / (cols - 1)) + (rand() - .5) * 14);
    it.y = Math.round(TRAY.y0 + row * rowGap + rand() * 8);
    it.angle = Math.round((rand() - .5) * 1.2 * 100) / 100;
  });
}

export const tierNames = TIERS.map(t => t.name);
