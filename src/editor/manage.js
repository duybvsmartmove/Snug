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
  const save = async () => { await publish(); };

  // ---------- chương ----------
  const renumber = () => E.book.chapters.forEach((c, i) => { c.no = i + 1; });

  async function addChapter() {
    const name = prompt('Tên chương mới:', '');
    if (!name) return;
    const id = slugify(name);
    if (!id) return status('Tên chương không hợp lệ', 'bad');
    if (E.book.chapters.some(c => c.id === id)) return status(`Đã có chương mã "${id}"`, 'bad');
    E.book.chapters.push({ id, no: E.book.chapters.length + 1, name, background: 1, reward: { coin: 40 }, levels: [] });
    renumber(); await save();
    status(`Đã thêm chương "${name}"`, 'ok');
    render(); onReload?.(id);
  }

  async function renameChapter(i) {
    const c = E.book.chapters[i];
    const name = prompt('Tên chương:', c.name);
    if (!name || name === c.name) return;
    c.name = name; await save();
    status('Đã đổi tên chương', 'ok'); render(); onReload?.(E.mapId);
  }

  async function moveChapter(i, dir) {
    const j = i + dir, list = E.book.chapters;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    renumber(); await save();
    status('Đã đổi thứ tự chương', 'ok'); render(); onReload?.(E.mapId);
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
    const id = nextLevelId(E.mapId, E.map.levels.map(l => l.id));
    const lv = blankLevel(id);
    if (E.level) lv.container = clone(E.level.container);
    E.map.levels.push(lv); await save();
    status(`Đã thêm level ${E.map.levels.length}`, 'ok');
    render(); onLevelPicked?.(id);
  }
  async function moveLevel(i, dir) {
    const j = i + dir, l = E.map.levels;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]]; await save();
    status('Đã đổi thứ tự level', 'ok'); render(); onReload?.(E.mapId, E.level?.id);
  }
  async function deleteLevel(i) {
    const lv = E.map.levels[i];
    if (!confirm(`Xoá level ${i + 1} (${lv.name || lv.id})?`)) return;
    E.map.levels.splice(i, 1); await save();
    status(`Đã xoá level ${lv.id}`, 'ok'); render();
    onLevelPicked?.(E.map.levels[Math.min(i, E.map.levels.length - 1)]?.id);
  }
  async function duplicateLevel(i) {
    const src = E.map.levels[i];
    const id = nextLevelId(E.mapId, E.map.levels.map(l => l.id));
    E.map.levels.splice(i + 1, 0, { ...clone(src), id, name: `${src.name} (bản sao)` });
    await save();
    status('Đã nhân bản level', 'ok'); render(); onLevelPicked?.(id);
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

  function render() {
    const ct = $('mgChapters');
    ct.innerHTML = '<tr><th>#</th><th>Tên chương</th><th>Mã</th><th>Level</th><th></th></tr>';
    E.book.chapters.forEach((c, i) => {
      const acts = document.createElement('div'); acts.className = 'mini-row';
      acts.append(
        btn('↑', 'Lên trên', () => moveChapter(i, -1)),
        btn('↓', 'Xuống dưới', () => moveChapter(i, 1)),
        btn('Đổi tên', 'Đổi tên chương', () => renameChapter(i)),
        btn('Xoá', 'Xoá chương', () => deleteChapter(i), 'danger'),
      );
      ct.appendChild(row([String(i + 1), c.name, `<code>${c.id}</code>`, String(c.levels.length), acts],
        c.id === E.mapId ? 'on' : ''));
    });

    const lt = $('mgLevels');
    $('mgLevelHead').textContent = `Level của chương "${E.map.name}"`;
    lt.innerHTML = '<tr><th>#</th><th>Tên level</th><th>Mã</th><th>Món</th><th></th></tr>';
    E.map.levels.forEach((lv, i) => {
      const acts = document.createElement('div'); acts.className = 'mini-row';
      acts.append(
        btn('↑', 'Lên trên', () => moveLevel(i, -1)),
        btn('↓', 'Xuống dưới', () => moveLevel(i, 1)),
        btn('Mở', 'Mở level này', async () => { onLevelPicked?.(lv.id); modal.hidden = true; }),
        btn('Nhân bản', 'Tạo bản sao', () => duplicateLevel(i)),
        btn('Xoá', 'Xoá level', () => deleteLevel(i), 'danger'),
      );
      lt.appendChild(row([String(i + 1), lv.name || lv.id, `<code>${lv.id}</code>`, String((lv.items || []).length), acts],
        lv.id === E.level?.id ? 'on' : ''));
    });
  }

  $('mgBtn').addEventListener('click', () => { render(); modal.hidden = false; });
  $('mgClose').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
  $('mgAddChapter').addEventListener('click', () => addChapter().catch(e => status('Lỗi: ' + e.message, 'bad')));
  $('mgAddLevel').addEventListener('click', () => addLevel().catch(e => status('Lỗi: ' + e.message, 'bad')));

  return { render };
}
