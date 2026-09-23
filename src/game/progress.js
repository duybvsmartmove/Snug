// Tiến độ người chơi, lưu ngay trong máy người chơi (localStorage).
// Luật mở khoá: trong một chương thì level mở tuần tự; chương sau mở khi chương trước xong hết.
// Mở địa chỉ kèm ?all=1 thì mở sẵn mọi level — dùng khi demo hoặc kiểm tra thiết kế.
const PARAMS = new URLSearchParams(location.search);
// Mỗi bộ art có level riêng nên tiến độ cũng riêng: level 7 của cozy không phải level 7 của casual.
// Cozy giữ khoá cũ để không mất save đang có. Bộ art chỉ biết được sau khi đọc config.json,
// nên main.js gọi useArtProgress() rồi mới dựng trang chủ.
const keyOf = art => (art === 'casual' ? 'snug.progress.v1.casual' : 'snug.progress.v1');
let KEY = keyOf(PARAMS.get('art'));

const blank = () => ({ chapter: null, level: 0, done: {} });
// Creative Tool chạy cùng origin với game nên dùng chung localStorage. Ở chế độ đó chỉ
// giữ tiến độ trong bộ nhớ: quay video xong không được làm đổi save của người chơi thật.
const CREATIVE = PARAMS.get('creative') === '1';
let data = CREATIVE ? blank() : load();

function load() {
  try { return { ...blank(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return blank(); }
}
/** Chuyển sang tiến độ của bộ art đang chơi */
export function useArtProgress(art) {
  KEY = keyOf(art);
  if (!CREATIVE) data = load();
}
function save() { if (CREATIVE) return; try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }

export const unlockAll = () => CREATIVE || PARAMS.get('all') === '1';

const doneList = id => (data.done[id] ||= []);
export const isDone = (chId, idx) => !!doneList(chId)[idx];
export const doneCount = (chId, total) => { const l = doneList(chId); let n = 0; for (let i = 0; i < total; i++) if (l[i]) n++; return n; };
export const chapterDone = ch => doneCount(ch.id, ch.levels.length) >= ch.levels.length;

/** Level đã mở chưa: level đầu luôn mở, các level sau cần level liền trước đã xong */
export function levelUnlocked(ch, idx) {
  if (unlockAll() || idx === 0) return true;
  return isDone(ch.id, idx - 1);
}

/** Chương đã mở chưa: chương đầu luôn mở, chương sau cần chương trước xong hết */
export function chapterUnlocked(chapters, i) {
  if (unlockAll() || i === 0) return true;
  return chapterDone(chapters[i - 1]);
}

/** Ghi nhận thắng một level. Trả về true nếu đây là lần đầu qua level đó. */
export function markDone(chId, idx) {
  const l = doneList(chId);
  const first = !l[idx];
  l[idx] = true;
  save();
  return first;
}

/** Chỗ người chơi đang đứng, để nút Chơi tiếp biết mở level nào */
export function getSpot(chapters) {
  const ch = chapters.find(c => c.id === data.chapter) || chapters[0];
  if (!ch) return null;
  const idx = Math.min(Math.max(0, data.level | 0), ch.levels.length - 1);
  return { chapter: ch, index: levelUnlocked(ch, idx) ? idx : nextOpen(ch) };
}

/** Level chưa qua gần nhất trong chương; xong hết rồi thì về level cuối */
export function nextOpen(ch) {
  for (let i = 0; i < ch.levels.length; i++) if (!isDone(ch.id, i)) return i;
  return ch.levels.length - 1;
}

export function setSpot(chId, idx) { data.chapter = chId; data.level = idx | 0; save(); }

export function resetAll() { data = blank(); save(); }
