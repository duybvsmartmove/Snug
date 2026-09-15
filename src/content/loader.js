// Đọc content pack (public/content): pack → map → level, và manifest asset (sprite + collider).
import { ITEM_DEFS, defById } from '../data/items.js';
import { registerImageScene, registerBagSkin } from '../art/scene-registry.js';

// Nguồn content. Hai chế độ:
//   · Game    — đọc bản đã phát hành, qua kho ở máy (offline được). Gọi initContent().
//   · Editor  — đọc thẳng bản nháp, luôn lấy bản mới nhất, không qua kho. Gọi useDraft().
// Đổi sang content service từ xa sau này chỉ là đổi tham số root của initContent().
import { syncContent, readContent } from './sync.js';

let BASE = './content/draft/';   // mặc định hợp cho editor; game gọi initContent() để đổi
let VERSION = 0;
let useStore = false;

export function setContentBase(url) { BASE = url.endsWith('/') ? url : url + '/'; }
export const contentBase = () => BASE;
export const contentVersion = () => VERSION;

/** Editor: đọc thẳng bản nháp trên đĩa, không đụng tới kho đã cache */
export function useDraft(root = './content/') { setContentBase(root + 'draft/'); useStore = false; VERSION = 0; }

/**
 * Game: đồng bộ với server rồi trỏ vào bản đang phát hành.
 * @returns kết quả của syncContent — {version, changed, offline, firstRun}
 */
export async function initContent(root = './content/', onProgress) {
  const r = await syncContent(root, onProgress);
  BASE = r.base; VERSION = r.version; useStore = true;
  cache.clear();
  return r;
}

const cache = new Map();

/** Ảnh trong bản phát hành trỏ ra ../assets/<tên>.<hash>.png nên chỉ cần ghép với BASE */
const assetPath = src => /^(https?:)?\/\//.test(src) ? src : BASE + src;

async function getJSON(path, { fresh = false } = {}) {
  if (!fresh && cache.has(path)) return cache.get(path);
  if (useStore) {
    const data = await readContent(VERSION, BASE, path);
    cache.set(path, data);
    return data;
  }
  const res = await fetch(BASE + path + (fresh ? `?t=${Date.now()}` : ''));
  if (!res.ok) throw new Error(`Không tải được ${path} (${res.status})`);
  const data = await res.json();
  cache.set(path, data);
  return data;
}

export const loadPack = opts => getJSON('pack.json', opts);
export const loadMap = (mapId, opts) => getJSON(`maps/${mapId}/map.json`, opts);
export const loadLevel = (mapId, levelId, opts) => getJSON(`maps/${mapId}/levels/${levelId}.json`, opts);

/**
 * Nạp đúng phần ảnh một chương cần. Danh sách do publish tính sẵn và ghi vào map.json,
 * nên thêm chương mới không phải tải lại ảnh của chương cũ.
 */
export async function loadChapterAssets(map) {
  const a = map?.assets;
  await Promise.all([
    loadItemManifests(a?.items),
    loadBackgrounds(a?.backgrounds),
    loadBags(a?.bags),
  ]);
  return a || null;
}

/** Tải sẵn ảnh của một chương khác lúc máy rảnh, để vào chương đó không phải chờ */
export function prefetchChapter(mapId) {
  const run = () => loadMap(mapId).then(loadChapterAssets).catch(() => {});
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 8000 });
  else setTimeout(run, 3000);
}

/**
 * Mục lục art: mã số → đường dẫn file mô tả.
 * Nhờ nó, ảnh xếp theo thư mục chương nào cũng được, và chương sau dùng lại món cũ
 * chỉ trỏ vào đúng file đó chứ không nhân bản.
 */
let assetIndex = null;
export async function loadAssetIndex(force) {
  if (assetIndex && !force) return assetIndex;
  cache.delete('assets/index.json');
  try { assetIndex = await getJSON('assets/index.json', { fresh: true }); }
  catch { assetIndex = { items: {}, backgrounds: {}, bags: {} }; }
  for (const k of ['items', 'backgrounds', 'bags']) assetIndex[k] = assetIndex[k] || {};
  return assetIndex;
}

/** Thư mục chương mà art MỚI sẽ được đặt vào. Editor đặt lại mỗi khi đổi chương. */
let assetChapter = '01-school-day';
export function setAssetChapter(folder) { if (folder) assetChapter = folder; }

/** Art này đang nằm ở file nào. Chưa có thì trả chỗ mặc định trong thư mục chương hiện tại. */
export async function assetHome(kind, id) {
  const index = await loadAssetIndex();
  return index[kind]?.[id] || `assets/${assetChapter}/${kind}/${id}.json`;
}

