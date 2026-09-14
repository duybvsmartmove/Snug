// HUD: tên level, pause, đồng hồ đếm ngược, số món còn lại, toast, các overlay thắng / thua / tạm dừng.
import { S } from '../game/state.js';

const $ = id => document.getElementById(id);
const hint = $('hint'), countEl = $('count'), clockEl = $('clock');

// ---------- toast ----------
let toastTimer = null;
export function toast(text, ms = 1400) {
  hint.textContent = text; hint.classList.remove('hide');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => hint.classList.add('hide'), ms);
}
export function showHint(text) { clearTimeout(toastTimer); hint.textContent = text; hint.classList.remove('hide'); }
export function hideHint() { hint.classList.add('hide'); }
// ---------- header ----------
export function renderHeader({ eyebrow, title, cls }) {
  $('phone').className = cls || '';
  $('eyebrow').textContent = eyebrow;
  $('title').textContent = title;
}

// ---------- tiến độ ----------
export function renderList() {
  const left = Math.max(0, S.ITEMS.length - S.checked.size);
  countEl.textContent = left;
}
/** Giữ tên cũ cho các module khác gọi khi mở hộp bí ẩn (không còn thumbnail để vẽ lại) */
export function repaintSlot() {}
export function rebuildStrip() { renderList(); }

// ---------- đồng hồ đếm ngược ----------
const fmt = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
export function updateClock() {
  const sec = Math.ceil(S.timeLeft / 1000);
  if (sec !== S.shownSec) {
    S.shownSec = sec;
    clockEl.textContent = fmt(Math.max(0, sec));
    clockEl.classList.toggle('urgent', sec <= 10 && !S.won);
  }
}

// ---------- overlay ----------
const show = id => $(id).classList.add('show');
const hide = id => $(id).classList.remove('show');
export function showWin(text) { $('winText').textContent = text; show('win'); }
export function hideWin() { hide('win'); }
export function showLose() {
  const left = S.ITEMS.length - S.checked.size;
  $('loseText').textContent = `Còn ${left} món chưa vào túi.`;
  show('lose');
}
export function hideLose() { hide('lose'); }
export function hidePause() { hide('pause'); S.paused = false; }

export function bindOverlayButtons({ onAgain, onNext, onExtraTime, onPrev }) {
  $('again').addEventListener('click', onAgain);
  $('retry').addEventListener('click', onAgain);
  $('restartBtn').addEventListener('click', () => { hidePause(); onAgain(); });
  $('next').addEventListener('click', onNext);
  $('nextLv').addEventListener('click', () => { hidePause(); onNext(); });
  $('prevLv').addEventListener('click', () => { hidePause(); onPrev(); });
  $('extraTime').addEventListener('click', onExtraTime);
  $('pauseBtn').addEventListener('click', () => { if (S.won || S.lost) return; S.paused = true; show('pause'); });
  $('resumeBtn').addEventListener('click', hidePause);
}

// Không còn dùng, giữ để tương thích lời gọi cũ
export function setRotateEnabled() {}
export function bindLevelNav() {}
