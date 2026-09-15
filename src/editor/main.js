// Level Editor: điều phối tab, level hiện tại, live preview (iframe game), bảng đo, lưu content.
import { ITEM_DEFS, defById } from '../data/items.js';
import { loadBook, loadItemManifests, loadBackgrounds, loadBags, saveContent, whenSpriteReady, setAssetChapter } from '../content/loader.js';
import { sceneOptions, BAG_KINDS } from '../art/scene-registry.js';
import { itemArea } from '../game/physics.js';
import { difficulty } from '../gen/difficulty.js';
import { solve } from '../gen/solver.js';
import { pointInPolygon } from '../util/geom.js';
import { initDraw } from './draw.js';
import { initGenerate } from './generate.js';
import { initPool } from './pool.js';
import { initManage, nextLevelId } from './manage.js';
import * as gh from './github.js';

const $ = id => document.getElementById(id);
const areaCache = new Map();
export const areaOf = id => { if (!areaCache.has(id)) { const d = defById(id); areaCache.set(id, d ? itemArea(d) : 0); } return areaCache.get(id); };
export const clearAreaCache = () => areaCache.clear();

export const E = { mapId: null, book: null, map: null, level: null, previewReady: false };

// ---------- status ----------
export function status(text, cls = '') { const s = $('status'); s.textContent = text; s.className = 'status ' + cls; if (text) setTimeout(() => { if (s.textContent === text) s.textContent = ''; }, 3000); }

// ---------- level model ----------
export function blankLevel(id) {
  return {
    id, name: 'Level mới', timer: 90, background: 'vanity',
    container: { skin: 'backpack', cx: 210, bottom: 404, shape: [[-127, -220], [127, -220], [127, 0], [-127, 0]], blocks: [] },
    mode: 'fixed', items: [], reward: { coin: 20 }, background: 1,
  };
}
const clone = o => JSON.parse(JSON.stringify(o));

let draw, gen, pool;
export function setLevel(level, { keepId = false } = {}) {
  if (keepId && E.level) level.id = E.level.id;
  E.level = level;
  $('lvName').value = level.name || ''; $('lvTimer').value = level.timer || 90;
  refreshPickers();
  $('lvCoin').value = level.reward?.coin ?? 20;
  onChange();
}
/** Gọi sau mỗi thay đổi: vẽ lại, đo lại, đẩy preview */
export function onChange() {
  draw?.render();
  metrics();
  pushPreview();
}

// ---------- live preview ----------
// Khung xem thử là chính game, chạy trong iframe cùng origin
const frame = $('game');
frame.src = './index.html?preview=1';
let pushT = null;
function pushPreview() {
  clearTimeout(pushT);
  pushT = setTimeout(() => {
    if (!E.previewReady || !E.level) return;
    const idx = E.map ? Math.max(0, E.map.levels.indexOf(E.level.id)) : 0;
    frame.contentWindow.postMessage({ type: 'level', level: clone(E.level), index: idx, chapter: { no: E.map.no || 1, name: E.map.name || '' } }, '*');
    frame.contentWindow.postMessage({ type: 'timer', on: $('timerToggle').checked }, '*');
  }, 200);
}
window.addEventListener('message', e => { if (e.data?.type === 'ready') { E.previewReady = true; pushPreview(); } });

// ---------- lưu sắp xếp ----------
// Mọi chương và level nằm trong MỘT file: content/levels.json của repo game.
// Bấm Phát hành là ghi lại file đó, game đọc thẳng từ máy, không qua mạng.
export async function publish(note = '') {
  const b = E.book;
  b.version = (b.version || 0) + 1;
  b.publishedAt = new Date().toISOString();
  if (note) b.note = note;
  for (const ch of b.chapters) {
    const items = new Set(), bgs = new Set(), bags = new Set();
    for (const lv of ch.levels) {
      for (const it of lv.items || []) items.add(Number(it.id));
      if (lv.background != null) bgs.add(Number(lv.background));
      if (lv.container?.skin) bags.add(lv.container.skin);
    }
    ch.assets = { items: [...items].sort((a, c) => a - c), backgrounds: [...bgs].sort((a, c) => a - c), bags: [...bags].sort() };
  }
  const text = JSON.stringify(b, null, 2);
  if (canWrite) await saveContent('levels.json', text);          // chạy ở máy: ghi thẳng ra file
  else if (gh.hasToken()) await gh.putBook(b);                    // trên web: commit lên GitHub
  else throw new Error('chưa nối GitHub — bấm nút 🔑 để dán token');
  return b.version;
}

// Trang tĩnh (GitHub Pages, vite preview) không có cầu ghi file. Dò một lần lúc khởi động.
let canWrite = false;
async function probeWriter() {
  try { canWrite = (await (await fetch('/__content/ping')).json())?.ok === true; }
  catch { canWrite = false; }
  return canWrite;
}

