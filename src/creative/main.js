// Creative Tool: cho team creative chụp ảnh store và quay video gameplay.
//
// Game chạy thật trong iframe (index.html?creative=1), tool chỉ đứng ngoài điều khiển
// qua postMessage — xem src/game/creative.js cho danh sách lệnh. Nhờ vậy bảng thắng,
// bảng thua, HUD, nhạc… đúng y như game người chơi cầm trên tay.
import { loadBook, loadAssetIndex, artUrl, setArtStyle } from '../content/loader.js';

const $ = id => document.getElementById(id);
const frame = $('game');

// ---------- cài đặt, nhớ trong trình duyệt ----------
const KEY = 'snug.creative.v1';
const DEF = { aspect: '9:16', art: 'cozy', lang: 'en', play: 1, time: 1, finger: true, timer: true, autoBoost: false, boosts: '', hide: {} };
const cfg = { ...DEF, ...(() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })() };
const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };

// Kích thước xuất theo tỉ lệ: đúng cỡ ảnh store, quay/chụp ra là dùng ngay
const EXPORT = { '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const AR = { '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 };

let book = null, ready = false, current = null;   // current = { chapter, index }
let status = null;                                 // bản status mới nhất từ game

// ---------- trạng thái ----------
function note(text, cls = '') {
  const s = $('status'); s.textContent = text; s.className = 'status ' + cls;
  if (text) setTimeout(() => { if (s.textContent === text) s.textContent = ''; }, 3500);
}
const post = msg => { if (ready) frame.contentWindow.postMessage(msg, '*'); };

// ---------- iframe ----------
function loadFrame() {
  ready = false;
  frame.src = `./index.html?creative=1&art=${cfg.art}&lang=${cfg.lang}&t=${Date.now()}`;
}
/** Gửi lại toàn bộ cài đặt sau mỗi lần iframe nạp */
function pushAll() {
  post({ type: 'speed', play: cfg.play, time: cfg.time });
  post({ type: 'finger', on: cfg.finger });
  post({ type: 'autoboost', on: cfg.autoBoost });
  post({ type: 'timer', on: cfg.timer });
  post({ type: 'boosts', n: cfg.boosts === '' ? null : Number(cfg.boosts) });
  post({ type: 'hud', hide: cfg.hide });
  post({ type: 'lang', lang: cfg.lang });
}

window.addEventListener('message', e => {
  const m = e.data || {};
  if (m.type === 'ready') {
    ready = true; pushAll();
    if (current) post({ type: 'play', chapter: current.chapter, index: current.index });
  }
  if (m.type === 'status') { status = m; paintStatus(); }
  if (m.type === 'key') onKey(m.key);
});

// ---------- sân khấu: khung theo tỉ lệ ----------
function layoutStage() {
  const wrap = $('stageWrap'), st = $('stage');
  const ar = AR[cfg.aspect] || AR['9:16'];
  const pad = document.body.classList.contains('hide-ui') ? 0 : 28;
  const W = wrap.clientWidth - pad, H = wrap.clientHeight - pad;
  let w, h;
  if (W / H > ar) { h = H; w = h * ar; } else { w = W; h = w / ar; }
  st.style.width = Math.floor(w) + 'px'; st.style.height = Math.floor(h) + 'px';
  st.dataset.ar = cfg.aspect;
  $('sizeTag').textContent = EXPORT[cfg.aspect].join('×');
}
window.addEventListener('resize', layoutStage);

/** Phần khung thừa ở 1:1 và 4:5 tô bằng bối cảnh của màn đang chơi, làm mờ */
let lastBg = null;
function paintStageBg() {
  const sc = status?.scene; if (!sc) return;
  const el = $('stageBg');
  el.style.backgroundColor = sc.fill || '#EADFD6';
  if (sc.bg !== lastBg) { lastBg = sc.bg; el.style.backgroundImage = sc.bg ? `url("${sc.bg}")` : 'none'; }
}

