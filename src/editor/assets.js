// Thêm art mới: MÓN ĐỒ hoặc BỐI CẢNH. Hai loại có biểu mẫu riêng vì dữ liệu khác hẳn nhau.
//   Món đồ  → mã SỐ, có vùng va chạm, cỡ, tính chất, bề ngang trong game.
//   Bối cảnh → mã CHỮ, chỉ cần tên và màu lót, ảnh phủ kín khung dọc 420×760.
import { ITEM_DEFS } from '../data/items.js';
import { nextSceneId } from '../art/scene-registry.js';
import { saveContent, saveBinary, applyManifest, assetHome, indexAsset, loadAssetIndex } from '../content/loader.js';
import { convexHull, simplify } from '../util/geom.js';

const $ = id => document.getElementById(id);

/** Mã số chưa ai dùng, gợi ý cho món mới */
function nextFreeId() {
  const used = new Set(ITEM_DEFS.map(d => d.id));
  let n = 1; while (used.has(n)) n++;
  return n;
}

export function initAssets({ status, onSaved }) {
  const drop = $('drop'), cv = $('assetCanvas'), ctx = cv.getContext('2d');
  let img = null, file = null, hull = [], kind = 'item';

  // ---------- đổi loại ----------
  function setKind(k) {
    kind = k;
    [...$('assetKind').children].forEach(b => b.classList.toggle('on', b.dataset.kind === k));
    $('itemFields').hidden = k !== 'item';
    $('bgFields').hidden = k !== 'bg';
    $('kindHint').textContent = k === 'item'
      ? 'Ảnh món: nền trong suốt, nhìn thẳng từ trên xuống.'
      : 'Ảnh nền: tỉ lệ dọc 420×760, sẽ phủ kín màn chơi.';
    $('drop').innerHTML = k === 'item'
      ? 'Kéo ảnh món vào đây, hoặc <label class="link">chọn file<input id="file" type="file" accept="image/png,image/webp" hidden></label>'
      : 'Kéo ảnh nền vào đây, hoặc <label class="link">chọn file<input id="file" type="file" accept="image/png,image/webp,image/jpeg" hidden></label>';
    $('file').addEventListener('change', e => load(e.target.files[0]));
    if (img) compute();
  }
  $('assetKind').addEventListener('click', e => {
    const b = e.target.closest('button'); if (b) setKind(b.dataset.kind);
  });

  // ---------- nhận ảnh ----------
  const load = f => {
    const ok = kind === 'item' ? /image\/(png|webp)/ : /image\/(png|webp|jpeg)/;
    if (!f || !ok.test(f.type)) return status(kind === 'item' ? 'Ảnh món cần là PNG hoặc WebP nền trong suốt' : 'Ảnh nền cần là PNG, WebP hoặc JPG', 'bad');
    file = f; img = new Image();
    img.onload = () => {
      const base = f.name.replace(/\.(png|webp|jpe?g)$/i, '');
      if (kind === 'item') {
        $('aId').value ||= (base.match(/\d+/) || [String(nextFreeId())])[0];
        $('aName').value ||= base;
        $('aSlug').value ||= base.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      } else {
        $('bgId').value ||= (base.match(/\d+/) || [String(nextSceneId())])[0];
        $('bgName').value ||= base;
      }
      compute();
    };
    img.src = URL.createObjectURL(f);
  };
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); load(e.dataTransfer.files[0]); });
  ['aWidth', 'aCollider'].forEach(id => $(id).addEventListener('change', compute));
  $('bgFill').addEventListener('input', () => { if (kind === 'bg') compute(); });

  function compute() {
    if (!img) return;
    return kind === 'bg' ? previewBackground() : previewItem();
  }

  // ---------- xem trước MÓN ----------
  function previewItem() {
    const logicalW = +$('aWidth').value || 80, scale = logicalW / img.width;
    const off = document.createElement('canvas'); off.width = img.width; off.height = img.height;
    const oc = off.getContext('2d'); oc.drawImage(img, 0, 0);
    const data = oc.getImageData(0, 0, img.width, img.height).data;
    const step = Math.max(1, Math.floor(img.width / 120)), pts = [];
    for (let y = 0; y < img.height; y += step) for (let x = 0; x < img.width; x += step) if (data[(y * img.width + x) * 4 + 3] > 40) pts.push([x, y]);
    if (pts.length < 3) { status('Ảnh không có vùng đục nào', 'bad'); return; }
    const toLogical = ([x, y]) => [Math.round((x - img.width / 2) * scale), Math.round((y - img.height / 2) * scale)];
    const k = $('aCollider').value;
    if (k === 'hull') hull = simplify(convexHull(pts), img.width / 60).map(toLogical);
    else {
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      if (k === 'rect') hull = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(toLogical);
      else {
        const r = Math.max(x1 - x0, y1 - y0) / 2 * scale, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        hull = Array.from({ length: 16 }, (_, i) => {
          const a = i / 16 * Math.PI * 2;
          return [Math.round((cx - img.width / 2) * scale + Math.cos(a) * r), Math.round((cy - img.height / 2) * scale + Math.sin(a) * r)];
        });
      }
    }
    ctx.clearRect(0, 0, cv.width, cv.height);
    const s = Math.min(280 / img.width, 280 / img.height);
    const w = img.width * s, h = img.height * s, ox = (cv.width - w) / 2, oy = (cv.height - h) / 2;
    ctx.drawImage(img, ox, oy, w, h);
    ctx.beginPath();
    hull.forEach(([x, y], i) => { const px = ox + w / 2 + x / scale * s, py = oy + h / 2 + y / scale * s; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.closePath();
    ctx.strokeStyle = '#E2637F'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(226,99,127,.15)'; ctx.fill();
    const logicalH = Math.round(img.height * scale);
    const big = logicalW > 130 || logicalH > 130;
    $('aInfo').innerHTML = `${img.width}×${img.height}px → <b>${logicalW}×${logicalH}</b> trong game · ${hull.length} đỉnh`
      + (big ? ' · <span style="color:var(--warn)">khá to so với túi, cân nhắc giảm bề ngang</span>' : '');
  }

  // ---------- xem trước BỐI CẢNH ----------
  function previewBackground() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = $('bgFill').value; ctx.fillRect(0, 0, cv.width, cv.height);
    const s = Math.min(cv.width / 420, cv.height / 760);
    const w = 420 * s, h = 760 * s, ox = (cv.width - w) / 2, oy = (cv.height - h) / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, w, h); ctx.clip();
    const k = Math.max(w / img.width, h / img.height);
    ctx.drawImage(img, ox + (w - img.width * k) / 2, oy + (h - img.height * k) / 2, img.width * k, img.height * k);
    ctx.restore();
    ctx.strokeStyle = '#E2637F'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    for (const [y, label] of [[452, 'mép sàn'], [652, 'sàn vật lý']]) {
      const py = oy + y * s;
      ctx.beginPath(); ctx.moveTo(ox, py); ctx.lineTo(ox + w, py); ctx.stroke();
      ctx.fillStyle = '#E2637F'; ctx.font = '9px Nunito'; ctx.fillText(label, ox + 3, py - 3);
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(43,34,48,.4)'; ctx.strokeRect(ox, oy, w, h);
    const lech = Math.abs(img.width / img.height - 420 / 760) > .12;
    $('bgInfo').innerHTML = `${img.width}×${img.height}px` + (lech ? ' · <span style="color:var(--warn)">tỉ lệ lệch nhiều, ảnh sẽ bị cắt bớt</span>' : ' · tỉ lệ hợp');
  }

  // ---------- lưu MÓN ----------
  $('aSaveItem').addEventListener('click', async () => {
    if (!img || !file) return status('Chưa chọn ảnh', 'bad');
    const id = Number(($('aId').value || '').trim());
    if (!Number.isInteger(id) || id <= 0) return status('Mã số phải là số nguyên dương', 'bad');
    const logicalW = +$('aWidth').value || 80, ppu = img.width / logicalW, k = $('aCollider').value;
    let collider;
    if (k === 'circle') { const xs = hull.map(p => p[0]); collider = { kind: 'circle', r: Math.round((Math.max(...xs) - Math.min(...xs)) / 2) }; }
    else if (k === 'rect') { const xs = hull.map(p => p[0]), ys = hull.map(p => p[1]); collider = { kind: 'rect', w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), chamfer: 4 }; }
    else collider = { kind: 'poly', pts: hull };
    const manifestPath = await assetHome('items', id);
    const dir = manifestPath.slice(0, manifestPath.lastIndexOf('/'));
    const manifest = {
      id, slug: ($('aSlug').value || `item${id}`).trim(), name: $('aName').value || `Món ${id}`,
      sprite: { src: `${dir}/${id}.png`, pixelsPerUnit: +ppu.toFixed(3) },
      collider,
      meta: { size: $('aSize').value, shape: k === 'circle' ? 'Circle' : 'Rectangle', physics: $('aPhys').value, cost: 1, canLink: true, canLock: true },
    };
    try {
      const index = await loadAssetIndex(true);
      if (index.items[id] && !confirm(`Đã có món mang mã ${id}. Ghi đè ảnh và thông số cũ?`)) return status('Đã huỷ, hãy đổi mã khác', '');
      const b64 = await toBase64(file);
      await saveBinary(`${dir}/${id}.png`, b64);
      await saveContent(manifestPath, JSON.stringify(manifest, null, 2));
      await indexAsset('items', id, manifestPath);
      const def = applyManifest(manifest);
      await def.sprite.whenReady;
      status(`Đã lưu món #${id} — đã có trong kho đồ`, 'ok');
      onSaved?.();
    } catch (e) { status('Lỗi lưu món: ' + e.message, 'bad'); }
  });

  // ---------- lưu BỐI CẢNH ----------
  $('aSaveBg').addEventListener('click', async () => {
    if (!img || !file) return status('Chưa chọn ảnh', 'bad');
    const id = Number(($('bgId').value || '').trim());
    if (!Number.isInteger(id) || id < 10) return status('Mã bối cảnh phải là số nguyên từ 10 trở lên (1–9 dành cho nền vẽ sẵn)', 'bad');
    const manifestPath = await assetHome('backgrounds', id);
    const dir = manifestPath.slice(0, manifestPath.lastIndexOf('/'));
    const manifest = {
      id, name: $('bgName').value || id, fill: $('bgFill').value,
      layers: [{ src: `${dir}/bg-${id}.png`, x: 0, y: 0, w: 420, h: 760 }],
    };
    try {
      const b64 = await toBase64(file);
      await saveBinary(`${dir}/bg-${id}.png`, b64);
      await saveContent(manifestPath, JSON.stringify(manifest, null, 2));
      await indexAsset('backgrounds', id, manifestPath);
      status(`Đã lưu bối cảnh "${manifest.name}" — chọn được ở ô Bối cảnh`, 'ok');
      onSaved?.();
    } catch (e) { status('Lỗi lưu bối cảnh: ' + e.message, 'bad'); }
  });

  const toBase64 = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(f); });

  setKind('item');
}