$('publishBtn').addEventListener('click', async () => {
  const btn = $('publishBtn');
  btn.disabled = true;
  try {
    const v = await publish();
    $('liveTag').textContent = `v${v}`;
    status(canWrite ? `Đã lưu sắp xếp · bản v${v}`
                    : `Đã đẩy lên GitHub · bản v${v}. Khoảng 40 giây nữa người chơi nhận được.`, 'ok');
    frame.contentWindow.postMessage({ type: 'assets' }, '*');
  } catch (e) { status('Lỗi lưu: ' + e.message, 'bad'); }
  finally { btn.disabled = false; }
});

// Tải file JSON về máy, dùng khi editor chạy trên web và không ghi thẳng được
$('downloadBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(E.book, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'levels.json'; a.click();
  URL.revokeObjectURL(a.href);
  status('Đã tải levels.json — chép vào snug/public/content/', 'ok');
});

// ---------- nối GitHub ----------
// Bản trên web không ghi file được, nên lưu bằng cách commit levels.json lên repo.
function paintGhTag() {
  $('ghTag').textContent = gh.hasToken() ? `${gh.REPO.owner}/${gh.REPO.repo}` : 'chưa nối';
  $('ghBtn').classList.toggle('warn', !gh.hasToken());
}
function openGh() {
  $('ghRepoName').textContent = `${gh.REPO.owner}/${gh.REPO.repo}`;
  $('ghBranchName').textContent = gh.REPO.branch;
  $('ghPath').textContent = gh.REPO.path;
  $('ghToken').value = gh.hasToken() ? '••••••••' : '';
  $('ghStatus').textContent = '';
  $('ghModal').hidden = false;
}
$('ghBtn').addEventListener('click', openGh);
$('ghClose').addEventListener('click', () => { $('ghModal').hidden = true; });
$('ghModal').addEventListener('click', e => { if (e.target === $('ghModal')) $('ghModal').hidden = true; });
$('ghSave').addEventListener('click', async () => {
  const typed = $('ghToken').value.trim();
  const token = typed === '••••••••' ? gh.readToken() : typed;
  if (!token) { $('ghStatus').textContent = 'Chưa dán token'; return; }
  $('ghStatus').textContent = 'đang kiểm tra…';
  try {
    const name = await gh.check(token);
    gh.writeToken(token);
    paintGhTag();
    $('ghStatus').textContent = `Đã nối ${name}`;
    setTimeout(() => { $('ghModal').hidden = true; }, 900);
  } catch (e) { $('ghStatus').textContent = 'Lỗi: ' + e.message; }
});
$('ghForget').addEventListener('click', () => {
  gh.clearToken(); paintGhTag();
  $('ghToken').value = '';
  $('ghStatus').textContent = 'Đã xoá token khỏi trình duyệt này';
});

// ---------- metrics ----------
function metrics() {
  const L = E.level; if (!L) return;
  const d = difficulty(L, areaOf);
  const sol = L.items.length ? solve(L, { tries: 40 }) : { solvable: true, tries: 0, needCount: 0 };
  const sv = $('solvable');
  if (!L.items.length) { sv.textContent = 'Chưa có món'; sv.className = 'solv'; }
  else if (sol.solvable) { sv.textContent = `Xếp được · ${sol.needCount}/${sol.needCount} món, sau ${sol.tries} lần thử`; sv.className = 'solv ok'; }
  else if (d.density <= .88) { sv.textContent = `Chặt tay · ước lượng xếp ${sol.placedCount}/${sol.needCount} món bằng khung chữ nhật`; sv.className = 'solv warn'; }
  else { sv.textContent = `Rất có thể không xếp nổi · ${sol.placedCount}/${sol.needCount} món, density ${(d.density * 100).toFixed(0)}%`; sv.className = 'solv bad'; }
  const pct = Math.min(100, d.density * 100);
  const bar = $('densBar'); bar.style.width = pct + '%'; bar.style.background = pct > 92 ? 'var(--bad)' : pct > 85 ? 'var(--warn)' : 'var(--ok)';
  $('kv').innerHTML = [
    ['density', `${(d.density * 100).toFixed(1)}%`],
    ['usable area', `${Math.round(d.usable).toLocaleString()} px²`],
    ['items area', `${Math.round(d.itemArea).toLocaleString()} px²`],
    ['items', `${d.count}`],
    ['timer', `${L.timer}s`],
    ['coin', `${L.reward?.coin ?? 0}`],
  ].map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  $('diffTotal').textContent = `${d.total} · ${d.tier}`;
  $('diffRows').innerHTML = d.rows.map(r => `<tr><td>${r.label}<span class="c">${r.cond}</span></td><td>${r.pts ? '+' + r.pts : 0}</td></tr>`).join('');

  // cảnh báo
  const warns = [];
  const locked = L.items.filter(i => i.locked), key = L.items.find(i => i.id === 'key');
  if (locked.length && !key) warns.push('Có hộp bí ẩn nhưng chưa có chìa khóa.');
  if (key && !key.inBag) warns.push('GDD: chìa khóa phải nằm sẵn trong túi (bật "In bag").');
  if (key?.inBag && !pointInPolygon(key.x ?? 0, key.y ?? -30, L.container.shape)) warns.push('Chìa khóa nằm ngoài lòng túi.');
  for (const it of L.items) if (it.link && !L.items.find(j => j.id === it.link)) warns.push(`${it.id} buộc dây với ${it.link} nhưng món đó không có trong level.`);
  const ids = L.items.map(i => i.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) warns.push('Trùng id: ' + [...new Set(dup)].join(', ') + ' (mỗi món chỉ 1 lần).');
  if (d.density > .95) warns.push('Density > 95%: gần như không xếp được với physics.');
  const wc = $('warnCard'); wc.hidden = !warns.length; wc.innerHTML = warns.map(w => `<div>⚠ ${w}</div>`).join('');
}

