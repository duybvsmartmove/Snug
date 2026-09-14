// Đóng gói bản nháp thành một bản phát hành bất biến.
//
//   content/
//     draft/            ← editor ghi vào đây, sửa liên tục, người chơi không thấy
//     v1/ v2/ v3/       ← bản đã phát hành, chỉ chứa JSON, không bao giờ sửa lại
//     assets/           ← ảnh, tên có hash nội dung, dùng chung cho mọi bản
//     live.json         ← con trỏ: bản nào đang phát hành
//
// Hai tính chất quan trọng:
//   · Nguyên tử — ghi xong toàn bộ v<N>/ rồi mới ghi live.json. Hỏng giữa chừng thì
//     live.json vẫn trỏ bản cũ, người chơi không thấy trạng thái nửa vời.
//   · Quay lui — bản mới lỗi thì đổi live.json về số cũ là xong, không cần build lại.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync, copyFileSync } from 'node:fs';
import { join, relative, extname, basename, dirname } from 'node:path';

const BIN = new Set(['.png', '.webp', '.jpg', '.jpeg', '.svg', '.gif', '.mp3', '.ogg']);
const hash8 = buf => createHash('sha256').update(buf).digest('hex').slice(0, 8);

/** Liệt kê mọi file trong thư mục, trả về đường dẫn tương đối */
function walk(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(relative(base, full));
  }
  return out;
}

const writeFile = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };

/** Thay mọi chuỗi đường dẫn ảnh trong JSON bằng đường dẫn có hash */
function remap(node, map) {
  if (typeof node === 'string') return map.get(node) ?? node;
  if (Array.isArray(node)) return node.map(v => remap(v, map));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = remap(v, map);
    return out;
  }
  return node;
}

export const readLive = root => {
  const p = join(root, 'live.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { version: 0 };
};

export const listReleases = root =>
  readdirSync(root).filter(n => /^v\d+$/.test(n) && statSync(join(root, n)).isDirectory())
    .map(n => Number(n.slice(1))).sort((a, b) => a - b);

/**
 * Phát hành bản nháp hiện tại.
 * @param {string} root thư mục content (chứa draft/, live.json)
 * @returns {{version:number, files:number, assets:number, changed:string[]}}
 */
export function publish(root, { note = '' } = {}) {
  const draft = join(root, 'draft');
  if (!existsSync(draft)) throw new Error('không thấy thư mục draft');

  // Hai file danh mục này luôn phải có, thiếu là game báo lỗi tải mỗi lần mở
  for (const rel of ['assets/items/index.json', 'assets/backgrounds/index.json']) {
    const f = join(draft, rel);
    if (!existsSync(f)) writeFile(f, JSON.stringify({ [rel.includes('items') ? 'items' : 'backgrounds']: [] }));
  }

  const prev = readLive(root).version || 0;
  const version = Math.max(prev, ...listReleases(root).concat(0)) + 1;
  const vdir = join(root, `v${version}`);

  // 1. Ảnh: đặt tên theo hash nội dung, để dùng chung giữa các bản và cache vĩnh viễn
  const assetMap = new Map();
  let assetCount = 0;
  const all = walk(draft);
  const webpTwin = new Set(all.filter(r => r.endsWith('.webp')).map(r => r.slice(0, -5)));
  for (const rel of all) {
    const ext = extname(rel).toLowerCase();
    if (!BIN.has(ext)) continue;
    // .png là bản gốc để mang sang Unity, đã nằm trong repo; bản phát hành chỉ cần .webp
    if (ext === '.png' && webpTwin.has(rel.slice(0, -4))) continue;
    const buf = readFileSync(join(draft, rel));
    const name = `${basename(rel, ext)}.${hash8(buf)}${ext}`;
    const dest = join(root, 'assets', name);
    if (!existsSync(dest)) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(join(draft, rel), dest); }
    assetMap.set(rel, `../assets/${name}`);
    assetCount++;
  }

  // 2. JSON: đổi đường dẫn ảnh sang bản có hash, ghi vào v<N>/, ghi kèm hash từng file
  const files = {};
  const changed = [];
  const prevIndex = prev ? readIndex(root, prev) : null;
  for (const rel of all) {
    if (!rel.endsWith('.json')) continue;
    const text = JSON.stringify(remap(JSON.parse(readFileSync(join(draft, rel), 'utf8')), assetMap));
    const h = hash8(Buffer.from(text));
    writeFile(join(vdir, rel), text);
    files[rel] = { hash: h, size: Buffer.byteLength(text) };
    if (!prevIndex || prevIndex.files?.[rel]?.hash !== h) changed.push(rel);
  }

  // 3. Manifest của bản này
  const index = { version, publishedAt: new Date().toISOString(), note, files };
  writeFile(join(vdir, 'index.json'), JSON.stringify(index, null, 2));

  // 4. Bước cuối cùng: đổi con trỏ. Trước dòng này người chơi vẫn đang ở bản cũ.
  writeFile(join(root, 'live.json'), JSON.stringify({ version, publishedAt: index.publishedAt, note }, null, 2));

  return { version, files: Object.keys(files).length, assets: assetCount, changed };
}

export function readIndex(root, version) {
  const p = join(root, `v${version}`, 'index.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

/** Quay lui về một bản đã phát hành */
export function rollback(root, version) {
  if (!listReleases(root).includes(version)) throw new Error(`chưa từng phát hành bản v${version}`);
  const idx = readIndex(root, version) || {};
  writeFile(join(root, 'live.json'), JSON.stringify({ version, publishedAt: idx.publishedAt, note: idx.note || '' }, null, 2));
  return { version };
}

// Chạy trực tiếp: node tools/publish.mjs [publish|rollback <n>|status]
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = join(process.cwd(), 'public/content');
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'rollback') console.log(rollback(root, Number(arg)));
  else if (cmd === 'status') console.log({ live: readLive(root), releases: listReleases(root) });
  else console.log(publish(root, { note: arg || '' }));
}
