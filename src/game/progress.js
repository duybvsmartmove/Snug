// Tiến độ người chơi, lưu ngay trong máy người chơi (localStorage).
// Luật mở khoá: trong một chương thì level mở tuần tự; chương sau mở khi chương trước xong hết.
// Mở địa chỉ kèm ?all=1 thì mở sẵn mọi level — dùng khi demo hoặc kiểm tra thiết kế.
const KEY = 'snug.progress.v1';

const blank = () => ({ chapter: null, level: 0, done: {} });
let data = load();

function load() {
  try { return { ...blank(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return blank(); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }

export const unlockAll = () => new URLSearchParams(location.search).get('all') === '1';

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