/** Đổ danh sách túi và nền vào hai ô chọn */
export function refreshPickers() {
  const skin = $('lvSkin');
  skin.innerHTML = BAG_KINDS.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  const bgs = sceneOptions();
  $('lvBg').innerHTML = bgs.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  if (E.level) { skin.value = E.level.container.skin || 'backpack'; $('lvBg').value = String(E.level.background ?? 1); }
}

// ---------- form ----------
$('lvName').addEventListener('input', e => { E.level.name = e.target.value; refreshLevelSelect(); onChange(); });
$('lvTimer').addEventListener('change', e => { E.level.timer = +e.target.value; onChange(); });
$('lvBg').addEventListener('change', e => { E.level.background = Number(e.target.value); onChange(); });
$('lvSkin').addEventListener('change', e => { E.level.container.skin = e.target.value; onChange(); });
$('lvCoin').addEventListener('change', e => { E.level.reward = { ...(E.level.reward || {}), coin: +e.target.value }; onChange(); });

// ---------- tabs ----------
$('tabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  [...$('tabs').children].forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab-page').forEach(p => (p.hidden = p.id !== 'tab-' + b.dataset.tab));
});

// ---------- xem thử: máy chơi hộ ----------
$('autoplayBtn').addEventListener('click', () => {
  frame.contentWindow.postMessage({ type: 'autoplay' }, '*');
  status('Máy đang xếp thử…', '');
});

// ---------- hộp thoại máy chọn đồ ----------
const genModal = $('genModal');
$('genBtn').addEventListener('click', () => { genModal.hidden = false; gen.refresh(); });
$('genClose').addEventListener('click', () => { genModal.hidden = true; });
genModal.addEventListener('click', e => { if (e.target === genModal) genModal.hidden = true; });
window.addEventListener('keydown', e => { if (e.key === 'Escape') genModal.hidden = true; });

// ---------- level list / save / assign ----------
const levelNames = new Map();   // id → tên hiển thị
/** Chương và level đều nằm trong E.book, không phải tải từng file nữa */
const levelItemIds = new Map();
function indexChapter() {
  levelNames.clear(); levelItemIds.clear();
  for (const lv of E.map.levels) {
    levelNames.set(lv.id, lv.name || lv.id);
    levelItemIds.set(lv.id, (lv.items || []).map(i => Number(i.id)));
  }
  E.levelNames = levelNames;
  E.levelItemIds = levelItemIds;
}

function refreshChapterSelect() {
  const sel = $('chapterSelect');
  sel.innerHTML = E.book.chapters.map(c => `<option value="${c.id}">Chương ${c.no} — ${c.name}</option>`).join('');
  sel.value = E.mapId;
}
function refreshLevelSelect() {
  const sel = $('levelSelect');
  sel.innerHTML = E.map.levels.map((lv, i) => `<option value="${lv.id}">Level ${i + 1} — ${lv.name || lv.id}</option>`).join('');
  if (E.level) sel.value = E.level.id;
  const n = E.map.levels.findIndex(l => l.id === E.level?.id);
  $('assignIdx').value = Math.max(1, n + 1 || E.map.levels.length + 1);
}

