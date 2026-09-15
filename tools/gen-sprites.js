// Sinh sprite PNG từ art đang vẽ bằng code.
//
// Mỗi món được vẽ ra một canvas riêng ở tỉ lệ 4×, mỗi bối cảnh ra một ảnh nền 2×,
// mỗi chiếc túi ra hai lớp (sau lưng đồ và đè lên đồ). Ảnh ghi vào bản nháp cùng
// manifest, nên game đọc được ngay mà không phải sửa code.
//
// Ảnh được căn sao cho TÂM ẢNH trùng TRỌNG TÂM body vật lý — đúng cách render.js
// vẽ sprite — nếu không món sẽ lệch so với vùng va chạm.
import { ITEM_DEFS, MYSTERY } from '../src/data/items.js';
import { ART } from './legacy-art/items.js';
import { makeItem } from '../src/game/physics.js';
import { canvas, ctx } from '../src/game/canvas.js';
import { W, H, BAG, setContainer, S } from '../src/game/state.js';
import { drawScene } from './legacy-art/scenes.js';
import { paintBody, paintLining, paintFrame } from './legacy-art/bags.js';
import { BAG_KINDS } from '../src/art/scene-registry.js';
import { saveContent, saveBinary } from '../src/content/loader.js';

// Ảnh xếp theo chương cho gọn. Món dùng lại ở chương sau thì giữ nguyên chỗ cũ,
// chỉ cần thêm một dòng trong assets/index.json — không nhân bản file.
// Chương mà art MỚI sẽ được đặt vào. Art đã có giữ nguyên chỗ cũ theo mục lục,
// nên chương sau dùng lại món cũ không nhân bản file.
const CHAPTER = new URLSearchParams(location.search).get('chapter') || '01-school-day';

// Món, bối cảnh, kiểu túi của riêng chương này. Bỏ trống = làm tất.
const ONLY = {
  '01-school-day':   { items: null, backgrounds: [1, 2, 3], bags: ['lunchbox', 'tote', 'backpack'] },
  '02-weekend-trip': { items: id => id >= 31 && id <= 52, backgrounds: [4, 5], bags: ['suitcase', 'pouch'] },
};

const ITEM_SCALE = 4;        // ảnh món lớn gấp 4 lần kích thước trong game
const BG_SCALE = 2;          // nền lớn gấp 2
const BAG_SCALE = 3;
const PAD = 4;               // chừa chỗ cho nét viền tràn ra ngoài khung

const logEl = document.getElementById('log');
const sheetEl = document.getElementById('sheet');
const log = m => { logEl.textContent += m + '\n'; logEl.scrollTop = logEl.scrollHeight; };

const toBase64 = (cv, type = 'image/png', q) => new Promise(res => cv.toBlob(b => {
  const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(b);
}, type, q));

/** Ghi ảnh PNG và trả về đường dẫn để đưa vào manifest */
async function saveImage(pathNoExt, cv) {
  await saveBinary(`${pathNoExt}.png`, await toBase64(cv, 'image/png'));
  return `${pathNoExt}.png`;
}

function preview(cv, label) {
  const t = document.createElement('canvas');
  const k = Math.min(1, 56 / Math.max(cv.width, cv.height));
  t.width = Math.max(1, cv.width * k); t.height = Math.max(1, cv.height * k);
  t.title = label;
  t.getContext('2d').drawImage(cv, 0, 0, t.width, t.height);
  sheetEl.appendChild(t);
}

const only = () => ONLY[CHAPTER] || { items: null, backgrounds: null, bags: null };

/** Chỗ đang lưu art này; chưa có thì đặt vào thư mục chương đang sinh */
const homeOf = (index, kind, id, file) => {
  const old = index[kind]?.[id];
  if (old) return old.slice(0, old.lastIndexOf('/'));
  return `assets/${CHAPTER}/${file}`;
};

/** Đọc mục lục hiện có để giữ lại những gì chương khác đã đăng ký */
async function loadIndex() {
  const empty = { items: {}, backgrounds: {}, bags: {} };
  try {
    // đường dẫn tuyệt đối: trang này nằm trong /tools/ nên đường tương đối sẽ trượt
    const r = await fetch(`/content/draft/assets/index.json?t=${Date.now()}`);
    if (!r.ok) return empty;
    return { ...empty, ...(await r.json()) };
  } catch { return empty; }
}

