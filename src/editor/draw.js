// Tab Draw: canvas sắp xếp level. Tool Items (kéo/xoay/buộc dây/khóa), Shape (kéo điểm polygon), Block (vẽ block chặn).
import { ITEM_DEFS, MYSTERY, defById, labelOf } from '../data/items.js';
import { theme } from '../art/helpers.js';
import { W, H, TABLE_Y, FLOOR_Y } from '../game/state.js';
import { pointInPolygon, polygonArea } from '../util/geom.js';
import { chapterItemIds, byChapterFirst } from './chapter-items.js';

const $ = id => document.getElementById(id);
const INK = { 1: '#3B2A4A', 2: '#3B2A4A', 3: '#4A2F3A' };

export function initDraw({ E, onChange, status, areaOf: areaOfItem }) {
  const cv = $('edit'), ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr;
  let tool = 'item', sel = null, linkMode = false, dragging = null, hoverPt = -1;

  const abs = (x, y) => ({ x: E.level.container.cx + x, y: E.level.container.bottom + y });
  const loc = (x, y) => ({ x: x - E.level.container.cx, y: y - E.level.container.bottom });
  const toLogical = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  const itemPos = it => it.inBag ? abs(it.x ?? 0, it.y ?? -30) : { x: it.x, y: it.y };

  // ---------- vẽ ----------
  function drawDef(def, x, y, angle, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(angle || 0); ctx.lineJoin = 'round';
    const sp = def.sprite;
    if (sp && sp.ready) { const w = sp.img.width / sp.ppu, h = sp.img.height / sp.ppu; ctx.drawImage(sp.img, -w / 2, -h / 2, w, h); }
    else { const [x0, y0, x1, y1] = def.box; ctx.fillStyle = '#ccc'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
    ctx.restore();
  }
  function render() {
    const L = E.level; if (!L) return;
    theme.ink = L.ink || INK[Number(L.background)] || '#3B2A4A';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // nền đơn giản
    ctx.fillStyle = '#FBF3EC'; ctx.fillRect(0, 0, W, TABLE_Y);
    ctx.fillStyle = '#E4B98F'; ctx.fillRect(0, TABLE_Y, W, H - TABLE_Y);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1;
    ctx.strokeRect(16, TABLE_Y + 16, W - 32, FLOOR_Y - TABLE_Y - 6); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.font = '700 11px Nunito'; ctx.fillText('khay đồ (spawn)', 22, TABLE_Y + 30);
    ctx.fillText('sàn vật lý', 22, FLOOR_Y - 6);
    // túi: polygon
    const poly = L.container.shape.map(([x, y]) => { const p = abs(x, y); return [p.x, p.y]; });
    ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.fillStyle = L.container.skin === 'tote' ? 'rgba(63,184,175,.25)' : 'rgba(110,79,174,.28)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = theme.ink; ctx.stroke();
    // miệng túi
    const minY = Math.min(...poly.map(p => p[1]));
    ctx.strokeStyle = '#E2B04A'; ctx.lineWidth = 4; ctx.beginPath();
    poly.forEach(([x, y], i) => { const [x2, y2] = poly[(i + 1) % poly.length]; if (Math.abs(y - minY) < 1 && Math.abs(y2 - minY) < 1) { ctx.moveTo(x, y); ctx.lineTo(x2, y2); } });
    ctx.stroke();
    // block
    for (const b of L.container.blocks || []) { const p = abs(b.x, b.y); ctx.fillStyle = 'rgba(40,25,60,.85)'; ctx.fillRect(p.x, p.y, b.w, b.h); ctx.strokeStyle = theme.ink; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, b.w, b.h); }
    // dây buộc
    for (const it of L.items) if (it.link) {
      const o = L.items.find(j => j.id === it.link); if (!o) continue;
      const a = itemPos(it), b = itemPos(o);
      ctx.strokeStyle = L.string || '#E2637F'; ctx.lineWidth = 3; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 20, b.x, b.y); ctx.stroke();
    }
    // items
    for (const it of L.items) {
      const def = defById(it.id); if (!def) continue;
      const p = itemPos(it);
      drawDef(it.locked ? MYSTERY : def, p.x, p.y, it.angle, it.inBag ? .9 : 1);
      if (it.inBag) { ctx.fillStyle = '#E2B04A'; ctx.font = '800 10px Nunito'; ctx.fillText('IN BAG', p.x - 18, p.y - 26); }
      if (sel === it) {
        const [x0, y0, x1, y1] = (it.locked ? MYSTERY : def).box;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(it.angle || 0);
        ctx.strokeStyle = '#E2637F'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8); ctx.setLineDash([]); ctx.restore();
      }
    }
    // control points
    if (tool === 'shape') {
      poly.forEach(([x, y], i) => { ctx.beginPath(); ctx.arc(x, y, i === hoverPt ? 8 : 6, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#E2637F'; ctx.stroke(); });
      // điểm giữa cạnh: click để thêm
      poly.forEach(([x, y], i) => { const [x2, y2] = poly[(i + 1) % poly.length]; ctx.beginPath(); ctx.arc((x + x2) / 2, (y + y2) / 2, 4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(226,99,127,.6)'; ctx.fill(); });
    }
    if (dragging?.kind === 'block') { const p = abs(dragging.x, dragging.y); ctx.strokeStyle = '#E2637F'; ctx.setLineDash([4, 4]); ctx.strokeRect(p.x, p.y, dragging.w, dragging.h); ctx.setLineDash([]); }
  }

  // ---------- hit test ----------
  function hitItem(p) {
    const L = E.level;
    for (let i = L.items.length - 1; i >= 0; i--) {
      const it = L.items[i], def = it.locked ? MYSTERY : defById(it.id); if (!def) continue;
      const c = itemPos(it), dx = p.x - c.x, dy = p.y - c.y, a = -(it.angle || 0);
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      const [x0, y0, x1, y1] = def.box;
      if (lx >= x0 && lx <= x1 && ly >= y0 && ly <= y1) return it;
    }
    return null;
  }
  const polyAbs = () => E.level.container.shape.map(([x, y]) => { const q = abs(x, y); return [q.x, q.y]; });
  function hitPoint(p) { return polyAbs().findIndex(([x, y]) => Math.hypot(x - p.x, y - p.y) < 10); }
  function hitMid(p) { const pa = polyAbs(); return pa.findIndex(([x, y], i) => { const [x2, y2] = pa[(i + 1) % pa.length]; return Math.hypot((x + x2) / 2 - p.x, (y + y2) / 2 - p.y) < 8; }); }
  function hitBlock(p) { const q = loc(p.x, p.y); return (E.level.container.blocks || []).findIndex(b => q.x >= b.x && q.x <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h); }

  // ---------- events ----------
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    const p = toLogical(e); cv.setPointerCapture(e.pointerId);
    const L = E.level;
    if (tool === 'shape') {
      const i = hitPoint(p);
      if (e.button === 2) { if (i >= 0 && L.container.shape.length > 3) { L.container.shape.splice(i, 1); onChange(); } return; }
      if (i >= 0) { dragging = { kind: 'pt', i }; return; }
      const m = hitMid(p);
      if (m >= 0) { const q = loc(p.x, p.y); L.container.shape.splice(m + 1, 0, [Math.round(q.x), Math.round(q.y)]); dragging = { kind: 'pt', i: m + 1 }; onChange(); return; }
      return;
    }
    if (tool === 'block') {
      const bi = hitBlock(p);
      if (e.button === 2) { if (bi >= 0) { L.container.blocks.splice(bi, 1); onChange(); } return; }
      const q = loc(p.x, p.y); dragging = { kind: 'block', x: Math.round(q.x), y: Math.round(q.y), w: 0, h: 0, sx: q.x, sy: q.y }; return;
    }
    // item tool
    const it = hitItem(p);
    if (linkMode && sel && it && it !== sel) {
      if (!defById(it.id).meta.canLink || !defById(sel.id).meta.canLink) { status('Món này không buộc dây được', 'bad'); }
      else { for (const j of L.items) { if (j.link === sel.id || j.link === it.id) delete j.link; } delete it.link; sel.link = it.id; status(`Đã buộc ${defById(sel.id).name} với ${defById(it.id).name}`, 'ok'); }
      linkMode = false; showSel(); onChange(); return;
    }
    linkMode = false;
    if (e.button === 2) { if (it) removeItem(it); return; }
    sel = it; showSel();
    if (it) { const c = itemPos(it); dragging = { kind: 'item', it, dx: c.x - p.x, dy: c.y - p.y }; }
    render();
  });
  cv.addEventListener('pointermove', e => {
    const p = toLogical(e);
    if (tool === 'shape' && !dragging) { const h = hitPoint(p); if (h !== hoverPt) { hoverPt = h; render(); } }
    if (!dragging) return;
    const L = E.level;
    if (dragging.kind === 'pt') { const q = loc(p.x, p.y); L.container.shape[dragging.i] = [Math.round(q.x), Math.round(q.y)]; onChange(); }
    else if (dragging.kind === 'block') { const q = loc(p.x, p.y); dragging.x = Math.round(Math.min(q.x, dragging.sx)); dragging.y = Math.round(Math.min(q.y, dragging.sy)); dragging.w = Math.round(Math.abs(q.x - dragging.sx)); dragging.h = Math.round(Math.abs(q.y - dragging.sy)); render(); }
    else if (dragging.kind === 'item') {
      const it = dragging.it, nx = p.x + dragging.dx, ny = p.y + dragging.dy;
      if (it.inBag) { const q = loc(nx, ny); it.x = Math.round(q.x); it.y = Math.round(q.y); } else { it.x = Math.round(nx); it.y = Math.round(ny); }
      onChange();
    }
  });
  const endDrag = () => {
    if (dragging?.kind === 'block' && dragging.w > 8 && dragging.h > 8) { E.level.container.blocks = E.level.container.blocks || []; E.level.container.blocks.push({ x: dragging.x, y: dragging.y, w: dragging.w, h: dragging.h }); onChange(); }
    dragging = null; render();
  };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('wheel', e => {
    const p = toLogical(e); const it = hitItem(p) || sel; if (!it) return;
    e.preventDefault(); it.angle = Math.round(((it.angle || 0) + (e.deltaY > 0 ? 1 : -1) * Math.PI / 12) * 100) / 100; onChange();
  }, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.target.matches('input,select,textarea')) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel) removeItem(sel);
    if (e.key === 'r' && sel) { sel.angle = Math.round(((sel.angle || 0) + Math.PI / 2) * 100) / 100; onChange(); }
  });
  function removeItem(it) { const L = E.level; L.items.splice(L.items.indexOf(it), 1); for (const j of L.items) if (j.link === it.id) delete j.link; if (sel === it) sel = null; showSel(); onChange(); }

  // ---------- tool seg / preset ----------
  const hints = {
    item: 'Kéo món để đặt · lăn chuột hoặc R để xoay · Delete hoặc chuột phải để xoá',
    shape: 'Kéo điểm tròn để đổi hình · bấm điểm giữa cạnh để thêm điểm · chuột phải để xoá',
    block: 'Kéo một vùng trong túi để tạo vật cản · chuột phải để xoá',
  };
  $('toolHint').textContent = hints.item;
  $('toolSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; tool = b.dataset.tool; [...$('toolSeg').children].forEach(x => x.classList.toggle('on', x === b)); $('toolHint').textContent = hints[tool]; render(); });
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => { E.level.container.shape = preset(b.dataset.preset, E.level.container.shape); onChange(); }));
  function preset(kind, cur) {
    const xs = cur.map(p => p[0]), ys = cur.map(p => p[1]);
    const w = Math.max(...xs) - Math.min(...xs) || 260, h = Math.max(...ys) - Math.min(...ys) || 220, hw = w / 2;
    const T = -h;
    switch (kind) {
      case 'rect': return [[-hw, T], [hw, T], [hw, 0], [-hw, 0]];
      case 'rounded': { const r = 28; return [[-hw, T], [hw, T], [hw, -r], [hw - r * .45, -r * .1], [hw - r, 0], [-hw + r, 0], [-hw + r * .45, -r * .1], [-hw, -r]].map(([x, y]) => [Math.round(x), Math.round(y)]); }
      case 'notch': return [[-hw, T], [hw, T], [hw, -h * .45], [hw - w * .3, -h * .45], [hw - w * .3, 0], [-hw, 0]].map(([x, y]) => [Math.round(x), Math.round(y)]);
      case 'L': return [[-hw, T], [-hw + w * .55, T], [-hw + w * .55, -h * .5], [hw, -h * .5], [hw, 0], [-hw, 0]].map(([x, y]) => [Math.round(x), Math.round(y)]);
      case 'wide': return [[-hw - 20, T + 40], [hw + 20, T + 40], [hw + 20, 0], [-hw - 20, 0]];
    }
    return cur;
  }

  // ---------- Fit bag: scale polygon quanh đáy để đạt density mong muốn ----------
  $('fitBag').addEventListener('click', e => {
    if (e.target.tagName === 'INPUT') return;
    const L = E.level;
    const want = Math.max(.3, Math.min(.98, (+$('fitDensity').value || 80) / 100));
    const items = L.items.filter(i => i.id !== 'key');
    if (!items.length) return status('Chưa có món nào để tính', 'bad');
    const itemArea = items.reduce((s, it) => s + areaOfItem(it.id), 0);
    const cur = polygonArea(L.container.shape) - (L.container.blocks || []).reduce((s, b) => s + b.w * b.h, 0);
    const target = itemArea / want;
    const k = Math.sqrt(target / cur);
    // scale quanh gốc (giữa đáy túi), giới hạn để không tràn màn hình
    const scaled = L.container.shape.map(([x, y]) => [Math.round(x * k), Math.round(y * k)]);
    const maxHalf = 190, maxH = 300;
    const w = Math.max(...scaled.map(p => Math.abs(p[0]))), h = Math.max(...scaled.map(p => -p[1]));
    if (w > maxHalf || h > maxH) return status(`Cần túi lớn hơn khung cho phép (${Math.round(w * 2)}×${Math.round(h)}). Bớt món hoặc giảm density.`, 'bad');
    L.container.shape = scaled;
    for (const b of L.container.blocks || []) { b.x = Math.round(b.x * k); b.y = Math.round(b.y * k); b.w = Math.round(b.w * k); b.h = Math.round(b.h * k); }
    onChange();
    status(`Đã chỉnh lòng túi về density ${(want * 100).toFixed(0)}%`, 'ok');
  });

  // ---------- selection panel ----------
  function showSel() {
    const box = $('selBox');
    if (!sel) { box.innerHTML = '<em>Chưa chọn món</em>'; return; }
    const def = defById(sel.id), m = def.meta;
    box.innerHTML = `<b>${def.name}</b> <span class="hint">#${def.id} · ${m.size} · ${m.physics}</span>
      <div class="hint">angle ${((sel.angle || 0) * 180 / Math.PI).toFixed(0)}° · area ${Math.round(0)}</div>
      <div class="mech">
        <button data-m="link" class="${sel.link ? 'on' : ''}" ${m.canLink ? '' : 'disabled'}>${sel.link ? 'Buộc với #' + sel.link : 'Buộc dây…'}</button>
        <button data-m="locked" class="${sel.locked ? 'on' : ''}" ${m.canLock ? '' : 'disabled'}>Hộp bí ẩn</button>
        <button data-m="inBag" class="${sel.inBag ? 'on' : ''}">Đặt sẵn trong túi</button>
        <button data-m="del">Xoá</button>
      </div>`;
    box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.m;
      if (k === 'link') { if (sel.link) { delete sel.link; } else { linkMode = true; status('Bấm tiếp món thứ hai để buộc dây', ''); } }
      if (k === 'locked') { sel.locked = !sel.locked; if (!sel.locked) delete sel.locked; }
      if (k === 'inBag') { if (sel.inBag) { delete sel.inBag; const a = abs(sel.x, sel.y); sel.x = Math.round(a.x); sel.y = Math.round(a.y + 200); } else { sel.inBag = true; sel.x = 0; sel.y = -40; } }
      if (k === 'del') return removeItem(sel);
      showSel(); onChange();
    }));
  }

  // ---------- palette ----------
  let chapterItems = null, chapterOwn = null;
  async function computeChapterItems() {
    ({ all: chapterItems, own: chapterOwn } = await chapterItemIds(E));
    refreshPalette();
  }

  function refreshPalette() {
    const pal = $('palette'), q = ($('palSearch').value || '').toLowerCase(); pal.innerHTML = '';
    const scope = $('palScope').value;
    // Món riêng của chương lên trước, món mượn từ chương khác xuống sau
    const order = scope === 'chapter' && chapterOwn ? [...ITEM_DEFS].sort(byChapterFirst(chapterOwn)) : ITEM_DEFS;
    for (const def of order) {
      if (scope === 'chapter' && chapterItems && !chapterItems.has(def.id) && def.id > 0) continue;
      if (q && !`${def.id} ${def.name} ${def.slug}`.toLowerCase().includes(q)) continue;
      const b = document.createElement('button'); b.title = labelOf(def);
      const c = document.createElement('canvas'); c.width = c.height = 80;
      const g = c.getContext('2d'); const [x0, y0, x1, y1] = def.box, sc = 64 / Math.max(x1 - x0, y1 - y0);
      g.translate(40, 40); g.scale(sc, sc); g.translate(-(x0 + x1) / 2, -(y0 + y1) / 2); g.lineJoin = 'round';
      const sp = def.sprite; if (sp && sp.ready) { const w = sp.img.width / sp.ppu, h = sp.img.height / sp.ppu; g.drawImage(sp.img, -w / 2, -h / 2, w, h); } else { const [x0, y0, x1, y1] = def.box; g.fillStyle = '#ccc'; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
      const s = document.createElement('span'); s.textContent = def.name;
      if (scope === 'chapter' && chapterOwn && !chapterOwn.has(def.id) && def.id > 0) b.classList.add('borrowed');
      b.append(c, s); pal.appendChild(b);
      b.addEventListener('click', () => addItem(def));
    }
  }
  $('palSearch').addEventListener('input', refreshPalette);
  $('palScope').addEventListener('change', refreshPalette);
  function addItem(def) {
    const L = E.level;
    if (L.items.find(i => i.id === def.id)) return status(`${def.name} đã có trong level`, 'bad');
    const n = L.items.filter(i => !i.inBag).length, col = n % 6, row = Math.floor(n / 6);
    const it = { id: def.id, x: 40 + col * 68, y: TABLE_Y + 40 + row * 70, angle: 0 };
    if (def.id === 0) { it.inBag = true; it.x = 0; it.y = -40; }   // chìa khoá luôn nằm sẵn trong túi
    L.items.push(it); sel = it; showSel(); onChange();
  }

  refreshPalette();
  computeChapterItems();
  return { render, refreshPalette, computeChapterItems, clearSelection: () => { sel = null; showSel(); } };
}
