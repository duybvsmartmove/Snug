// Âm thanh. File WAV thật nằm ở public/audio/ (sinh bằng `node build_audio.mjs`),
// không tổng hợp lúc chạy, để sau bê nguyên bộ sang Unity được.
//
// Trình duyệt chỉ cho phát tiếng sau khi người chơi chạm vào trang, nên AudioContext
// được dựng ở lần chạm đầu tiên rồi mới tải file.
const BASE = './audio/';

const NAMES = ['tap', 'tapBig', 'pick', 'drop', 'fit', 'nope', 'eject', 'jiggle',
  'shrink', 'trash', 'unlock', 'tick', 'whoosh', 'star', 'win', 'lose', 'unlockLv'];

const KEY = 'snug.audio.v1';
const prefs = { sfx: true, music: true, ...readPrefs() };
function readPrefs() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function savePrefs() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {} }

let ac = null, sfxBus = null, musicBus = null;
const buffers = new Map();
let musicNode = null, musicBuffer = null, musicWanted = false, musicStarting = false;
let silent = false;                 // khung xem thử trong editor: tắt hẳn cho đỡ ồn

export function setSilent(v) { silent = v; }
export const isSfxOn = () => prefs.sfx;
export const isMusicOn = () => prefs.music;

async function decode(name) {
  const res = await fetch(BASE + name + '.wav');
  if (!res.ok) throw new Error(res.status);
  return ac.decodeAudioData(await res.arrayBuffer());
}

/** Dựng AudioContext + tải sẵn các tiếng ngắn. Gọi được nhiều lần, chỉ chạy một lần. */
let booted = null;
export function initAudio() {
  if (silent) return Promise.resolve();
  if (booted) { if (ac.state === 'suspended') ac.resume(); return booted; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return (booted = Promise.resolve());
  ac = new AC();
  sfxBus = ac.createGain(); sfxBus.gain.value = .85; sfxBus.connect(ac.destination);
  musicBus = ac.createGain(); musicBus.gain.value = 0; musicBus.connect(ac.destination);
  booted = Promise.all(NAMES.map(n =>
    decode(n).then(b => buffers.set(n, b)).catch(() => {})
  )).then(() => { if (musicWanted) startMusic(); });
  return booted;
}

/** Phát một tiếng. rate đổi cao độ, gain đổi to nhỏ, delay tính bằng giây. */
export function sfx(name, { rate = 1, gain = 1, delay = 0 } = {}) {
  if (silent || !prefs.sfx || !ac) return;
  const b = buffers.get(name); if (!b) return;
  if (ac.state === 'suspended') ac.resume();
  const src = ac.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
  const g = ac.createGain(); g.gain.value = gain;
  src.connect(g).connect(sfxBus);
  src.start(ac.currentTime + delay);
}

/** Nhiều tiếng giống nhau nối đuôi, cao độ lên dần: dùng cho chuỗi sao ở màn thắng */
export function sfxSeq(name, n, { step = .13, rate = 1, up = .12, gain = 1 } = {}) {
  for (let i = 0; i < n; i++) sfx(name, { delay: i * step, rate: rate + i * up, gain });
}

// ---------- nhạc nền ----------
/**
 * Bật nhạc nền. Gọi bao nhiêu lần cũng chỉ có một luồng chạy.
 * Cờ musicStarting là bắt buộc: lần gọi đầu phải chờ tải xong bgm.wav, trong lúc chờ đó
 * musicNode vẫn là null nên mọi lần gọi khác đều lọt qua và cùng dựng thêm một luồng —
 * kết quả là hai ba bản nhạc đè lên nhau mà chỉ tắt được bản cuối.
 */
export async function startMusic() {
  musicWanted = true;
  if (silent || !prefs.music || !ac) return;
  if (musicNode || musicStarting) return;
  musicStarting = true;
  try {
    if (!musicBuffer) musicBuffer = await decode('bgm');
    if (!musicWanted || !prefs.music || musicNode) return;   // đổi ý trong lúc đang tải
    musicNode = ac.createBufferSource();
    musicNode.buffer = musicBuffer; musicNode.loop = true;
    musicNode.connect(musicBus);
    musicNode.start();
    ramp(musicBus.gain, .32, 1.2);
  } catch {
    /* không tải được thì chơi tiếp trong im lặng */
  } finally { musicStarting = false; }
}

export function stopMusic() {
  musicWanted = false;
  if (!musicNode) return;
  const node = musicNode; musicNode = null;
  ramp(musicBus.gain, 0, .5);
  setTimeout(() => { try { node.stop(); } catch {} }, 600);
}

/** Hạ nhạc nền xuống khi có overlay thắng / thua, rồi trả lại như cũ */
export function duckMusic(on) {
  if (!ac || !musicNode) return;
  ramp(musicBus.gain, on ? .1 : .32, .3);
}

function ramp(param, to, sec) {
  const t = ac.currentTime;
  param.cancelScheduledValues(t);
  param.setValueAtTime(param.value, t);
  param.linearRampToValueAtTime(to, t + sec);
}

// ---------- bật tắt ----------
export function setSfxOn(v) { prefs.sfx = !!v; savePrefs(); if (v) sfx('tap'); }
export function setMusicOn(v) {
  prefs.music = !!v; savePrefs();
  v ? startMusic() : stopMusic();
}

/** Lần chạm đầu tiên ở bất kỳ đâu sẽ mở khoá âm thanh của trình duyệt */
export function unlockOnFirstGesture() {
  const go = () => { initAudio(); };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(ev, go, { once: true, capture: true });
  }
}