// ---------- món ----------
async function genItems(index) {
  const defs = [...ITEM_DEFS];
  if (MYSTERY && !defs.includes(MYSTERY)) defs.push(MYSTERY);
  const pick = only().items;
  const ids = [];

  for (const def of defs) {
    const draw = ART[def.slug];
    if (!draw) { log(`bỏ qua #${def.id} ${def.slug}: không có hàm vẽ`); continue; }
    if (pick && !pick(def.id)) continue;

    // origin = độ lệch từ trọng tâm body về gốc toạ độ vẽ
    const body = makeItem(def, 0, 0);
    const ox = body.origin.x, oy = body.origin.y;
    const [x0, y0, x1, y1] = def.box;
    // khung đối xứng quanh trọng tâm, để tâm ảnh trùng tâm body
    const hw = Math.max(Math.abs(x0 + ox), Math.abs(x1 + ox)) + PAD;
    const hh = Math.max(Math.abs(y0 + oy), Math.abs(y1 + oy)) + PAD;

    const cv = document.createElement('canvas');
    cv.width = Math.ceil(hw * 2 * ITEM_SCALE);
    cv.height = Math.ceil(hh * 2 * ITEM_SCALE);
    const c = cv.getContext('2d');
    c.setTransform(ITEM_SCALE, 0, 0, ITEM_SCALE, cv.width / 2, cv.height / 2);
    c.translate(ox, oy);
    c.lineJoin = 'round'; c.lineCap = 'round';
    draw(c);

    const dir = homeOf(index, 'items', def.id, 'items');
    const src = await saveImage(`${dir}/${def.id}`, cv);
    // Không ghi collider: hình vật lý giữ nguyên theo data/items.js, chỉ thay phần nhìn
    const manifestPath = `${dir}/${def.id}.json`;
    await saveContent(manifestPath, JSON.stringify({
      id: def.id, slug: def.slug, code: def.code || null, name: def.name,
      meta: def.meta,
      sprite: { src, pixelsPerUnit: ITEM_SCALE },
    }, null, 2));

    ids.push([def.id, manifestPath]);
    preview(cv, `#${def.id} ${def.slug}`);
    log(`món #${def.id} ${def.slug.padEnd(14)} ${cv.width}×${cv.height}`);
  }

  return ids;
}