// ---------- vẽ thanh công cụ theo status ----------
function paintStatus() {
  const s = status; if (!s) return;
  paintStageBg();
  const auto = $('autoBtn'), step = $('stepBtn');
  const fullOn = s.auto !== 'idle' && s.autoMode === 'full';
  auto.className = 'btn' + (fullOn ? ' live' : '');
  auto.innerHTML = fullOn ? '■ Stop <kbd>S</kbd>' : '▶ Auto <kbd>S</kbd>';
  const stepping = s.auto !== 'idle' && s.autoMode === 'step';
  step.className = 'btn' + (stepping ? (s.auto === 'waiting' ? ' wait' : ' live') : '');
  step.innerHTML = stepping ? (s.auto === 'waiting' ? '⏭ Món tiếp <kbd>D</kbd>' : '… đang xếp') : '⏭ 1 món <kbd>D</kbd>';
  const busy = s.won || s.lost || s.screen !== 'level';
  auto.disabled = busy; step.disabled = busy;

  // tên level đang mở
  const tag = $('lvTag');
  if (s.screen === 'home') tag.innerHTML = '🏠 Trang chủ';
  else if (s.screen === 'map') tag.innerHTML = '🗺 Bản đồ';
  else if (s.levelId) {
    const ch = book?.chapters.find(c => c.id === s.chapter), lv = ch?.levels[s.index];
    const name = cfg.lang === 'vi' ? lv?.name : (lv?.nameEn || lv?.name);
    const tier = lv?.difficulty?.tier;
    tag.innerHTML = `<b>Level ${s.index + 1}</b> · ${esc(name || s.levelId)}${tier ? `<span class="tier ${tier.split(' ')[0]}">${tier} ${lv.difficulty.points ?? ''}</span>` : ''}`
      + (s.won ? ' · <b style="color:var(--accent2)">WIN</b>' : s.lost ? ' · <b style="color:#FF6B6B">LOSE</b>' : ` · ${s.left}/${s.items}`);
  } else tag.textContent = '—';
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- màn chọn level ----------
async function bgOf(ch) {
  try {
    const idx = await loadAssetIndex();
    const id = ch.assets?.backgrounds?.[0] ?? ch.levels?.[0]?.background;
    const p = idx.backgrounds?.[id]; if (!p) return null;
    const m = await (await fetch(artUrl(p))).json();
    const src = m.layers?.[0]?.src;
    return src ? artUrl(src) : null;
  } catch { return null; }
}

function drawPicker() {
  const list = $('pkList'); list.innerHTML = '';
  book.chapters.forEach((ch, ci) => {
    const sec = document.createElement('section'); sec.className = 'ch';
    const items = ch.levels.reduce((n, l) => n + (l.items?.length || 0), 0);
    sec.innerHTML = `
      <div class="ch-banner">
        <div class="ch-banner-img"></div>
        <div class="ch-banner-txt"><span class="ch-no">Chương ${ch.no || ci + 1}</span><h2>${esc(ch.name || ch.id)}</h2></div>
        <span class="meta">${ch.levels.length} level · ${items} món</span>
      </div>
      <div class="lv-grid"></div>`;
    bgOf(ch).then(u => { if (u) sec.querySelector('.ch-banner-img').style.backgroundImage = `url("${u}")`; });
    const grid = sec.querySelector('.lv-grid');
    ch.levels.forEach((lv, i) => {
      const tier = lv.difficulty?.tier, pts = lv.difficulty?.points;
      const b = document.createElement('button'); b.className = 'lv';
      const vi = lv.name || '', en = lv.nameEn || '';
      const main = cfg.lang === 'vi' ? vi : (en || vi), sub = cfg.lang === 'vi' ? en : (en ? vi : '');
      b.innerHTML = `<span class="no">${i + 1}</span>
        <span class="name">${esc(main || lv.id)}${sub && sub !== main ? `<small>${esc(sub)}</small>` : ''}</span>
        <span class="foot"><span class="tier ${tier ? tier.split(' ')[0] : 'none'}">${tier ? `${tier} · ${pts ?? 0}` : 'chưa đo'}</span><span>${lv.items?.length || 0} món · ${lv.timer || 0}s</span></span>`;
      b.addEventListener('click', () => play(ch.id, i));
      grid.appendChild(b);
    });
    list.appendChild(sec);
  });
}

function play(chapter, index) {
  current = { chapter, index };
  $('picker').hidden = true;
  post({ type: 'play', chapter, index });
  layoutStage();
}
function showScreen(name) {
  current = null;
  $('picker').hidden = true;
  post({ type: 'screen', name });
  layoutStage();
}
function backToPicker() {
  post({ type: 'autostop' });
  post({ type: 'screen', name: 'home' });   // game về trang chủ, đứng chờ phía sau
  current = null;
  drawPicker();
  $('picker').hidden = false;
}

// ---------- nút ----------
$('backBtn').addEventListener('click', backToPicker);
document.querySelectorAll('[data-screen]').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.screen)));
$('resetBtn').addEventListener('click', () => post({ type: 'restart' }));
$('autoBtn').addEventListener('click', toggleAuto);
$('stepBtn').addEventListener('click', () => post({ type: 'auto', mode: 'step' }));
function toggleAuto() {
  if (status?.auto !== 'idle' && status?.autoMode === 'full') post({ type: 'autostop' });
  else post({ type: 'auto', mode: 'full' });
}

