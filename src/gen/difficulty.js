// Difficulty Point theo bảng trong GDD Level Generation System.
import { defById } from '../data/items.js';
import { polygonArea, isConvex } from '../util/geom.js';

export const TIERS = [
  { max: 6, name: 'Easy' }, { max: 10, name: 'Medium' }, { max: 14, name: 'Hard' }, { max: 17, name: 'Very Hard' }, { max: Infinity, name: 'Challenge' },
];
export const tierOf = pts => TIERS.find(t => pts <= t.max).name;

/** Diện tích lòng túi thật theo polygon trừ block */
export function containerArea(container) {
  const shape = container.shape || [];
  const blocks = (container.blocks || []).reduce((s, b) => s + b.w * b.h, 0);
  return Math.max(1, polygonArea(shape) - blocks);
}

/** Độ phức tạp container: 0 đơn giản · 1 hơi irregular · 2 irregular nhiều góc · 3 nhiều vùng */
export function containerComplexity(container) {
  const shape = container.shape || [];
  const blocks = (container.blocks || []).length;
  if ((container.areas || []).length > 0 || blocks >= 2) return 3;
  if (shape.length <= 4 && blocks === 0) return 0;
  if (!isConvex(shape) && shape.length >= 8) return 2;
  if (!isConvex(shape) || blocks === 1 || shape.length > 4) return 1;
  return 0;
}

/**
 * Tính điểm. items: [{id, link?, locked?}], areaOf: id → diện tích món.
 * Trả về { rows: [{label, cond, pts}], total, tier, density, itemArea, usable }
 */
export function difficulty(level, areaOf) {
  const items = level.items.filter(it => it.id !== 0);
  const usable = containerArea(level.container);
  // Cỡ riêng của món trong level này nhân diện tích theo BÌNH PHƯƠNG hệ số:
  // phóng 150% là chiếm 2,25 lần chỗ. Bỏ qua thì bảng độ khó không nhúc nhích
  // dù người dựng level vừa phóng to cả đống đồ.
  const itemArea = items.reduce((s, it) => {
    const k = Number(it.scale) || 1;
    return s + (areaOf(it.id) || 0) * k * k;
  }, 0);
  const density = itemArea / usable;
  const rows = [];

  const dPct = density * 100;
  rows.push({ label: 'Packing Density', cond: `${dPct.toFixed(0)}%`, pts: dPct < 65 ? 0 : dPct < 75 ? 1 : dPct < 83 ? 2 : dPct <= 88 ? 3 : 4 });

  const n = items.length;
  rows.push({ label: 'Item Count', cond: `${n} món`, pts: n <= 5 ? 0 : n <= 7 ? 1 : n <= 10 ? 2 : 3 });

  const metas = items.map(it => defById(it.id)?.meta).filter(Boolean);
  const large = metas.filter(m => m.size === 'L').length;
  const irregular = metas.filter(m => m.shape === 'irregular').length;
  const long = metas.filter(m => m.shape === 'long').length;
  let sizePts = 0, sizeCond = 'Small/Medium đơn giản';
  if (large >= 3 && irregular >= 3) { sizePts = 3; sizeCond = `${large} Large + ${irregular} irregular`; }
  else if (large >= 3 || irregular >= 3) { sizePts = 2; sizeCond = `${large} Large / ${irregular} irregular`; }
  else if (large >= 1 || long >= 1) { sizePts = 1; sizeCond = `${large} Large, ${long} dài`; }
  rows.push({ label: 'Size / Shape', cond: sizeCond, pts: sizePts });

  const rolling = metas.filter(m => m.physics === 'rolling' || m.physics === 'bouncy').length;
  rows.push({ label: 'Rolling / Bouncy', cond: `${rolling} món`, pts: Math.min(3, rolling) });

  const linked = items.filter(it => it.link).length;
  rows.push({ label: 'Linked', cond: `${linked} pair`, pts: linked === 0 ? 0 : linked === 1 ? 2 : 3 });

  const locked = items.filter(it => it.locked).length;
  rows.push({ label: 'Locked', cond: `${locked} món`, pts: locked === 0 ? 0 : locked === 1 ? 2 : 3 });

  const cc = containerComplexity(level.container);
  rows.push({ label: 'Container', cond: ['đơn giản', 'hơi irregular', 'irregular', 'nhiều vùng / block'][cc], pts: cc });

  const total = rows.reduce((s, r) => s + r.pts, 0);
  return { rows, total, tier: tierOf(total), density, itemArea, usable, count: n };
}
