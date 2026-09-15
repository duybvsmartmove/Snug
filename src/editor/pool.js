// Thư viện art: danh sách đồ + hộp thoại sửa một món (ảnh, tên, thuộc tính).
// Mã số là khoá chính nên không cho sửa — level đang tham chiếu tới nó.
import { ITEM_DEFS, defById } from '../data/items.js';
import { theme } from '../art/helpers.js';
import { saveContent, saveBinary, applyManifest, assetHome, indexAsset } from '../content/loader.js';
import { convexHull, simplify } from '../util/geom.js';

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
  let newImg = null, newFile = null, clearArt = false;

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
    editing = def; newImg = null; newFile = null; clearArt = false;
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
    const w = def.box[2] - def.box[0];
    $('imWidth').value = Math.round(w);
    $('imWidthRow').hidden = !def.sprite;
    $('imClearArt').hidden = !def.sprite;
    $('imInfo').textContent = def.sprite ? 'Đang dùng ảnh. Kéo ảnh khác vào để thay.' : 'Đang dùng hình vẽ sẵn. Kéo ảnh vào để thay bằng art thật.';
    paintThumb($('imCanvas'), def, .9);
    modal.hidden = false;
  }
  const closeEditor = () => { modal.hidden = true; editing = null; };
  $('imClose').addEventListener('click', closeEditor);
  modal.addEventListener('click', e => { if (e.target === modal) closeEditor(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeEditor(); });

  // ---------- nhận ảnh mới ----------
  const drop = $('imDrop');
  const takeFile = f => {
    if (!f || !/image\/(png|webp)/.test(f.type)) return status('Ảnh món cần là PNG hoặc WebP nền trong suốt', 'bad');
    newFile = f; clearArt = false;
    newImg = new Image();
    newImg.onload = () => {
      const cv = $('imCanvas'), c = cv.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      const s = Math.min(cv.width, cv.height) * .9 / Math.max(newImg.width, newImg.height);
      c.drawImage(newImg, (cv.width - newImg.width * s) / 2, (cv.height - newImg.height * s) / 2, newImg.width * s, newImg.height * s);
      $('imWidthRow').hidden = false;
      if (!+$('imWidth').value) $('imWidth').value = 80;
      $('imInfo').textContent = `Ảnh mới ${newImg.width}×${newImg.height}px. Vùng va chạm sẽ bám theo viền ảnh.`;
    };
    newImg.src = URL.createObjectURL(f);
  };
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); takeFile(e.dataTransfer.files[0]); });
  $('imFile').addEventListener('change', e => takeFile(e.target.files[0]));
  $('imClearArt').addEventListener('click', () => {
    clearArt = true; newImg = null; newFile = null;
    $('imInfo').textContent = 'Sẽ quay lại hình vẽ sẵn sau khi lưu.';
    $('imWidthRow').hidden = true;
  });

  /** Vùng va chạm bám theo viền ảnh */
  function colliderFromImage(img, logicalW) {
    const off = document.createElement('canvas'); off.width = img.width; off.height = img.height;
    const oc = off.getContext('2d'); oc.drawImage(img, 0, 0);
    const data = oc.getImageData(0, 0, img.width, img.height).data;
    const step = Math.max(1, Math.floor(img.width / 120)), pts = [];
    for (let y = 0; y < img.height; y += step) for (let x = 0; x < img.width; x += step) if (data[(y * img.width + x) * 4 + 3] > 40) pts.push([x, y]);
    if (pts.length < 3) return null;
    const scale = logicalW / img.width;
    return {
      kind: 'poly',
      pts: simplify(convexHull(pts), img.width / 60)
        .map(([x, y]) => [Math.round((x - img.width / 2) * scale), Math.round((y - img.height / 2) * scale)]),
    };
  }

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
      // Món đã có thì ghi đè đúng chỗ cũ; món mới đặt vào thư mục chương đang mở
      const manifestPath = await assetHome('items', id);
      const dir = manifestPath.slice(0, manifestPath.lastIndexOf('/'));

      if (newFile && newImg) {
        const logicalW = +$('imWidth').value || 80;
        const col = colliderFromImage(newImg, logicalW);
        if (!col) return status('Ảnh không có vùng đục nào', 'bad');
        manifest.sprite = { src: `${dir}/${id}.png`, pixelsPerUnit: +(newImg.width / logicalW).toFixed(3) };
        manifest.collider = col;
        const b64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(newFile); });
        await saveBinary(`${dir}/${id}.png`, b64);
      } else if (!clearArt) {
        try {
          const old = await (await fetch(`./content/draft/${manifestPath}?t=${Date.now()}`)).json();
          if (old.sprite) manifest.sprite = old.sprite;
          if (old.collider) manifest.collider = old.collider;
        } catch {}
      }
      await saveContent(manifestPath, JSON.stringify(manifest, null, 2));
      await indexAsset('items', id, manifestPath);

      if (clearArt) { delete d.sprite; Object.assign(d, { name: manifest.name, slug: manifest.slug, meta }); }
      else {
        const def = applyManifest(manifest);
        if (def.sprite) await def.sprite.whenReady;
      }
      theme.ink = theme.ink;         // giữ nguyên, chỉ để nhắc render lại
      status(`Đã lưu món #${id}`, 'ok');
      closeEditor(); render(); onSaved?.();
    } catch (e) { status('Lỗi lưu món: ' + e.message, 'bad'); }
  });

  render();
  return { render };
}