const fmtX = v => (Number(v) % 1 ? Number(v).toFixed(2).replace(/0$/, '') : String(v)) + 'x';
function bindSlider(id, key, msgKey) {
  const el = $(id), lab = $(id + 'V');
  el.value = cfg[key]; lab.textContent = fmtX(cfg[key]);
  el.addEventListener('input', () => {
    cfg[key] = Number(el.value); lab.textContent = fmtX(cfg[key]); saveCfg();
    post({ type: 'speed', [msgKey]: cfg[key] });
  });
}
bindSlider('playSpeed', 'play', 'play');
bindSlider('timeScale', 'time', 'time');

/** Nút bật tắt; trả về hàm đảo trạng thái để phím tắt dùng chung */
function bindToggle(id, key, send) {
  const el = $(id);
  const paint = () => el.classList.toggle('on', !!cfg[key]);
  const flip = () => { cfg[key] = !cfg[key]; saveCfg(); paint(); send(cfg[key]); };
  paint();
  el.addEventListener('click', flip);
  return flip;
}
const toggleFinger = bindToggle('fingerBtn', 'finger', on => post({ type: 'finger', on }));
const toggleTimer = bindToggle('timerBtn', 'timer', on => post({ type: 'timer', on }));
bindToggle('autoBoostBtn', 'autoBoost', on => post({ type: 'autoboost', on }));

$('boosts').value = cfg.boosts;
$('boosts').addEventListener('change', e => { cfg.boosts = e.target.value; saveCfg(); post({ type: 'boosts', n: cfg.boosts === '' ? null : Number(cfg.boosts) }); });

document.querySelectorAll('[data-hud]').forEach(cb => {
  cb.checked = !!cfg.hide[cb.dataset.hud];
  cb.addEventListener('change', () => { cfg.hide[cb.dataset.hud] = cb.checked; saveCfg(); post({ type: 'hud', hide: cfg.hide }); });
});
document.addEventListener('click', e => { if (!$('hudDd').contains(e.target)) $('hudDd').open = false; });

$('aspect').value = cfg.aspect;
$('aspect').addEventListener('change', e => { cfg.aspect = e.target.value; saveCfg(); layoutStage(); });

$('art').value = cfg.art;
document.documentElement.dataset.art = cfg.art;
$('art').addEventListener('change', e => {
  cfg.art = e.target.value; saveCfg();
  document.documentElement.dataset.art = cfg.art;
  setArtStyle(cfg.art);
  // Ảnh nạp theo thư mục lúc khởi động nên phải nạp lại iframe; level đang mở sẽ được mở lại khi ready
  loadFrame();
  if (!$('picker').hidden) drawPicker();
});

$('lang').value = cfg.lang;
$('lang').addEventListener('change', e => {
  cfg.lang = e.target.value; saveCfg();
  post({ type: 'lang', lang: cfg.lang });
  if (!$('picker').hidden) drawPicker();
  paintStatus();
});

// ---------- ẩn UI ----------
function toggleUi() {
  document.body.classList.toggle('hide-ui');
  layoutStage();
}
$('hideBtn').addEventListener('click', toggleUi);
$('peek').addEventListener('click', toggleUi);

// ---------- phím tắt: dùng chung cho tool và cho phím chuyển từ iframe ----------
function onKey(key) {
  const k = String(key).toLowerCase();
  if (k === 'r') post({ type: 'restart' });
  else if (k === 's') toggleAuto();
  else if (k === 'd') post({ type: 'auto', mode: 'step' });
  else if (k === 'h') toggleUi();
  else if (k === 'f') toggleFinger();
  else if (k === 't') toggleTimer();
  else if (k === 'escape') { if ($('picker').hidden) backToPicker(); }
}
window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^(input|select|textarea)$/i.test(e.target.tagName)) return;
  onKey(e.key);
});

