// Ghi levels.json thẳng lên GitHub, dùng khi editor chạy trên GitHub Pages.
//
// Ghi hai file: public/content/<bộ art>/levels.json và public/content/config.json. Commit xong, workflow Pages
// tự chạy lại khoảng 40 giây là người chơi nhận được.
//
// Token do chính người dùng dán vào, cất trong localStorage của trình duyệt họ, chỉ gửi tới
// api.github.com. Cấp quyền Contents: Read and write cho đúng repo này là đủ.
import { artStyle } from '../content/loader.js';

const API = 'https://api.github.com';
const KEY = 'snug.gh.token';

/** Repo đích, nhúng sẵn lúc build nên không ai phải điền */
export const REPO = {
  owner: import.meta.env.VITE_GH_OWNER || 'duybvsmartmove',
  repo: import.meta.env.VITE_GH_REPO || 'Snug',
  branch: import.meta.env.VITE_GH_BRANCH || 'main',
};
/** File sắp xếp của bộ art đang mở: mỗi bộ có level riêng */
const bookPath = () => `public/content/${artStyle()}/levels.json`;

export const readToken = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const writeToken = t => { try { localStorage.setItem(KEY, t); } catch {} };
export const clearToken = () => { try { localStorage.removeItem(KEY); } catch {} };
export const hasToken = () => !!readToken();

/** Chuỗi UTF-8 → base64, chịu được tiếng Việt */
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function call(path, init, token) {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try { msg = (await res.json()).message || msg; } catch {}
    if (res.status === 401) msg = 'token sai hoặc đã hết hạn';
    if (res.status === 403) msg = 'token không có quyền ghi vào repo này';
    if (res.status === 404) msg = 'không thấy repo hoặc token thiếu quyền Contents';
    if (res.status === 409) msg = 'file vừa bị người khác sửa, tải lại trang rồi thử lại';
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

/** Kiểm tra token có quyền ghi không */
export async function check(token = readToken()) {
  const r = await call(`/repos/${REPO.owner}/${REPO.repo}`, {}, token);
  if (!r.permissions?.push) throw new Error('token đọc được repo nhưng không có quyền ghi');
  return r.full_name;
}

/** Ghi một file văn bản của repo thành một commit */
async function putFile(path, text, message) {
  const token = readToken();
  if (!token) throw new Error('chưa có token');
  const url = `/repos/${REPO.owner}/${REPO.repo}/contents/${encodeURI(path)}`;

  let sha;
  try { sha = (await call(`${url}?ref=${REPO.branch}`, {}, token)).sha; } catch {}

  const r = await call(url, {
    method: 'PUT',
    body: JSON.stringify({ message, content: toBase64(text), branch: REPO.branch, ...(sha ? { sha } : {}) }),
  }, token);
  return { commit: r.commit.sha.slice(0, 7) };
}

/** Ghi levels.json của bộ art đang mở thành một commit */
export const putBook = (book, note = '') => putFile(bookPath(), JSON.stringify(book, null, 2),
  `content(${artStyle()}): sắp xếp level v${book.version}${note ? ' — ' + note : ''}`);

/** Ghi config.json (bộ art game đang dùng) thành một commit */
export const putConfig = cfg => putFile('public/content/config.json', JSON.stringify(cfg, null, 2) + '\n',
  `content: game dùng bộ art ${cfg.art}`);
