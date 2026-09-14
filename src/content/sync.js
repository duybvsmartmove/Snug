// Luồng kiểm tra và tải bản content mới.
//
// Thứ tự quan trọng: dựng từ cache TRƯỚC, hỏi mạng SAU. Game không bao giờ đứng chờ mạng —
// mất mạng thì chơi bản đã lưu, có mạng thì âm thầm cập nhật ở nền.
//
//   1. Đọc manifest đang lưu  → trả về ngay để game dựng màn hình
//   2. Tải live.json           → khoảng 60 byte
//   3. Cùng số hiệu bản?       → dừng, không tải gì thêm
//   4. Khác  → tải v<N>/index.json, so hash từng file
//   5. Chỉ tải những file thật sự khác, ghi vào kho
//   6. Đổi con trỏ ở máy
import { getFile, putFile, readVersion, writeVersion } from './store.js';

const MANIFEST_KEY = '__manifest';
const key = (v, path) => `v${v}/${path}`;

const fetchJSON = async (url, noStore) => {
  const res = await fetch(url, noStore ? { cache: 'no-store' } : undefined);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

/**
 * Đồng bộ content với server.
 * @param {string} root thư mục gốc content, ví dụ './content/'
 * @param {(msg:string)=>void} [onProgress]
 * @returns {{version:number, base:string, changed:string[], offline:boolean, firstRun:boolean}}
 */
export async function syncContent(root, onProgress = () => {}) {
  const cached = await getFile(MANIFEST_KEY);
  const localVersion = cached?.version || readVersion() || 0;

  let live;
  try {
    live = await fetchJSON(root + 'live.json', true);
  } catch (e) {
    // Không hỏi được server: dùng bản đã lưu. Chưa có bản nào thì để người gọi lo tiếp.
    onProgress('không kết nối được, dùng bản đã lưu');
    return { version: localVersion, base: `${root}v${localVersion}/`, changed: [], offline: true, firstRun: !localVersion };
  }

  if (live.version === localVersion && cached) {
    return { version: localVersion, base: `${root}v${localVersion}/`, changed: [], offline: false, firstRun: false };
  }

  onProgress(`có bản content mới: v${live.version}`);
  const base = `${root}v${live.version}/`;
  const index = await fetchJSON(base + 'index.json', true);

  // So hash để biết đúng file nào đổi. Sửa một level thì chỉ tải về một file đó.
  const changed = [];
  for (const [path, info] of Object.entries(index.files || {})) {
    const old = cached?.files?.[path];
    if (old && old.hash === info.hash) {
      const carried = await getFile(key(localVersion, path));
      if (carried !== undefined) { await putFile(key(live.version, path), carried); continue; }
    }
    changed.push(path);
  }

  let done = 0;
  for (const path of changed) {
    try {
      await putFile(key(live.version, path), await fetchJSON(base + path, true));
      onProgress(`tải ${++done}/${changed.length}`);
    } catch (e) { console.warn('không tải được', path, e.message); }
  }

  await putFile(MANIFEST_KEY, index);
  writeVersion(live.version);
  return { version: live.version, base, changed, offline: false, firstRun: !localVersion };
}

/** Đọc một file content từ kho; chưa có thì tải thẳng từ server */
export async function readContent(version, base, path) {
  const hit = await getFile(key(version, path));
  if (hit !== undefined) return hit;
  const data = await fetchJSON(base + path, false);
  await putFile(key(version, path), data);
  return data;
}