/** Mở một chương, kèm level chỉ định hoặc level đầu tiên */
export async function openChapter(mapId, levelId) {
  E.mapId = mapId;
  E.map = E.book.chapters.find(c => c.id === mapId) || E.book.chapters[0];
  E.mapId = E.map.id;
  setAssetChapter(`assets/${String(E.map.no || 1).padStart(2, '0')}-${E.mapId}`);
  indexChapter();
  const pick = E.map.levels.find(l => l.id === levelId) || E.map.levels[0];
  setLevel(pick ? clone(pick) : blankLevel(nextLevelId(E.mapId, [])));
  refreshChapterSelect(); refreshLevelSelect(); draw?.clearSelection();
  draw?.computeChapterItems(); pool?.computeChapterItems();
}
export async function openLevel(id) {
  const lv = E.map.levels.find(l => l.id === id);
  if (!lv) return;
  setLevel(clone(lv));
  refreshLevelSelect(); draw?.clearSelection();
}

$('chapterSelect').addEventListener('change', e => openChapter(e.target.value));
$('levelSelect').addEventListener('change', e => openLevel(e.target.value));
$('newLevel').addEventListener('click', () => {
  const id = nextLevelId(E.mapId, E.map.levels.map(l => l.id));
  const lv = blankLevel(id); if (E.level) lv.container = clone(E.level.container);
  setLevel(lv); $('assignIdx').value = E.map.levels.length + 1;
  status('Level mới, chưa lưu. Bấm Lưu để thêm vào chương.', '');
});

/** Ghi level đang sửa vào chương, rồi lưu cả file sắp xếp */
async function saveLevel(level) {
  const i = E.map.levels.findIndex(l => l.id === level.id);
  if (i >= 0) E.map.levels[i] = clone(level);
  else E.map.levels.push(clone(level));
  indexChapter();
  await publish();
  refreshLevelSelect();
}
$('saveBtn').addEventListener('click', async () => {
  try { await saveLevel(E.level); status(`Đã lưu "${E.level.name}"`, 'ok'); frame.contentWindow.postMessage({ type: 'assets' }, '*'); }
  catch (e) { status('Lỗi lưu: ' + e.message, 'bad'); }
});
$('assignBtn').addEventListener('click', async () => {
  const n = Math.max(1, Math.min(+$('assignIdx').value || 1, E.map.levels.length));
  try {
    const cur = E.map.levels.findIndex(l => l.id === E.level.id);
    if (cur < 0) { E.map.levels.splice(n - 1, 0, clone(E.level)); }
    else { const [x] = E.map.levels.splice(cur, 1); E.map.levels.splice(n - 1, 0, clone(E.level)); }
    indexChapter(); await publish(); refreshLevelSelect(); onChange();
    status(`Đã đặt vào vị trí ${n}`, 'ok');
  } catch (e) { status('Lỗi: ' + e.message, 'bad'); }
});
$('copyJson').addEventListener('click', async () => { await navigator.clipboard.writeText(JSON.stringify(E.level, null, 2)); status('Đã chép JSON', 'ok'); });
$('pasteJson').addEventListener('click', async () => {
  try {
    const txt = await navigator.clipboard.readText().catch(() => prompt('Dán JSON level:'));
    const lv = JSON.parse(txt); if (!lv.container || !lv.items) throw new Error('không phải level');
    setLevel(lv, { keepId: true }); status('Đã dán JSON', 'ok');
  } catch (e) { status('JSON không hợp lệ: ' + e.message, 'bad'); }
});

// ---------- boot ----------
async function boot() {
  E.book = await loadBook({ fresh: true });
  if (!E.book?.chapters?.length) throw new Error('levels.json chưa có chương nào');
  E.mapId = new URLSearchParams(location.search).get('map') || E.book.chapters[0].id;

  await Promise.all([loadItemManifests(), loadBackgrounds(), loadBags()]);
  refreshPickers();

  draw = initDraw({ E, onChange, status, areaOf });
  whenSpriteReady(() => { clearAreaCache(); draw.refreshPalette(); onChange(); });
  gen = initGenerate({ E, setLevel, areaOf, status });
  pool = initPool({ E, status, onSaved: () => { clearAreaCache(); draw.refreshPalette(); onChange(); frame.contentWindow.postMessage({ type: 'assets' }, '*'); } });
  initManage({
    E, status, blankLevel, clone, publish,
    onReload: (mapId, levelId) => openChapter(mapId || E.mapId, levelId),
    onLevelPicked: id => openLevel(id),
  });

  await openChapter(E.mapId);
  $('liveTag').textContent = `v${E.book.version || 1}`;

  await probeWriter();
  if (!canWrite) {
    // Trang tĩnh: lưu bằng cách commit lên GitHub, cần token dán một lần
    $('ghBtn').hidden = false;
    paintGhTag();
    if (!gh.hasToken()) status('Bấm 🔑 để nối GitHub, sau đó Lưu sắp xếp sẽ đẩy thẳng lên.', '');
  }
}
boot().catch(e => { console.error(e); status('Lỗi khởi động: ' + e.message, 'bad'); });
