// Trang chủ và bản đồ chương.
//  - Trang chủ: đang ở chương nào, đã qua bao nhiêu màn, nút Chơi ở dưới cùng.
//  - Bản đồ: mọi chương và mọi màn, màn đã qua / đang mở / còn khoá.
import * as P from '../game/progress.js';
import { sfx, initAudio, setSfxOn, setMusicOn, isSfxOn, isMusicOn } from './sfx.js';

const $ = id => document.getElementById(id);

const ICON = {
  sfxOn:  '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.2L12 5.2v13.6L7.2 14.5H4z"/><path d="M15.4 8.6a4.6 4.6 0 0 1 0 6.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sfxOff: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.2L12 5.2v13.6L7.2 14.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  musOn:  '<svg viewBox="0 0 24 24"><path d="M10 18.2a2.6 2.6 0 1 1-2-2.53V7.1l10-2.1v9.3a2.6 2.6 0 1 1-2-2.53V7.4l-6 1.26z"/></svg>',
  musOff: '<svg viewBox="0 0 24 24" opacity=".92"><path d="M10 18.2a2.6 2.6 0 1 1-2-2.53V7.1l10-2.1v3.3l-10 2.1"/><path d="M4 4l16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  lock:   '<svg viewBox="0 0 24 24"><path d="M7 10V7.5a5 5 0 0 1 10 0V10h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm2 0h6V7.5a3 3 0 0 0-6 0z"/></svg>',
};

let CHAPTERS = [], onPlay = () => {}, bagArt = null;

// ---------- chuyển màn ----------
const shown = new Set();
function show(id) { $(id).classList.add('show'); shown.add(id); }
function hide(id) { $(id).classList.remove('show'); shown.delete(id); }
export const atHome = () => shown.has('home') || shown.has('mapscr');

export function showHome() {
  drawHome();
  hide('mapscr'); show('home');
  sfx('whoosh', { gain: .5 });
}
export function hideHome() { hide('home'); hide('mapscr'); }

function showMap() {
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

  $('homeNo').textContent = `CHƯƠNG ${ch.no || 1}`;
  $('homeName').textContent = ch.name || '—';
  $('homeCount').textContent = `${done}/${total} màn`;
  $('homeNext').textContent = `LEVEL ${index + 1}`;
  // đặt trễ một nhịp để thanh tiến độ chạy từ trái sang, không nhảy cóc
  const bar = $('homeBar');
  bar.style.width = '0';
  requestAnimationFrame(() => { bar.style.width = (total ? done / total * 100 : 0) + '%'; });

  $('playLabel').textContent = done === 0 && index === 0 ? 'Bắt đầu' : 'Chơi tiếp';
  setArt(ch);
}

/**
 * Ảnh minh hoạ thẻ chương: dùng thẳng sprite chiếc túi của chương đó.
 * Túi vẽ bằng ba lớp, riêng lớp thân chỉ là cái bóng trơn — phải chồng thêm lớp khung
 * mới ra hình chiếc túi hoàn chỉnh như trong game.
 */
async function setArt(ch) {
  const back = $('homeArt'), front = $('homeArt2');
  const clear = () => { back.removeAttribute('src'); front.removeAttribute('src'); };
  const kind = ch.assets?.bags?.[0];
  if (!kind) return clear();
  try {
    if (!bagArt) bagArt = (await (await fetch('./content/assets/index.json')).json()).bags || {};
    const path = bagArt[kind]; if (!path) return clear();
    const man = await (await fetch('./content/' + path)).json();
    const L = man.layers || {};
    if (L.body) back.src = './content/' + L.body; else back.removeAttribute('src');
    if (L.frame) front.src = './content/' + L.frame; else front.removeAttribute('src');
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
    block.innerHTML = `
      <div class="chblock-head">
        <span class="chblock-no">CHƯƠNG ${ch.no || ci + 1}</span>
        <span class="done">${done}/${total}</span>
      </div>
      <h3>${esc(ch.name || '')}</h3>`;

    if (!open) {
      const prev = CHAPTERS[ci - 1];
      block.insertAdjacentHTML('beforeend',
        `<div class="lockmsg">${ICON.lock}Xong Chương ${prev?.no || ci} để mở</div>`);
    } else {
      const grid = document.createElement('div');
      grid.className = 'lvgrid';
      ch.levels.forEach((lv, i) => {
        const isDone = P.isDone(ch.id, i), unlocked = P.levelUnlocked(ch, i);
        const b = document.createElement('button');
        b.className = 'lv ' + (isDone ? 'done' : !unlocked ? 'lock' : i === at ? 'now' : 'open');
        b.style.animationDelay = (ci * .07 + i * .022) + 's';
        b.innerHTML = `<span>${i + 1}</span>`;
        b.title = lv.name || `Level ${i + 1}`;
        if (!unlocked) b.disabled = true;
        else b.addEventListener('click', () => { sfx('tapBig'); play(ch, i); });
        grid.appendChild(b);
      });
      block.appendChild(grid);
    }
    list.appendChild(block);
  });
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

  $('sfxBtn').addEventListener('click', () => { setSfxOn(!isSfxOn()); paintAudioButtons(); });
  $('musicBtn').addEventListener('click', () => { setMusicOn(!isMusicOn()); paintAudioButtons(); });
  paintAudioButtons();
}
