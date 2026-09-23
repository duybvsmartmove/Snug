// Trang chủ và bản đồ chương.
//  - Trang chủ: đang ở chương nào, đã qua bao nhiêu màn, nút Chơi ở dưới cùng.
//  - Bản đồ: mọi chương và mọi màn, màn đã qua / đang mở / còn khoá.
import * as P from '../game/progress.js';
import { sfx, initAudio, setSfxOn, setMusicOn, isSfxOn, isMusicOn } from './sfx.js';
import { t, onLangChange, chapterName, levelName } from '../i18n.js';
import { artUrl, loadAssetIndex } from '../content/loader.js';

const $ = id => document.getElementById(id);

const ICON = {
  sfxOn:  '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.2L12 5.2v13.6L7.2 14.5H4z"/><path d="M15.4 8.6a4.6 4.6 0 0 1 0 6.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sfxOff: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.2L12 5.2v13.6L7.2 14.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  musOn:  '<svg viewBox="0 0 24 24"><path d="M10 18.2a2.6 2.6 0 1 1-2-2.53V7.1l10-2.1v9.3a2.6 2.6 0 1 1-2-2.53V7.4l-6 1.26z"/></svg>',
  musOff: '<svg viewBox="0 0 24 24" opacity=".92"><path d="M10 18.2a2.6 2.6 0 1 1-2-2.53V7.1l10-2.1v3.3l-10 2.1"/><path d="M4 4l16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  lock:   '<svg viewBox="0 0 24 24"><path d="M7 10V7.5a5 5 0 0 1 10 0V10h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm2 0h6V7.5a3 3 0 0 0-6 0z"/></svg>',
};

let CHAPTERS = [], onPlay = () => {};

// ---------- tra ảnh trong kho art ----------
// Mục lục lấy qua loader: nó biết lùi về bộ cozy khi bộ art đang chọn chưa có thư mục.
const manCache = new Map();

async function manifest(kind, id) {
  const key = kind + ':' + id;
  if (manCache.has(key)) return manCache.get(key);
  const p = (await loadAssetIndex())[kind]?.[id];
  const m = p ? await (await fetch(artUrl(p))).json() : null;
  manCache.set(key, m);
  return m;
}
/** Ảnh nền của một bối cảnh; mỗi bối cảnh là một PNG phủ kín màn */
async function bgUrl(id) {
  try {
    const src = (await manifest('backgrounds', id))?.layers?.[0]?.src;
    return src ? artUrl(src) : null;
  } catch { return null; }
}

// ---------- chuyển màn ----------
const shown = new Set();
function show(id) { $(id).classList.add('show'); shown.add(id); }
function hide(id) { $(id).classList.remove('show'); shown.delete(id); }
export const atHome = () => shown.has('home') || shown.has('mapscr');
/** Màn phủ đang mở: 'map' | 'home' | null (đang trong màn chơi) */
export const currentScreen = () => (shown.has('mapscr') ? 'map' : shown.has('home') ? 'home' : null);

export function showHome() {
  drawHome();
  hide('mapscr'); show('home');
  sfx('whoosh', { gain: .5 });
}
export function hideHome() { hide('home'); hide('mapscr'); }

export function showMap() {
  drawMap();
  show('mapscr');
  sfx('whoosh', { gain: .5, rate: 1.15 });
}
function backToHome() { drawHome(); hide('mapscr'); sfx('whoosh', { gain: .45, rate: .9 }); }

// ---------- trang chủ ----------
function drawHome() {
  const spot = P.getSpot(CHAPTERS);
  if (!spot) return;
  const { chapter: ch, index } = spot;
  const total = ch.levels.length, done = P.doneCount(ch.id, total);

  $('homeNo').textContent = t('chapter', { no: ch.no || 1 });
  $('homeName').textContent = chapterName(ch) || '—';
  $('homeCount').textContent = t('levelsDone', { done, total });
  $('homeNext').textContent = t('level', { n: index + 1 });
  // đặt trễ một nhịp để thanh tiến độ chạy từ trái sang, không nhảy cóc
  const bar = $('homeBar');
  bar.style.width = '0';
  requestAnimationFrame(() => { bar.style.width = (total ? done / total * 100 : 0) + '%'; });

  $('playLabel').textContent = t(done === 0 && index === 0 ? 'start' : 'resume');
  setArt(ch);
  setCardBg(ch);
}

/** Nền thẻ chương: lấy đúng bối cảnh của chương, phủ nửa trên rồi tan dần vào nền trắng */
async function setCardBg(ch) {
  const el = $('homeBg');
  const id = ch.assets?.backgrounds?.[0] ?? ch.levels?.[0]?.background;
  const url = id == null ? null : await bgUrl(id);
  el.style.backgroundImage = url ? `url("${url}")` : '';
}

/**
 * Ảnh minh hoạ thẻ chương: dùng thẳng sprite chiếc túi của chương đó.
 * Túi vẽ bằng ba lớp, riêng lớp thân chỉ là cái bóng trơn — phải chồng thêm lớp khung
 * mới ra hình chiếc túi hoàn chỉnh như trong game.
 */
