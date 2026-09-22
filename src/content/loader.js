// Đọc nội dung game. Mọi thứ nằm ngay trong bản build, không gọi mạng lúc chơi.
//
//   public/content/
//     levels.json                 sắp xếp chương và level — Level Editor xuất ra file này
//     assets/index.json           mục lục: mã số → đường dẫn file mô tả
//     assets/<chương>/items/…     ảnh và mô tả từng món
//     assets/<chương>/bags/…      ảnh ba lớp của từng kiểu túi
//     assets/<chương>/backgrounds/…
//
// Editor dùng lại đúng module này, chỉ khác BASE trỏ sang địa chỉ của game.
import { ITEM_DEFS, defById } from '../data/items.js';
import { registerImageScene, registerBagSkin } from '../art/scene-registry.js';
import { applyCollider } from '../data/collider.js';

let BASE = './content/';
export function setContentBase(url) { BASE = url.endsWith('/') ? url : url + '/'; }

// Bộ art theo phong cách. Level và mục lục dùng chung, chỉ khác thư mục ảnh:
//   cozy    assets/           bộ hiện có
//   casual  assets-casual/    cùng cấu trúc, cùng tên file, thả ảnh mới vào là dùng được
// Chọn bằng ?art=casual. Chưa có thư mục casual thì loader lặng lẽ dùng bộ cozy.
export const ART_STYLES = ['cozy', 'casual'];
let ART = 'cozy';
export const artStyle = () => ART;
export function setArtStyle(s) { ART = ART_STYLES.includes(s) ? s : 'cozy'; }
/** Đổi đường dẫn "assets/…" sang thư mục của bộ art đang chọn */
const artDir = p => (ART === 'cozy' ? p : p.replace(/^assets\//, `assets-${ART}/`));
/** Địa chỉ đầy đủ của một file art, dùng cả ở trang chủ (thẻ <img>, background) */
export const artUrl = p => (/^(https?:)?\/\//.test(p) ? p : BASE + artDir(p));

const cache = new Map();
const assetPath = src => artUrl(src);

async function getJSON(path, { fresh = false, noStore = false } = {}) {
  if (!fresh && !noStore && cache.has(path)) return cache.get(path);
  const res = await fetch(BASE + artDir(path) + (fresh || noStore ? `?t=${Date.now()}` : ''),
    noStore ? { cache: 'no-store' } : undefined);
  if (!res.ok) throw new Error(`Không tải được ${path} (${res.status})`);
  const data = await res.json();
  cache.set(path, data);
  return data;
}

// ---------- sắp xếp chương và level ----------
let BOOK = null;

/**
 * Nạp file sắp xếp. LUÔN bỏ qua cache của trình duyệt: đây là file duy nhất thay đổi
 * mỗi lần sửa level, mà GitHub Pages lại đặt max-age 600 giây nên không ép thì mười phút
 * sau người chơi mới thấy. File chỉ khoảng 40 KB nên tải lại không đáng kể.
 */
export async function loadBook(opts) {
  BOOK = await getJSON('levels.json', { ...opts, noStore: true });
  return BOOK;
}
export const book = () => BOOK;
export const chapters = () => BOOK?.chapters || [];
export const chapterById = id => chapters().find(c => c.id === id) || chapters()[0] || null;

// ---------- art ----------
let assetIndex = null, indexInFlight = null;
/**
 * Mục lục art. Món, nền và túi nạp song song nên ba lời gọi tới đây gần như cùng lúc;
 * chỉ có MỘT lượt tải thật, các lời gọi sau chờ chung. Không gộp thì lúc bộ art đang
 * chọn chưa có thư mục, lượt đầu lùi về cozy còn hai lượt sau thấy đã là cozy rồi mà
 * fetch của mình vẫn hỏng → nhận mục lục rỗng, game mất túi và nền.
 */
export function loadAssetIndex(force) {
  if (assetIndex && !force) return Promise.resolve(assetIndex);
  if (indexInFlight) return indexInFlight;
  indexInFlight = (async () => {
    cache.delete('assets/index.json');
    let idx;
    try { idx = await getJSON('assets/index.json', { fresh: true }); }
    catch {
      // Bộ art đang chọn chưa có thư mục → về bộ cozy, không để game trắng trơn
      if (ART !== 'cozy') {
        console.warn(`Chưa có thư mục assets-${ART}, dùng bộ cozy`); ART = 'cozy';
        cache.delete('assets/index.json');
        try { idx = await getJSON('assets/index.json', { fresh: true }); } catch { idx = {}; }
      } else idx = {};
    }
    for (const k of ['items', 'backgrounds', 'bags']) idx[k] = idx[k] || {};
    assetIndex = idx;
    return idx;
  })().finally(() => { indexInFlight = null; });
  return indexInFlight;
}

/** Nạp ảnh món. Truyền danh sách mã thì chỉ nạp bấy nhiêu. */
export async function loadItemManifests(ids) {
  const index = await loadAssetIndex();
  const list = ids || Object.keys(index.items).map(Number);
  await Promise.all(list.map(async id => {
    const path = index.items[id];
    if (!path) return;
    try {
      const def = applyManifest(await getJSON(path));
      if (def.sprite) await def.sprite.whenReady;
    } catch (e) { console.warn('manifest lỗi', id, e); }
  }));
}

/** Nạp ảnh nền. */
export async function loadBackgrounds(only) {
  const index = await loadAssetIndex();
  const ids = only || Object.keys(index.backgrounds).map(Number);
  await Promise.all(ids.map(async id => {
    const path = index.backgrounds[id];
    if (!path) return;
    try {
      const m = await getJSON(path);
      const layers = (m.layers || []).map(l => ({ ...l, img: loadImage(l.src) }));
      await Promise.all(layers.map(l => whenLoaded(l.img)));
      registerImageScene(id, { ...m, layers });
    } catch (e) { console.warn('nền lỗi', id, e); }
  }));
  return ids;
}

/** Nạp ảnh ba lớp của từng kiểu túi. */
export async function loadBags(only) {
  const index = await loadAssetIndex();
  const kinds = only || Object.keys(index.bags);
  await Promise.all(kinds.map(async kind => {
    const path = index.bags[kind];
    if (!path) return;
    try {
      const def = await getJSON(path);
      const img = {};
      for (const [k, src] of Object.entries(def.layers || {})) img[k] = loadImage(src);
      await Promise.all(Object.values(img).map(whenLoaded));
      registerBagSkin(def.id, { ...def, img });
    } catch (e) { console.warn('túi lỗi', kind, e); }
  }));
  return kinds;
}

/**
 * Nạp đúng phần art một chương cần; bỏ trống thì nạp cả kho.
 * Hộp bí ẩn (-1) và chìa khoá (0) luôn nạp kèm: level chỉ ghi mã món THẬT bị giấu,
 * không ghi mã hộp, nên chúng không bao giờ xuất hiện trong danh sách tính tự động.
 */
const LUON_CAN = [-1, 0];
export async function loadChapterAssets(ch) {
  const a = ch?.assets;
  const items = a?.items ? [...new Set([...a.items, ...LUON_CAN])] : undefined;
  await Promise.all([loadItemManifests(items), loadBackgrounds(a?.backgrounds), loadBags(a?.bags)]);
}

const loadImage = src => { const el = new Image(); el.src = assetPath(src); return el; };
const whenLoaded = el => new Promise(res => {
  if (el.complete && el.naturalWidth) return res();
  el.onload = el.onerror = res;
});

/** Gộp manifest vào ITEM_DEFS: tạo def mới nếu mã chưa có (món chỉ có ảnh) */
export function applyManifest(m) {
  let def = defById(m.id);
  if (!def) {
    def = { id: Number(m.id), slug: m.slug || `item${m.id}`, code: m.code || null,
            name: m.name || `Món ${m.id}`, kind: 'rect', w: 40, h: 40, box: [-20, -20, 20, 20],
            meta: { size: 'Medium', shape: 'Rectangle', physics: 'normal', cost: 1, canLink: true, canLock: true } };
    ITEM_DEFS.push(def);
  }
  if (m.name) def.name = m.name;
  if (m.meta) def.meta = { ...def.meta, ...m.meta };
  applyCollider(def, m.collider);
  if (m.sprite) {
    const img = loadImage(m.sprite.src);
    const sprite = { img, ppu: m.sprite.pixelsPerUnit || 3, ready: false };
    sprite.whenReady = whenLoaded(img).then(() => {
      sprite.ready = !!img.naturalWidth;
      onSpriteReady.forEach(fn => fn(def));
      return def;
    });
    def.sprite = sprite;
  }
  return def;
}

const onSpriteReady = [];
export function whenSpriteReady(fn) { onSpriteReady.push(fn); }

// ---------- ghi (chỉ editor dùng, qua cầu ghi của server dev) ----------
async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'ghi thất bại');
  return res.json();
}
export async function saveContent(path, text) { cache.delete(path); return post('/__content/save', { path, text }); }
export async function deleteContent(path) { cache.delete(path); return post('/__content/delete', { path }); }

/** Thư mục chương mà art MỚI sẽ được đặt vào. Editor đặt lại mỗi khi đổi chương. */
let assetChapter = 'assets/01-school-day';
export function setAssetChapter(folder) { if (folder) assetChapter = folder.replace(/^assets\//, 'assets/'); }

/** Art này đang nằm ở file nào; chưa có thì trả chỗ mặc định trong thư mục chương hiện tại */
export async function assetHome(kind, id) {
  const index = await loadAssetIndex();
  return index[kind]?.[id] || `${assetChapter}/${kind}/${id}.json`;
}

/** Ghi một mục vào mục lục art rồi lưu lại */
export async function indexAsset(kind, id, path) {
  const index = await loadAssetIndex(true);
  index[kind][id] = path;
  await saveContent('assets/index.json', JSON.stringify(index, null, 2));
  assetIndex = index;
  return index;
}
