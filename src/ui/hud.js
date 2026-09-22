// HUD: tên level, pause, đồng hồ đếm ngược, số món còn lại, toast, các overlay thắng / thua / tạm dừng.
import { S } from '../game/state.js';
import { sfx, duckMusic } from './sfx.js';
import { shake } from '../game/fx.js';
import { t } from '../i18n.js';

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

const HINH_SAO = '<svg viewBox="0 0 24 24"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z"/></svg>';

/**
 * Năm ngôi sao, sáng theo điểm tới từng nửa sao.
 * Mỗi ngôi là một sao xám, đè lên trên là đúng ngôi đó màu vàng nhưng bị cắt bớt bề
 * ngang — cắt 50% thì ra nửa sao. Làm bằng cách này nên nửa sao trông đúng là một ngôi
 * sao bị lấp một nửa, chứ không phải một hình sao méo.
 */
function renderStars(sao) {
  const el = $('winStars'); if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const day = Math.max(0, Math.min(1, sao - i));
    const o = document.createElement('span');
    o.className = 'star';
    o.style.animationDelay = (.1 + i * .11) + 's';
    o.innerHTML = HINH_SAO + `<span class="fill" style="width:${day * 100}%">${HINH_SAO}</span>`;
    el.appendChild(o);
  }
}

/**
 * Thứ hạng so với "người chơi khác".
 *
 * ĐỌC KỸ TRƯỚC KHI SỬA: con số này KHÔNG phải số liệu thật. Game chạy trọn trên máy,
 * không có máy chủ nào thu điểm của ai, nên không có phân bố điểm nào để so. Đây là một
 * con số dựng ra từ chính ván vừa chơi, đặt theo yêu cầu thiết kế, để người chơi thấy
 * ván của mình có giá. Đừng đem nó đi làm thống kê, báo cáo hay quảng cáo.
 *
 * Dựng từ hai thứ người chơi vừa làm: điểm (nặng hơn) và thời gian còn dư. Hàm luỹ thừa
 * .8 làm khúc trên thoải ra, nên muốn chạm 99% phải gần như hoàn hảo chứ không phải thắng
 * là được. Không có ngẫu nhiên: cùng một ván thì luôn ra cùng một số, chơi lại y hệt mà
 * số nhảy lung tung thì lộ ngay là bịa.
 *
 * Muốn thành số thật: gửi { màn, điểm, thời gian } lên máy chủ, đọc về phân vị thật của
 * màn đó, rồi thay nguyên hàm này.
 */
const PCT_MIN = 60, PCT_MAX = 99;
const BAO_HOA = .85;   // mức pha điểm+thời gian coi như đã kịch trần
function thuHang(d) {
  const kep = (v, a, b) => Math.max(a, Math.min(b, v));
  const diem = kep((d.diem || 0) / 100, 0, 1);
  const nhanh = d.tongGiay > 0 ? kep(1 - d.dungGiay / d.tongGiay, 0, 1) : .5;
  // Chia cho BAO_HOA: trọn 100 điểm mà vẫn dùng hết giờ thì phần pha mới chỉ tới .8,
  // không chia thì 99% thành con số không ai với tới và cả thang dồn hết vào khúc 90.
  const t = kep((diem * .8 + nhanh * .2) / BAO_HOA, 0, 1);
  // Nhích nhẹ theo từng màn cho dãy số đỡ lặp đúng một mẫu. Nhân (1 - t) để ván gần
  // hoàn hảo không bị cái nhích này kéo tụt khỏi mốc 99.
  const nhich = ((S.LEVEL?.id || '').split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 97, 7) % 5) - 2;
  const pct = PCT_MIN + Math.pow(t, 1.2) * (PCT_MAX - PCT_MIN) + nhich * (1 - t);
  return kep(Math.round(pct), PCT_MIN, PCT_MAX);
}

/**
 * Danh hiệu của ván vừa thắng.
 *
 * Khác với con số phần trăm ở trên, danh hiệu dựa trên số liệu THẬT: d.tiLeGon là mức
 * khít của người chơi so với cách xếp tốt nhất máy tìm được cho chính màn này (score.js
 * đo sẵn). Mỗi màn có một trần khít riêng — bộ đồ càng tròn thì trần càng thấp — nên
 * danh hiệu phản ánh đúng cái khó của màn vừa chơi.
 */
function danhGia(d) {
  const p = Math.round((d.tiLeGon || 0) * 100);
  const hang = t(p >= 99 ? 'rank99' : p >= 93 ? 'rank93' : p >= 84 ? 'rank84' : p >= 72 ? 'rank72' : 'rank0');
  return { hang, khoe: t('brag', { pct: thuHang(d) }) };
}

/**
 * Bảng thắng. Trước đây là bốn thanh tiến độ, một dòng tổng điểm và một dòng mô tả —
 * sáu con số cho cùng một câu hỏi duy nhất "mình xếp có khéo không". Người chơi vừa ăn
 * mừng xong thì không ngồi đọc bảng thống kê. Giữ một câu nói rõ vừa làm được gì, ba
 * con số phụ thu thành ba ô nhỏ bên dưới.
 */
function renderScore(d) {
  const el = $('winScore'); if (!el || !d) return;
  const o = (so, ten) => `<div class="chip"><b>${so}</b><span>${ten}</span></div>`;
  el.innerHTML = o(d.diem, t('scorePts')) + o(giay(d.dungGiay), t('scoreTime')) + o(`${d.dungBooster}/${d.tongBooster}`, t('scoreBoost'));
  renderStars(d.sao);
}

export function showWin(diem) {
  const { hang, khoe } = danhGia(diem || {});
  $('winRank').textContent = hang;
  $('winText').innerHTML = khoe;
  renderScore(diem);
  show('win');
}
export function hideWin() { hide('win'); }
export function showLose() {
  const left = S.ITEMS.length - S.checked.size;
  $('loseText').textContent = t('leftInTray', { n: left });
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
