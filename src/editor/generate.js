// Tab Generate: template + seed → level, dùng container hiện tại ở tab Draw.
import { ITEM_DEFS } from '../data/items.js';
import { generate } from '../gen/generator.js';

const $ = id => document.getElementById(id);

export function initGenerate({ E, setLevel, areaOf, status }) {
  const poolEl = $('gPool');
  const checked = new Set(ITEM_DEFS.filter(d => d.id > 0).map(d => d.id));

  function refresh() {
    poolEl.innerHTML = '';
    for (const d of ITEM_DEFS) {
      if (d.id <= 0) continue;
      const lab = document.createElement('label'); lab.className = checked.has(d.id) ? 'on' : '';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = checked.has(d.id);
      cb.addEventListener('change', () => { cb.checked ? checked.add(d.id) : checked.delete(d.id); lab.classList.toggle('on', cb.checked); });
      lab.append(cb, document.createTextNode(`${d.id} · ${d.name}`));
      poolEl.appendChild(lab);
    }
  }

  function template() {
    return {
      id: E.level.id, name: E.level.name, timer: +$('gTimer').value || 90, background: E.level.background,
      seed: +$('gSeed').value || 1, tier: $('gTier').value || null,
      pool: [...checked], count: [+$('gCountMin').value, +$('gCountMax').value],
      density: [+$('gDenMin').value / 100, +$('gDenMax').value / 100],
      sizeDist: { L: +$('gL').value, M: +$('gM').value },
      mechanics: { linked: +$('gLinked').value, locked: +$('gLocked').value },
      container: E.level.container,
    };
  }
  function run() {
    const t = template();
    if (t.pool.length < t.count[1]) return status('Kho đồ ít hơn số món tối đa', 'bad');
    const r = generate(t, areaOf);
    if (!r) return status('Không sinh được level nào hợp lệ', 'bad');
    const lv = r.level; lv.id = E.level.id; lv.name = E.level.name; lv.reward = E.level.reward;
    setLevel(lv, { keepId: true });
    $('gInfo').textContent = `${r.diff.total} điểm · ${r.diff.tier} · đầy ${(r.diff.density * 100).toFixed(0)}% (muốn ${(r.target * 100).toFixed(0)}%) · ${r.sol.solvable ? 'xếp được' : 'chặt tay'}${r.hint ? ' · ' + r.hint : ''}`;
    status(r.hint ? 'Đã sinh nhưng chưa đạt density' : 'Đã sinh level. Sang tab Draw để chỉnh tay hoặc Save.', r.hint ? 'bad' : 'ok');
  }
  $('gRun').addEventListener('click', run);
  $('gReroll').addEventListener('click', () => { $('gSeed').value = Math.floor(Math.random() * 1e6); run(); });
  refresh();
  return { refresh };
}
