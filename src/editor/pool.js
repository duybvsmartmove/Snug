// Thư viện art: danh sách đồ + hộp thoại sửa một món (ảnh, tên, thuộc tính).
// Mã số là khoá chính nên không cho sửa — level đang tham chiếu tới nó.
import { ITEM_DEFS, defById } from '../data/items.js';
import { theme } from '../art/helpers.js';
import { saveContent, applyManifest, assetHome, indexAsset } from '../content/loader.js';

const $ = id => document.getElementById(id);

// Giá trị phải khớp đúng với dữ liệu trong sheet, nếu không ô chọn sẽ hiện sai
const SIZES = ['Small', 'Medium', 'Large'];
const SHAPES = ['Rectangle', 'Rounded rect', 'Long', 'Oval', 'Circle', 'Triangle', 'Curved', 'L-shape', 'U-shape', 'Irregular'];
const PHYS = [
  { v: 'normal', t: 'Bình thường' },
  { v: 'rolling', t: 'Dễ lăn' },
  { v: 'bouncy', t: 'Nảy' },
  { v: 'vibrating', t: 'Rung' },
];
const PHYS_TEXT = Object.fromEntries(PHYS.map(p => [p.v, p.t]));

/** Vẽ món vào một canvas nhỏ, ưu tiên ảnh nếu có */
function paintThumb(cv, def, pad = .82) {
  const px = cv.width, c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, px, cv.height);
  const sp = def.sprite;
  if (sp && sp.ready) {
    const s = (Math.min(px, cv.height) * pad) / Math.max(sp.img.width, sp.img.height);
    c.drawImage(sp.img, (px - sp.img.width * s) / 2, (cv.height - sp.img.height * s) / 2, sp.img.width * s, sp.img.height * s);
    return;
  }
  // chưa có ảnh thì để ô trống, món nào cũng phải có sprite
  c.fillStyle = 'rgba(0,0,0,.06)';
  c.fillRect(px * .18, cv.height * .18, px * .64, cv.height * .64);
}

export function initPool({ status, onSaved }) {
  const table = $('poolTable');
  const modal = $('itemModal');
  let editing = null;          // def đang sửa

  // ---------- bảng ----------
  function render() {
    const q = ($('poolSearch').value || '').toLowerCase();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    table.innerHTML = '<tr><th></th><th>#</th><th>Tên</th><th>Cỡ</th><th>Hình dáng</th><th>Tính chất</th><th>Khó</th><th>Art</th><th></th></tr>';
    for (const d of ITEM_DEFS) {
      if (q && !`${d.id} ${d.name} ${d.slug}`.toLowerCase().includes(q)) continue;
      const m = d.meta, tr = document.createElement('tr');
      const cv = document.createElement('canvas'); cv.width = cv.height = 34 * dpr;
      cv.className = 'pool-thumb'; paintThumb(cv, d);
      const cell = (html, cls = '') => { const td = document.createElement('td'); if (cls) td.className = cls; if (html instanceof Node) td.append(html); else td.innerHTML = html; tr.appendChild(td); };
      cell(cv, 'thumb');
      cell(`<b>${d.id}</b>`);
      cell(d.name);
      cell(m.size);
      cell(m.shape);
      cell(`<span class="tag ${m.physics}">${PHYS_TEXT[m.physics] || m.physics}</span>`);
      cell(String(m.cost));
      cell(d.sprite ? 'ảnh' : 'hình vẽ');
      const btn = document.createElement('button'); btn.textContent = 'Sửa';
      btn.addEventListener('click', () => openEditor(d));
      cell(btn, 'act');
      table.appendChild(tr);
    }
  }
  $('poolSearch').addEventListener('input', render);

  // ---------- hộp thoại ----------
  function fillSelect(el, opts, val) {
    el.innerHTML = opts.map(o => {
      const v = typeof o === 'string' ? o : o.v, t = typeof o === 'string' ? o : o.t;
      return `<option value="${v}"${v === val ? ' selected' : ''}>${t}</option>`;
    }).join('');
  }
  function openEditor(def) {
    editing = def;
    $('imTitle').textContent = `Sửa món #${def.id}`;
    $('imId').value = def.id;
    $('imName').value = def.name;
    $('imSlug').value = def.slug;
    fillSelect($('imSize'), SIZES, def.meta.size);
    fillSelect($('imShape'), SHAPES, def.meta.shape);
    fillSelect($('imPhys'), PHYS, def.meta.physics);
    $('imCost').value = def.meta.cost;
    $('imLink').checked = !!def.meta.canLink;
    $('imLock').checked = !!def.meta.canLock;
    const [x0, , x1] = def.box;
    $('imInfo').textContent = def.sprite
      ? `Ảnh rộng ${Math.round(x1 - x0)}px trong game. Sinh lại ảnh ở trang Sinh sprite.`
      : 'Món này chưa có ảnh. Sinh ở trang Sinh sprite.';
    paintThumb($('imCanvas'), def, .9);
    modal.hidden = false;
  }
  const closeEditor = () => { modal.hidden = true; editing = null; };
  $('imClose').addEventListener('click', closeEditor);
  modal.addEventListener('click', e => { if (e.target === modal) closeEditor(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeEditor(); });

  // ---------- lưu ----------
  $('imSave').addEventListener('click', async () => {
    if (!editing) return;
    const d = editing, id = d.id;
    const meta = {
      size: $('imSize').value, shape: $('imShape').value, physics: $('imPhys').value,
      cost: +$('imCost').value || 0, canLink: $('imLink').checked, canLock: $('imLock').checked,
    };
    const manifest = { id, slug: ($('imSlug').value || d.slug).trim(), code: d.code || null, name: ($('imName').value || d.name).trim(), meta };
    try {
      // Giữ nguyên ảnh và vùng va chạm đang có, chỉ ghi lại tên và thuộc tính
      const manifestPath = await assetHome('items', id);
      try {
        const old = await (await fetch(`./content/${manifestPath}?t=${Date.now()}`)).json();
        if (old.sprite) manifest.sprite = old.sprite;
        if (old.collider) manifest.collider = old.collider;
      } catch {}
      await saveContent(manifestPath, JSON.stringify(manifest, null, 2));
      await indexAsset('items', id, manifestPath);

      const def = applyManifest(manifest);
      if (def.sprite) await def.sprite.whenReady;
      status(`Đã lưu món #${id}`, 'ok');
      closeEditor(); render(); onSaved?.();
    } catch (e) { status('Lỗi lưu món: ' + e.message, 'bad'); }
  });

  render();
  return { render };
}
