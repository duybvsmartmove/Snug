// Đọc content pack (public/content): pack → map → level, và manifest asset (sprite + collider).
import { ITEM_DEFS, defById } from '../data/items.js';
import { registerImageScene } from '../art/scene-registry.js';

// Nguồn content. Mặc định là thư mục đi kèm bản build.
// Khi chuyển sang content service từ xa, gọi setContentBase('https://cdn.../v12/') một lần lúc khởi động.
let BASE = './content/';
export function setContentBase(url) { BASE = url.endsWith('/') ? url : url + '/'; }
export const contentBase = () => BASE;

const cache = new Map();

async function getJSON(path, { fresh = false } = {}) {
  if (!fresh && cache.has(path)) return cache.get(path);
  const res = await fetch(BASE + path + (fresh ? `?t=${Date.now()}` : ''));
  if (!res.ok) throw new Error(`Không tải được ${path} (${res.status})`);
  const data = await res.json();
  cache.set(path, data);
  return data;
}

export const loadPack = opts => getJSON('pack.json', opts);
export const loadMap = (mapId, opts) => getJSON(`maps/${mapId}/map.json`, opts);
export const loadLevel = (mapId, levelId, opts) => getJSON(`maps/${mapId}/levels/${levelId}.json`, opts);

/** Danh sách item có manifest riêng (sprite / collider / meta override) */
export async function loadItemManifests() {
  let index;
  cache.delete('assets/items/index.json');
  try { index = await getJSON('assets/items/index.json', { fresh: true }); } catch { return; }
  await Promise.all((index.items || []).map(async id => {
    try {
      const m = await getJSON(`assets/items/${id}.json`, { fresh: true });
      const def = applyManifest(m);
      if (def.sprite) await def.sprite.whenReady;
    } catch (e) { console.warn('manifest lỗi', id, e); }
  }));
}

/** Nạp các nền dạng ảnh trong content pack */
export async function loadBackgrounds() {
  let index;
  cache.delete('assets/backgrounds/index.json');
  try { index = await getJSON('assets/backgrounds/index.json', { fresh: true }); } catch { return []; }
  const ids = index.backgrounds || [];
  await Promise.all(ids.map(async id => {
    try {
      const m = await getJSON(`assets/backgrounds/${id}.json`, { fresh: true });
      const layers = (m.layers || []).map(l => {
        const img = new Image(); img.src = BASE + l.src + `?v=${Date.now()}`;
        return { ...l, img };
      });
      await Promise.all(layers.map(l => new Promise(res => { l.img.onload = l.img.onerror = res; if (l.img.complete) res(); })));
      registerImageScene(id, { ...m, layers });
    } catch (e) { console.warn('nền lỗi', id, e); }
  }));
  return ids;
}

/** Gộp manifest vào ITEM_DEFS: tạo def mới nếu id chưa có (món chỉ có ảnh) */
export function applyManifest(m) {
  let def = defById(m.id);
  if (!def) {
    def = { id: Number(m.id), slug: m.slug || `item${m.id}`, code: m.code || null,
            name: m.name || `Món ${m.id}`, kind: 'rect', w: 40, h: 40, box: [-20, -20, 20, 20],
            meta: { size: 'M', shape: 'simple', physics: 'normal', cost: 1, canLink: true, canLock: true } };
    ITEM_DEFS.push(def);
  }
  if (m.name) def.name = m.name;
  if (m.meta) def.meta = { ...def.meta, ...m.meta };
  if (m.collider) {
    const c = m.collider;
    if (c.kind === 'circle') Object.assign(def, { kind: 'circle', r: c.r, box: [-c.r, -c.r, c.r, c.r] });
    else if (c.kind === 'rect') Object.assign(def, { kind: 'rect', w: c.w, h: c.h, chamfer: c.chamfer || 0, box: [-c.w / 2, -c.h / 2, c.w / 2, c.h / 2] });
    else if (c.kind === 'poly') {
      const xs = c.pts.map(p => p[0]), ys = c.pts.map(p => p[1]);
      Object.assign(def, { kind: 'poly', pts: c.pts, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
      delete def.parts; delete def.extra;
    }
  }
  if (m.sprite) {
    const img = new Image();
    const sprite = { img, ppu: m.sprite.pixelsPerUnit || 3, ready: false };
    sprite.whenReady = new Promise(res => {
      const done = () => { sprite.ready = true; onSpriteReady.forEach(fn => fn(def)); res(def); };
      img.onload = done;
      img.onerror = () => res(def);
      img.src = BASE + m.sprite.src + (m.sprite.src.includes('?') ? '' : `?v=${Date.now()}`);
      if (img.complete && img.naturalWidth) done();
    });
    def.sprite = sprite;
  }
  return def;
}

/** Đăng ký callback chạy khi một sprite vừa tải xong (để vẽ lại palette / canvas) */
const onSpriteReady = [];
export function whenSpriteReady(fn) { onSpriteReady.push(fn); }

/** Ghi file vào content (chỉ chạy ở dev, qua Vite plugin) */
export async function saveContent(path, text) {
  const res = await fetch('/__content/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, text }) });
  if (!res.ok) throw new Error((await res.json()).error || 'save failed');
  cache.delete(path);
  return res.json();
}
export async function saveBinary(path, base64) {
  const res = await fetch('/__content/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, base64 }) });
  if (!res.ok) throw new Error((await res.json()).error || 'save failed');
  return res.json();
}
export async function listContent(dir) {
  const res = await fetch(`/__content/list?dir=${encodeURIComponent(dir)}`);
  return res.ok ? (await res.json()).files : [];
}
