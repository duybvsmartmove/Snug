// HUD: tên level, pause, đồng hồ đếm ngược, số món còn lại, toast, các overlay thắng / thua / tạm dừng.
import { S } from '../game/state.js';
import { sfx, duckMusic } from './sfx.js';
import { shake } from '../game/fx.js';

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
let shownLeft = -1;
export function renderList() {
  const left = Math.max(0, S.ITEMS.length - S.checked.size);
  if (left === shownLeft) return;
  shownLeft = left;
  countEl.textContent = left;
  // con số nảy một nhịp mỗi lần đổi, để mắt bắt được là vừa xếp thêm được một món
  countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump');
  countEl.parentElement.classList.toggle('clear', left === 0);
}
/** Giữ tên cũ cho các module khác gọi khi mở hộp bí ẩn (không còn thumbnail để vẽ lại) */
export function repaintSlot() {}
export function rebuildStrip() { renderList(); }

// ---------- đồng hồ đếm ngược ----------
const fmt = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
export function updateClock() {
  const sec = Math.ceil(S.timeLeft / 1000);
  if (sec !== S.shownSec) {
    const urgent = sec <= 10 && sec > 0 && !S.won && !S.lost;
    // mười giây cuối kêu tích tắc, càng gần hết càng cao
    if (urgent && S.shownSec >= 0 && S.timerOn) sfx('tick', { rate: 1 + (10 - sec) * .05, gain: .55 });
    S.shownSec = sec;
    clockEl.textContent = fmt(Math.max(0, sec));
    clockEl.classList.toggle('urgent', urgent);
  }
}

// ---------- overlay ----------
const show = id => $(id).classList.add('show');
const hide = id => $(id).classList.remove('show');
const giay = s => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/**
 * Bảng điểm màn thắng. Mỗi dòng là một thứ người chơi tác động được, để lần sau
 * biết mình thua ở đâu mà sửa: xếp chưa gọn, hay chỉ là chậm giờ.
 */
function renderScore(d) {
  const el = $('winScore'); if (!el || !d) return;
  const dong = (ten, tiLe, chu, am) =>
    `<div class="srow"><span>${ten}</span><span class="bar"><i class="${am ? 'warm' : ''}" data-w="${Math.round(tiLe * 100)}"></i></span><b>${chu}</b></div>`;
  el.innerHTML =
    `<div class="tong">Điểm <b>${d.diem}</b> / 100</div>` +
    // Hiện mức so với cách xếp tốt nhất của màn này, không hiện con số đã quy đổi ra điểm:
    // "xếp gọn 88%" nghĩa là gần bằng mức khít nhất màn này cho phép, dễ hiểu hơn nhiều.
    dong('Xếp gọn', d.tiLeGon, `${Math.round(d.tiLeGon * 100)}%`) +
    dong('Chỗ trống thừa', d.trong, `${Math.round(d.trong * 100)}%`, true) +
    dong('Thời gian', d.thoiGian, giay(d.tongGiay - d.dungGiay)) +
    dong('Booster', d.tietKiem, `${d.dungBooster}/${d.tongBooster}`);
  // đặt trễ một nhịp để các thanh chạy từ trái sang thay vì hiện sẵn
  requestAnimationFrame(() => el.querySelectorAll('.bar i').forEach(i => { i.style.width = i.dataset.w + '%'; }));

  // sao sáng theo điểm, sao chưa đạt thì để mờ
  $('win').querySelectorAll('.stars svg').forEach((sv, i) => sv.classList.toggle('mo', i >= d.sao));
}

export function showWin(text, diem) { $('winText').textContent = text; renderScore(diem); show('win'); }
export function hideWin() { hide('win'); }
export function showLose() {
  const left = S.ITEMS.length - S.checked.size;
  $('loseText').textContent = `Còn ${left} món chưa vào túi.`;
  sfx('lose'); shake(420); duckMusic(true);
  show('lose');
}
export function hideLose() { hide('lose'); }
export function hidePause() { hide('pause'); S.paused = false; }

/** Gắn hành động kèm tiếng bấm — mọi nút trong game đều đi qua đây */
function onTap(id, fn, sound = 'tap') {
  const el = $(id); if (!el) return;
  el.addEventListener('click', e => { sfx(sound); fn(e); });
}

export function bindOverlayButtons({ onAgain, onNext, onExtraTime, onPrev, onHome }) {
  onTap('again', onAgain, 'tapBig');
  onTap('retry', onAgain, 'tapBig');
  onTap('restartBtn', () => { hidePause(); onAgain(); }, 'tapBig');
  onTap('next', onNext, 'tapBig');
  onTap('nextLv', () => { hidePause(); onNext(); });
  onTap('prevLv', () => { hidePause(); onPrev(); });
  onTap('extraTime', onExtraTime, 'tapBig');
  onTap('pauseBtn', () => { if (S.won || S.lost) return; S.paused = true; duckMusic(true); show('pause'); });
  onTap('resumeBtn', () => { hidePause(); duckMusic(false); });
  for (const id of ['homeBtn', 'winHome', 'loseHome']) {
    onTap(id, () => { hidePause(); hideWin(); hideLose(); duckMusic(false); onHome && onHome(); });
  }
}

// Không còn dùng, giữ để tương thích lời gọi cũ
export function setRotateEnabled() {}
export function bindLevelNav() {}
