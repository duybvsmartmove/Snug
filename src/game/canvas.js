import { W, H } from './state.js';

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');

export function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}

/** Đổi toạ độ pointer sang toạ độ logic của game */
export function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}

window.addEventListener('resize', resize);