/** Ghi một mục vào mục lục art rồi lưu lại */
export async function indexAsset(kind, id, path) {
  const index = await loadAssetIndex(true);
  index[kind][id] = path;
  await saveContent('assets/index.json', JSON.stringify(index, null, 2));
  assetIndex = index;
  return index;
}

/**
 * Nạp manifest món. Truyền danh sách id thì chỉ nạp bấy nhiêu — dùng cho game, mỗi chương
 * chỉ cần ảnh của chương đó. Bỏ trống thì nạp cả kho — dùng cho editor.
 */
export async function loadItemManifests(ids) {
  const index = await loadAssetIndex();
  const list = ids || Object.keys(index.items).map(Number);
  await Promise.all(list.map(async id => {
    const path = index.items[id];
    if (!path) return;
    try {
      const m = await getJSON(path, { fresh: true });
      const def = applyManifest(m);
      if (def.sprite) await def.sprite.whenReady;
    } catch (e) { console.warn('manifest lỗi', id, e); }
  }));
}

/** Nạp nền dạng ảnh. Truyền danh sách id thì chỉ nạp bấy nhiêu. */
export async function loadBackgrounds(only) {
  const index = await loadAssetIndex();
  const ids = only || Object.keys(index.backgrounds).map(Number);
  await Promise.all(ids.map(async id => {
    const path = index.backgrounds[id];
    if (!path) return;
    try {
      const m = await getJSON(path, { fresh: true });
      const layers = (m.layers || []).map(l => {
        const img = new Image(); img.src = assetPath(l.src);
        return { ...l, img };
      });
      await Promise.all(layers.map(l => new Promise(res => { l.img.onload = l.img.onerror = res; if (l.img.complete) res(); })));
      registerImageScene(id, { ...m, layers });
    } catch (e) { console.warn('nền lỗi', id, e); }
  }));
  return ids;
}

/** Nạp ảnh ba lớp của từng kiểu túi. Truyền danh sách id thì chỉ nạp bấy nhiêu. */
export async function loadBags(only) {
  const index = await loadAssetIndex();
  const kinds = only || Object.keys(index.bags);
  const list = (await Promise.all(kinds.map(async k => {
    const path = index.bags[k];
    if (!path) return null;
    try { return await getJSON(path, { fresh: true }); } catch { return null; }
  }))).filter(Boolean);
  await Promise.all(list.map(async def => {
    const img = {};
    await Promise.all(Object.entries(def.layers || {}).map(([k, src]) => new Promise(res => {
      const el = new Image();
      el.onload = el.onerror = () => res();
      el.src = assetPath(src);
      img[k] = el;
      if (el.complete && el.naturalWidth) res();
    })));
    registerBagSkin(def.id, { ...def, img });
  }));
  return list.map(b => b.id);
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
      img.src = assetPath(m.sprite.src);
      if (img.complete && img.naturalWidth) done();
    });
    def.sprite = sprite;
  }
  return def;
}

/** Đăng ký callback chạy khi một sprite vừa tải xong (để vẽ lại palette / canvas) */
const onSpriteReady = [];
export function whenSpriteReady(fn) { onSpriteReady.push(fn); }

/**
 * Nơi ghi nội dung. Mặc định là cầu ghi file của server dev; bản editor deploy lên web
 * thay bằng driver ghi thẳng lên GitHub. Game không bao giờ ghi, chỉ editor dùng phần này.
 */
const devWriter = {
  async saveText(path, text) {
    const res = await fetch('/__content/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, text }) });
    if (!res.ok) throw new Error((await res.json()).error || 'save failed');
    return res.json();
  },
  async saveBinary(path, base64) {
    const res = await fetch('/__content/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, base64 }) });
    if (!res.ok) throw new Error((await res.json()).error || 'save failed');
    return res.json();
  },
  async list(dir) {
    const res = await fetch(`/__content/list?dir=${encodeURIComponent(dir)}`);
    return res.ok ? (await res.json()).files : [];
  },
  async remove(path) {
    const res = await fetch('/__content/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
    if (!res.ok) throw new Error((await res.json()).error || 'delete failed');
    return res.json();
  },
};

let writer = devWriter;
export function setContentWriter(w) { writer = w || devWriter; }
export const contentWriter = () => writer;

export async function saveContent(path, text) {
  const r = await writer.saveText(path, text);
  cache.delete(path);
  return r;
}
export const saveBinary = (path, base64) => writer.saveBinary(path, base64);
export const listContent = dir => writer.list(dir);
export async function deleteContent(path) {
  const r = await writer.remove(path);
  cache.delete(path);
  return r;
}
