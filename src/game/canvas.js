import { W, H } from './state.js';

export const canvas = document.getElementById('game');
// Bối cảnh phủ kín canvas ở mỗi khung hình, nên lớp trong suốt không dùng vào việc gì.
// Tắt alpha thì trình duyệt khỏi phải trộn canvas với nền trang — rẻ hơn thấy rõ trên máy yếu.
export const ctx = canvas.getContext('2d', { alpha: false });

// Sân chơi luôn là 420×760 đơn vị logic. Màn điện thoại thường CAO hơn tỉ lệ ấy, nên
// canvas trải kín màn hình còn sân chơi nằm chính giữa. VIEW là vùng canvas thật tính
// bằng đơn vị logic — rộng hơn sân chơi đúng phần thừa đó — để bối cảnh vẽ tràn ra tận
// mép máy thay vì để hở hai dải nền trống trên và dưới.
export const VIEW = { x0: 0, y0: 0, x1: W, y1: H };

// Khung canvas trên trang. Giữ lại vì toLogical chạy theo từng sự kiện chạm: gọi
// getBoundingClientRect ở đó thì mỗi lần ngón tay nhích là một lần bắt trình duyệt
// tính lại layout, ngay giữa lúc đang kéo.
let box = { left: 0, top: 0, k: 1, ox: 0, oy: 0 };

export function resize() {
  // Trần 2 chứ không phải 3: màn 3x của điện thoại tầm trung bắt canvas tô hơn gấp đôi
  // số điểm ảnh cho một khác biệt mắt gần như không thấy, và đó là phần lớn chỗ giật.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  const k = Math.min(r.width / W, r.height / H);          // vừa khung, không kéo méo
  const ox = (r.width - W * k) / 2, oy = (r.height - H * k) / 2;
  box = { left: r.left, top: r.top, k, ox, oy };
  ctx.setTransform(k * dpr, 0, 0, k * dpr, ox * dpr, oy * dpr);
  VIEW.x0 = -ox / k; VIEW.y0 = -oy / k; VIEW.x1 = W + ox / k; VIEW.y1 = H + oy / k;
}

/** Đổi toạ độ pointer sang toạ độ logic của game */
export function toLogical(e) {
  return { x: (e.clientX - box.left - box.ox) / box.k, y: (e.clientY - box.top - box.oy) / box.k };
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
window.addEventListener('scroll', resize, { passive: true });
