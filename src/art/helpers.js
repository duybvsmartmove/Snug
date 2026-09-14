// Tiện ích vẽ canvas dùng chung cho đồ, túi, bối cảnh.

/** Màu chủ đạo hiện tại (đổi theo level). theme.ink = màu viền sticker. */
export const theme = { ink: '#3B2A4A' };

export function rrect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

/** fill + viền sticker */
export function fs(c, fill, lw = 2.5) {
  c.fillStyle = fill; c.fill();
  c.lineWidth = lw; c.strokeStyle = theme.ink; c.stroke();
}

/** vệt bóng trắng mờ */
export function gloss(c, x, y, rx, ry, rot = -.7, a = .45) {
  c.save(); c.globalAlpha = a; c.fillStyle = '#fff';
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill();
  c.restore();
}

export function poly(c, pts) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
}