async function setArt(ch) {
  const back = $('homeArt'), front = $('homeArt2');
  const clear = () => { back.removeAttribute('src'); front.removeAttribute('src'); };
  try {
    const L = await bagLayers(ch);
    if (L.body) back.src = artUrl(L.body); else back.removeAttribute('src');
    if (L.frame) front.src = artUrl(L.frame); else front.removeAttribute('src');
    if (!L.body && !L.frame) clear();
  } catch { clear(); }
}

// ---------- bản đồ ----------
function drawMap() {
  const list = $('mapList');
  list.innerHTML = '';
  CHAPTERS.forEach((ch, ci) => {
    const open = P.chapterUnlocked(CHAPTERS, ci);
    const total = ch.levels.length, done = P.doneCount(ch.id, total);
    const at = P.nextOpen(ch);

    const block = document.createElement('section');
    block.className = 'chblock' + (open ? '' : ' locked');
    block.style.animationDelay = (ci * .07) + 's';
    // Dải ảnh đầu mỗi chương: chính bối cảnh của chương đó, chữ nằm trên lớp phủ tối
    block.innerHTML = `
      <div class="chbanner">
        <div class="chbanner-img"></div>
        <div class="chbanner-txt">
          <span class="chblock-no">${t('chapter', { no: ch.no || ci + 1 })}</span>
          <h3>${esc(chapterName(ch))}</h3>
        </div>
        <span class="done">${done}/${total}</span>
      </div>`;
    paintBanner(block.querySelector('.chbanner-img'), ch);

    const body = document.createElement('div');
    body.className = 'chbody';
    if (!open) {
      const prev = CHAPTERS[ci - 1];
      body.innerHTML = `<div class="lockmsg">${ICON.lock}${t('finishToUnlock', { no: prev?.no || ci })}</div>`;
    } else {
      const grid = document.createElement('div');
      grid.className = 'lvgrid';
      ch.levels.forEach((lv, i) => {
        const isDone = P.isDone(ch.id, i), unlocked = P.levelUnlocked(ch, i);
        const b = document.createElement('button');
        b.className = 'lv ' + (isDone ? 'done' : !unlocked ? 'lock' : i === at ? 'now' : 'open');
        b.style.animationDelay = (ci * .07 + i * .022) + 's';
        b.innerHTML = `<span>${i + 1}</span>`;
        b.title = levelName(lv) || t('level', { n: i + 1 });
        if (!unlocked) b.disabled = true;
        else b.addEventListener('click', () => { sfx('tapBig'); play(ch, i); });
        grid.appendChild(b);
      });
      body.appendChild(grid);
    }
    block.appendChild(body);
    list.appendChild(block);
  });
}

/** Ảnh dải đầu chương */
async function paintBanner(el, ch) {
  const id = ch.assets?.backgrounds?.[0] ?? ch.levels?.[0]?.background;
  const url = id == null ? null : await bgUrl(id);
  if (url) el.style.backgroundImage = `url("${url}")`;
}

/**
 * Ba lớp ảnh của chiếc túi mà chương dùng. Lấy theo MÀN ĐẦU chương chứ không lấy
 * assets.bags[0]: danh sách đó xếp theo mục lục art nên cả hai chương đều ra ba lô,
 * trong khi túi thật của màn đầu là hộp cơm và túi rút.
 * Lớp thân chỉ là cái bóng trơn, phải chồng thêm lớp khung mới ra hình túi hoàn chỉnh.
 */
async function bagLayers(ch) {
  const kind = ch.levels?.[0]?.container?.skin || ch.assets?.bags?.[0];
  if (!kind) return {};
  return (await manifest('bags', kind))?.layers || {};
}

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- bắt đầu chơi ----------
function play(ch, idx) {
  P.setSpot(ch.id, idx);
  hideHome();
  onPlay(ch, idx);
}

// ---------- nút bật tắt tiếng ----------
function paintAudioButtons() {
  const s = $('sfxBtn'), m = $('musicBtn');
  s.innerHTML = isSfxOn() ? ICON.sfxOn : ICON.sfxOff;
  s.classList.toggle('off', !isSfxOn());
  m.innerHTML = isMusicOn() ? ICON.musOn : ICON.musOff;
  m.classList.toggle('off', !isMusicOn());
}

export function initHome({ chapters, onPlay: cb }) {
  CHAPTERS = chapters; onPlay = cb;

  $('playBtn').addEventListener('click', () => {
    const spot = P.getSpot(CHAPTERS); if (!spot) return;
    sfx('tapBig'); initAudio();        // nhạc do main.js bật khi vào level
    play(spot.chapter, spot.index);
  });
  $('mapBtn').addEventListener('click', () => { sfx('tap'); showMap(); });
  $('mapBack').addEventListener('click', () => { sfx('tap'); backToHome(); });

  // Đổi ngôn ngữ thì vẽ lại màn đang mở: chữ trên thẻ chương và bản đồ đều sinh bằng JS
  onLangChange(() => { paintAudioButtons(); if (shown.has('home')) drawHome(); if (shown.has('mapscr')) drawMap(); });
  $('sfxBtn').addEventListener('click', () => { setSfxOn(!isSfxOn()); paintAudioButtons(); });
  $('musicBtn').addEventListener('click', () => { setMusicOn(!isMusicOn()); paintAudioButtons(); });
  paintAudioButtons();
}
