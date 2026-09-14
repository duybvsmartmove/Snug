// Kho lưu content ở máy người chơi.
//
// Chia hai chỗ theo đúng loại dữ liệu:
//   · JSON (pack, map, level, manifest) → IndexedDB. Không vướng trần 5MB, bất đồng bộ.
//   · Ảnh                                → Cache Storage. Sinh ra để giữ nguyên response ảnh.
// localStorage chỉ giữ mỗi số hiệu bản đang dùng, vài byte, cần đọc ngay lúc khởi động.
//
// Cả ba API chạy nguyên trong WebView của Capacitor nên lên mobile không phải viết lại.
// Trình duyệt chặn (cửa sổ ẩn danh, xoá dữ liệu trang) thì tự lùi về bộ nhớ tạm trong RAM.

const DB_NAME = 'snug-content', DB_VER = 1, STORE = 'files', ASSET_CACHE = 'snug-assets';
const VERSION_KEY = 'snug.content.version';

const mem = new Map();          // phương án lùi khi IndexedDB không dùng được
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }).catch(e => { console.warn('IndexedDB không dùng được, lùi về bộ nhớ tạm:', e.message); return null; });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), req = fn(t.objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }).catch(() => null);
}

export async function getFile(key) {
  const v = await tx('readonly', s => s.get(key));
  return v !== null && v !== undefined ? v : mem.get(key);
}
export async function putFile(key, value) {
  mem.set(key, value);
  await tx('readwrite', s => s.put(value, key));
}
export async function deleteFile(key) {
  mem.delete(key);
  await tx('readwrite', s => s.delete(key));
}
export async function clearFiles() {
  mem.clear();
  await tx('readwrite', s => s.clear());
}

// ---------- số hiệu bản đang dùng ----------
export function readVersion() {
  try { return Number(localStorage.getItem(VERSION_KEY)) || 0; } catch { return 0; }
}
export function writeVersion(v) {
  try { localStorage.setItem(VERSION_KEY, String(v)); } catch {}
}

// ---------- ảnh ----------
/**
 * Lấy ảnh dùng được cho <img>. Có trong Cache Storage thì dùng bản đã lưu (chạy được cả khi mất mạng),
 * chưa có thì tải rồi lưu lại. Tên file ảnh đã gắn hash nội dung nên không bao giờ cần làm mới.
 */
export async function assetURL(url) {
  try {
    if (typeof caches === 'undefined') return url;
    const c = await caches.open(ASSET_CACHE);
    let res = await c.match(url);
    if (!res) { await c.add(url); res = await c.match(url); }
    if (!res) return url;
    return URL.createObjectURL(await res.blob());
  } catch { return url; }
}

/** Tải sẵn một loạt ảnh vào Cache Storage, dùng lúc máy rảnh */
export async function prefetchAssets(urls) {
  try {
    if (typeof caches === 'undefined') return 0;
    const c = await caches.open(ASSET_CACHE);
    let n = 0;
    for (const u of urls) if (!(await c.match(u))) { await c.add(u).then(() => n++).catch(() => {}); }
    return n;
  } catch { return 0; }
}

/** Xoá ảnh không còn bản nào dùng tới */
export async function pruneAssets(keep) {
  try {
    if (typeof caches === 'undefined') return 0;
    const c = await caches.open(ASSET_CACHE), keepSet = new Set(keep);
    let n = 0;
    for (const req of await c.keys()) if (!keepSet.has(new URL(req.url).pathname)) { await c.delete(req); n++; }
    return n;
  } catch { return 0; }
}