// ---------- chụp ảnh và quay video ----------
// Ghi lại đúng khung sân khấu, đúng cỡ xuất. Trình duyệt chỉ cho quay cả tab, nên
// quay tab rồi cắt phần sân khấu ra: người dùng chọn tab này một lần, sau đó chụp và
// quay bao nhiêu lần cũng được cho tới khi đóng trang hoặc bấm "Stop sharing".
let tabStream = null, video = null;
async function tabCapture() {
  if (tabStream?.active) return tabStream;
  tabStream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser', frameRate: 60 },
    audio: true,
    preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', systemAudio: 'exclude',
  });
  video = document.createElement('video');
  video.srcObject = tabStream; video.muted = true; video.playsInline = true;
  await video.play();
  await new Promise(r => (video.videoWidth ? r() : video.addEventListener('loadedmetadata', r, { once: true })));
  tabStream.getVideoTracks()[0].addEventListener('ended', () => { stopRec(); tabStream = null; });
  return tabStream;
}
/** Vẽ phần sân khấu của khung video tab vào canvas cỡ xuất */
function drawStage(cv) {
  const r = $('stage').getBoundingClientRect();
  // Ảnh tab có thể to gấp DPR lần viewport; quy đổi theo tỉ lệ thật thay vì tin devicePixelRatio
  const kx = video.videoWidth / window.innerWidth, ky = video.videoHeight / window.innerHeight;
  const ctx = cv.getContext('2d');
  ctx.drawImage(video, r.left * kx, r.top * ky, r.width * kx, r.height * ky, 0, 0, cv.width, cv.height);
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const fileBase = () => `ef-${current ? `${current.chapter}-L${current.index + 1}` : (status?.screen || 'screen')}-${cfg.aspect.replace(':', 'x')}`;

$('shotBtn').addEventListener('click', async () => {
  try {
    await tabCapture();
    // đợi hai khung hình để ảnh tab bắt kịp màn hình sau khi hộp chọn tab đóng
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const [w, h] = EXPORT[cfg.aspect];
    const cv = Object.assign(document.createElement('canvas'), { width: w, height: h });
    drawStage(cv);
    cv.toBlob(b => { download(b, `${fileBase()}-${stamp()}.png`); note(`Đã chụp ${w}×${h}`, 'ok'); }, 'image/png');
  } catch (e) { note('Không chụp được: ' + e.message, 'bad'); }
});

let rec = null, recTimer = null, recRaf = null;
async function startRec() {
  await tabCapture();
  const [w, h] = EXPORT[cfg.aspect];
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const out = cv.captureStream(60);
  for (const t of tabStream.getAudioTracks()) out.addTrack(t);   // tiếng game đi kèm nếu tab cho phép
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  const chunks = [];
  rec = new MediaRecorder(out, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    cancelAnimationFrame(recRaf); clearInterval(recTimer);
    $('recDot').hidden = true;
    $('recBtn').classList.remove('on'); $('recBtn').textContent = '● Quay';
    download(new Blob(chunks, { type: 'video/webm' }), `${fileBase()}-${stamp()}.webm`);
    note(`Đã lưu video ${w}×${h} (webm)`, 'ok');
    rec = null;
  };
  const loop = () => { drawStage(cv); recRaf = requestAnimationFrame(loop); };
  loop();
  rec.start(500);
  const t0 = Date.now();
  recTimer = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $('recTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 250);
  $('recTime').textContent = '0:00';
  $('recDot').hidden = false;
  $('recBtn').classList.add('on'); $('recBtn').textContent = '■ Dừng';
}
function stopRec() { if (rec && rec.state !== 'inactive') rec.stop(); }
$('recBtn').addEventListener('click', async () => {
  try { rec ? stopRec() : await startRec(); }
  catch (e) { note('Không quay được: ' + e.message, 'bad'); }
});

// ---------- khởi động ----------
async function boot() {
  setArtStyle(cfg.art);
  book = await loadBook({ fresh: true });
  if (!book?.chapters?.length) throw new Error('levels.json chưa có chương nào');
  drawPicker();
  layoutStage();
  loadFrame();
}
boot().catch(e => { console.error(e); note('Lỗi khởi động: ' + e.message, 'bad'); });
