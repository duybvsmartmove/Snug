// Quản lý chương và level. Mọi thứ nằm trong một file sắp xếp (content/levels.json của repo game),
// nên thêm, xoá, đổi thứ tự đều chỉ là sửa mảng rồi lưu lại file đó.
const $ = id => document.getElementById(id);

const slugify = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** Mã level kế tiếp, tiền tố lấy chữ cái đầu của mã chương: school-day → sd-11 */
export function nextLevelId(mapId, existing) {
  const prefix = mapId.split('-').map(w => w[0]).join('').slice(0, 3) || 'lv';
  const used = new Set(existing);
  let n = existing.length + 1, id = `${prefix}-${String(n).padStart(2, '0')}`;
  while (used.has(id)) id = `${prefix}-${String(++n).padStart(2, '0')}`;
  return id;
}

export function initManage({ E, status, blankLevel, clone, publish, onReload, onLevelPicked }) {
  const modal = $('mgModal');
  // Chương đang xem trong bảng. Bấm một chương chỉ đổi danh sách level bên dưới,
  // không đụng tới chương đang mở để sửa ở ngoài.
  let viewId = null;
  const viewed = () => E.book.chapters.find(c => c.id === viewId) || E.map;
  const save = async () => { await publish(); };

  // ---------- chương ----------
  const renumber = () => E.book.chapters.forEach((c, i) => { c.no = i + 1; });

  async function renameChapter(i) {
    const c = E.book.chapters[i];
    const name = prompt('Tên chương:', c.name);
    if (!name || name === c.name) return;
    c.name = name; await save();
    status('Đã đổi tên chương', 'ok'); render(); onReload?.(E.mapId);
  }

  async function deleteChapter(i) {
    const c = E.book.chapters[i];
    if (E.book.chapters.length < 2) return status('Phải còn ít nhất một chương', 'bad');
    if (!confirm(`Xoá chương "${c.name}" cùng ${c.levels.length} level bên trong?\n\nẢnh của chương vẫn giữ nguyên.`)) return;
    E.book.chapters.splice(i, 1);
    renumber(); await save();
    status(`Đã xoá chương "${c.name}"`, 'ok'); render(); onReload?.(E.book.chapters[0].id);
  }

  // ---------- level ----------
  async function addLevel() {
    const ch = viewed();
    const id = nextLevelId(ch.id, ch.levels.map(l => l.id));
    const lv = blankLevel(id);
    if (E.level && ch.id === E.mapId) lv.container = clone(E.level.container);
    ch.levels.push(lv); await save();
    status(`Đã thêm level ${ch.levels.length} vào "${ch.name}"`, 'ok');
    render();
    if (ch.id === E.mapId) onLevelPicked?.(id);
  }
  async function deleteLevel(i) {
    const ch = viewed(), lv = ch.levels[i];
    if (!confirm(`Xoá level ${i + 1} (${lv.name || lv.id}) của chương "${ch.name}"?`)) return;
    ch.levels.splice(i, 1); await save();
    status(`Đã xoá level ${lv.id}`, 'ok'); render();
    if (ch.id === E.mapId) onLevelPicked?.(ch.levels[Math.min(i, ch.levels.length - 1)]?.id);
  }
  async function duplicateLevel(i) {
    const ch = viewed(), src = ch.levels[i];
    const id = nextLevelId(ch.id, ch.levels.map(l => l.id));
    ch.levels.splice(i + 1, 0, { ...clone(src), id, name: `${src.name} (bản sao)` });
    await save();
    status('Đã nhân bản level', 'ok'); render();
    if (ch.id === E.mapId) onLevelPicked?.(id);
  }

  /** Đổi chỗ hai phần tử trong mảng rồi lưu */
  async function reorder(list, from, to, after) {
    if (from === to || to < 0 || to >= list.length) return;
    const [x] = list.splice(from, 1);
    list.splice(to, 0, x);
    await after?.();
    await save();
    render();
  }

  // ---------- bảng ----------
  const btn = (text, title, fn, cls = '') => {
    const b = document.createElement('button');
    b.textContent = text; b.title = title; b.className = 'mini ' + cls;
    b.addEventListener('click', () => fn().catch(e => status('Lỗi: ' + e.message, 'bad')));
    return b;
  };
  function row(cells, cls = '') {
    const tr = document.createElement('tr');
    if (cls) tr.className = cls;
    for (const c of cells) {
      const td = document.createElement('td');
      if (c instanceof Node) td.append(c); else td.innerHTML = c;
      tr.appendChild(td);
    }
    return tr;
  }

  /** Cho phép kéo các dòng của một bảng để đổi thứ tự */
  function makeSortable(table, onDrop) {
    let from = null;
    table.addEventListener('dragstart', e => {
      const tr = e.target.closest('tr[draggable]');
      if (!tr) return;
      from = +tr.dataset.i;
      tr.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(from));   // Firefox cần dòng này
    });
    table.addEventListener('dragover', e => {
      const tr = e.target.closest('tr[draggable]');
      if (!tr || from === null) return;
      e.preventDefault();
      const r = tr.getBoundingClientRect();
      const duoi = e.clientY > r.top + r.height / 2;
      table.querySelectorAll('tr.over-top,tr.over-bottom').forEach(x => x.classList.remove('over-top', 'over-bottom'));
      tr.classList.add(duoi ? 'over-bottom' : 'over-top');
    });
    table.addEventListener('dragleave', e => {
      if (!table.contains(e.relatedTarget)) table.querySelectorAll('tr.over-top,tr.over-bottom').forEach(x => x.classList.remove('over-top', 'over-bottom'));
    });
    table.addEventListener('drop', e => {
      const tr = e.target.closest('tr[draggable]');
      table.querySelectorAll('tr.over-top,tr.over-bottom,tr.dragging').forEach(x => x.classList.remove('over-top', 'over-bottom', 'dragging'));
      if (!tr || from === null) return;
      e.preventDefault();
      const r = tr.getBoundingClientRect();
      let to = +tr.dataset.i + (e.clientY > r.top + r.height / 2 ? 1 : 0);
      if (to > from) to--;
      const f = from; from = null;
      onDrop(f, to).catch(err => status('Lỗi: ' + err.message, 'bad'));
    });
    table.addEventListener('dragend', () => {
      from = null;
      table.querySelectorAll('tr.over-top,tr.over-bottom,tr.dragging').forEach(x => x.classList.remove('over-top', 'over-bottom', 'dragging'));
    });
  }

  function render() {
    const ch = viewed();
    if (!viewId) viewId = ch?.id;

    const ct = $('mgChapters');
    ct.innerHTML = '<tr><th></th><th>#</th><th>Tên chương</th><th>Level</th><th></th></tr>';
    E.book.chapters.forEach((c, i) => {
      const acts = document.createElement('div'); acts.className = 'mini-row';
      acts.append(
        btn('Đổi tên', 'Đổi tên chương', () => renameChapter(i)),
        btn('Xoá', 'Xoá chương cùng level bên trong', () => deleteChapter(i), 'danger'),
      );
      const tr = row(['<span class="grip" title="Kéo để đổi thứ tự">⋮⋮</span>', String(i + 1),
                      `${c.name} <code>${c.id}</code>`, String(c.levels.length), acts],
                     c.id === viewId ? 'on' : '');
      tr.draggable = true; tr.dataset.i = i;
      tr.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        viewId = c.id; render();
      });
      ct.appendChild(tr);
    });

    const lt = $('mgLevels');
    $('mgLevelHead').textContent = `Level của chương "${ch.name}"`;
    lt.innerHTML = '<tr><th></th><th>#</th><th>Tên level</th><th>Món</th><th></th></tr>';
    ch.levels.forEach((lv, i) => {
      const acts = document.createElement('div'); acts.className = 'mini-row';
      acts.append(
        btn('Mở', 'Mở level này để sửa', async () => {
          if (ch.id !== E.mapId) await onReload?.(ch.id, lv.id);
          else onLevelPicked?.(lv.id);
          modal.hidden = true;
        }),
        btn('Nhân bản', 'Tạo bản sao ngay dưới', () => duplicateLevel(i)),
        btn('Xoá', 'Xoá level', () => deleteLevel(i), 'danger'),
      );
      const tr = row(['<span class="grip" title="Kéo để đổi thứ tự">⋮⋮</span>', String(i + 1),
                      `${lv.name || lv.id} <code>${lv.id}</code>`, String((lv.items || []).length), acts],
                     lv.id === E.level?.id && ch.id === E.mapId ? 'on' : '');
      tr.draggable = true; tr.dataset.i = i;
      lt.appendChild(tr);
    });
  }

  makeSortable($('mgChapters'), (f, t) => reorder(E.book.chapters, f, t, async () => {
    renumber();
    status('Đã đổi thứ tự chương', 'ok');
  }));
  makeSortable($('mgLevels'), (f, t) => reorder(viewed().levels, f, t, async () => {
    status('Đã đổi thứ tự level', 'ok');
  }));

  $('mgBtn').addEventListener('click', () => { viewId = E.mapId; render(); modal.hidden = false; });
  $('mgClose').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
  $('mgAddLevel').addEventListener('click', () => addLevel().catch(e => status('Lỗi: ' + e.message, 'bad')));

  return { render };
}