// ---------- bối cảnh ----------
async function genBackgrounds(index) {
  const NAMES = { 1: 'Góc học tập · sáng', 2: 'Góc học tập · trưa', 3: 'Góc học tập · chiều',
                  4: 'Phòng ngủ · ban ngày', 5: 'Phòng ngủ · chiều tối' };
  const ids = [];
  for (const id of (only().backgrounds || [1, 2, 3, 4, 5])) {
    canvas.width = W * BG_SCALE; canvas.height = H * BG_SCALE;
    ctx.setTransform(BG_SCALE, 0, 0, BG_SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    S.LEVEL = { background: id };
    drawScene();

    const cv = document.createElement('canvas');
    cv.width = canvas.width; cv.height = canvas.height;
    cv.getContext('2d').drawImage(canvas, 0, 0);

    const bdir = homeOf(index, 'backgrounds', id, 'backgrounds');
    const src = await saveImage(`${bdir}/bg-${id}`, cv);
    const manifestPath = `${bdir}/${id}.json`;
    await saveContent(manifestPath, JSON.stringify({
      id, name: NAMES[id], fill: '#F2EAD2',
      layers: [{ src, x: 0, y: 0, w: W }],
    }, null, 2));
    ids.push([id, manifestPath]);
    preview(cv, `nền ${id}`);
    log(`nền  #${id} ${NAMES[id].padEnd(22)} ${cv.width}×${cv.height}`);
  }
  return ids;
}

// ---------- túi ----------
// Túi vẽ theo khung bao của lòng túi, nên sinh ở một khung chuẩn rồi lúc chơi kéo giãn
// cho khớp khung thật của từng level. Lòng túi vẫn cắt theo polygon nên hình khuyết góc,
// chữ L… vẫn đúng.
const BAG_BOX = { innerW: 260, innerH: 220 };
const BAG_MARGIN = 30;                 // lề quanh khung lòng túi, chừa chỗ cho quai và nắp
const EDGE = { lunchbox: '#B92A38', tote: '#2A8B84', backpack: '#33489C' };

/** Vẽ một lớp rồi cắt đúng vùng cần, trả về canvas */
function shoot(paint, x0, y0, x1, y1) {
  canvas.width = W * BAG_SCALE; canvas.height = H * BAG_SCALE;
  ctx.setTransform(BAG_SCALE, 0, 0, BAG_SCALE, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = 'round';
  paint();
  const sx = Math.round(x0 * BAG_SCALE), sy = Math.round(y0 * BAG_SCALE);
  const sw = Math.round((x1 - x0) * BAG_SCALE), sh = Math.round((y1 - y0) * BAG_SCALE);
  const cv = document.createElement('canvas');
  cv.width = sw; cv.height = sh;
  cv.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return cv;
}

async function genBags(index) {
  const want = only().bags;
  const out = [];
  for (const { id: kind, name } of BAG_KINDS) {
    if (want && !want.includes(kind)) continue;
    const gdir = homeOf(index, 'bags', kind, 'bags');
    const { innerW: w, innerH: h } = BAG_BOX;
    setContainer({
      skin: kind, cx: W / 2, bottom: H / 2 + h / 2,
      shape: [[-w / 2, -h], [w / 2, -h], [w / 2, 0], [-w / 2, 0]],
    });
    S.LEVEL = { background: 1 };

    const M = BAG_MARGIN;
    const box = [BAG.BL - M, BAG.BT - M, BAG.BR + M, BAG.BB + M];
    const layers = {};

    // thân: nằm sau đồ, kéo giãn theo khung túi
    let cv = shoot(() => paintBody(false), ...box);
    layers.body = await saveImage(`${gdir}/${kind}-body`, cv);
    preview(cv, `${kind} body`); log(`túi  ${kind}-body`.padEnd(24) + `${cv.width}×${cv.height}`);

    // lót: cắt đúng khung lòng túi, lúc chơi sẽ clip theo polygon của level
    cv = shoot(paintLining, BAG.left, BAG.top, BAG.right, BAG.bottom);
    layers.lining = await saveImage(`${gdir}/${kind}-lining`, cv);
    preview(cv, `${kind} lining`); log(`túi  ${kind}-lining`.padEnd(24) + `${cv.width}×${cv.height}`);

    // khung: đè lên đồ, đã bỏ ngăn khoá và mép lòng túi vì hai thứ đó theo từng level
    cv = shoot(paintFrame, ...box);
    layers.frame = await saveImage(`${gdir}/${kind}-frame`, cv);
    preview(cv, `${kind} frame`); log(`túi  ${kind}-frame`.padEnd(24) + `${cv.width}×${cv.height}`);

    const manifestPath = `${gdir}/${kind}.json`;
    await saveContent(manifestPath, JSON.stringify(
      { id: kind, name, margin: M, edge: EDGE[kind], pixelsPerUnit: BAG_SCALE, layers }, null, 2));
    out.push([kind, manifestPath]);
  }
  return out;
}

document.getElementById('run').addEventListener('click', async e => {
  e.target.disabled = true;
  logEl.textContent = ''; sheetEl.innerHTML = '';
  try {
    const index = await loadIndex();
    const a = await genItems(index);
    const b = await genBackgrounds(index);
    const c = await genBags(index);

    // Mục lục nối mã số với file mô tả. Nhờ nó, ảnh nằm ở thư mục chương nào cũng được,
    // và chương sau dùng lại món cũ chỉ cần trỏ vào đúng dòng này.
    for (const [id, path] of a) index.items[id] = path;
    for (const [id, path] of b) index.backgrounds[id] = path;
    for (const [id, path] of c) index.bags[id] = path;
    await saveContent('assets/index.json', JSON.stringify(index, null, 2));

    log(`\nxong: ${a.length} món · ${b.length} bối cảnh · ${c.length} chiếc túi`);
    log(`mục lục: assets/index.json`);
    log('sang editor bấm Phát hành để người chơi nhận được');
  } catch (err) {
    log('LỖI: ' + (err?.stack || err));
  } finally { e.target.disabled = false; }
});
