// Hàm vẽ từng món School Day (canvas 2D).
// Phong cách theo Art Style GDD: màu bão hòa, outline đậm, shading 2 tone, form bo tròn.
// Toạ độ cục bộ, gốc = điểm tạo body, trùng hình vật lý trong data/items.js.
import { theme, rrect, fs, gloss, poly } from './helpers.js';

/** Vệt gấp vải: mấy đường cong mảnh chạy ngang */
function folds(c, x, y, w, n, col = 'rgba(0,0,0,.14)') {
  c.save(); c.strokeStyle = col; c.lineWidth = 2; c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const yy = y + i * 12;
    c.beginPath(); c.moveTo(x, yy); c.quadraticCurveTo(x + w / 2, yy + 4, x + w, yy); c.stroke();
  }
  c.restore();
}
/** Mảng sáng phía trên trái + mảng tối phía dưới phải, tạo khối 2 tone */
function shade(c, path, light, dark) {
  c.save(); path(); c.clip();
  c.fillStyle = light; c.fillRect(-200, -200, 400, 400);
  c.fillStyle = dark;
  c.beginPath(); c.moveTo(-200, 200); c.lineTo(200, -60); c.lineTo(200, 200); c.closePath(); c.fill();
  c.restore();
}

export const ART = {
  // ================= Clothing =================
  tshirt(c) {
    const p = () => rrect(c, -42, -30, 84, 60, 8);
    p(); fs(c, '#4FB3E8');
    shade(c, p, 'rgba(255,255,255,.14)', 'rgba(20,60,90,.18)');
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    // cổ áo gấp lộ ra
    c.save(); p(); c.clip();
    c.fillStyle = '#2E8FC8'; c.fillRect(-42, 12, 84, 18);
    c.beginPath(); c.arc(0, -30, 15, 0, Math.PI); c.fillStyle = '#1F6E9E'; c.fill();
    c.restore();
    c.lineWidth = 2; c.strokeStyle = 'rgba(20,60,90,.5)';
    c.beginPath(); c.moveTo(-42, 12); c.lineTo(42, 12); c.stroke();
    folds(c, -34, -12, 68, 2);
    gloss(c, -24, -18, 12, 4, -.2, .3);
  },
  shorts(c) {
    const p = () => rrect(c, -40, -29, 80, 58, 8);
    p(); fs(c, '#3F6FD8');
    shade(c, p, 'rgba(255,255,255,.12)', 'rgba(15,30,80,.2)');
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    c.save(); p(); c.clip();
    c.fillStyle = '#2F55B0'; c.fillRect(-40, -29, 80, 14);        // cạp quần
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-10, -22); c.lineTo(-16, -16); c.moveTo(10, -22); c.lineTo(16, -16); c.stroke();
    c.restore();
    c.lineWidth = 2; c.strokeStyle = 'rgba(15,30,80,.55)';
    c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 29); c.stroke();
    folds(c, -32, 4, 64, 2);
  },
  socks(c) {
    c.beginPath(); c.arc(0, 0, 27, 0, Math.PI * 2); fs(c, '#F7F2E6');
    c.save(); c.beginPath(); c.arc(0, 0, 27, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#E24B6A'; c.fillRect(-27, -27, 54, 9);
    c.fillStyle = '#3FB8AF'; c.fillRect(-27, 12, 54, 8);
    // vòng cuộn
    c.strokeStyle = 'rgba(70,50,40,.35)'; c.lineWidth = 2;
    c.beginPath(); c.arc(-4, 2, 15, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(-4, 2, 7, 0, Math.PI * 2); c.stroke();
    c.restore();
    c.beginPath(); c.arc(0, 0, 27, 0, Math.PI * 2); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    gloss(c, -11, -12, 7, 3);
  },
  sneaker(c) {
    const body = [[-44, 8], [-38, -6], [-10, -14], [6, -26], [22, -26], [30, -8], [44, 4], [44, 20], [-44, 20]];
    poly(c, body); fs(c, '#FFFFFF');
    c.save(); poly(c, body); c.clip();
    c.fillStyle = '#2FB57A'; c.fillRect(-46, 10, 92, 12);                    // đế
    c.fillStyle = '#E8F7EF'; c.beginPath(); c.moveTo(6, -26); c.lineTo(22, -26); c.lineTo(30, -8); c.lineTo(10, -6); c.closePath(); c.fill();
    c.strokeStyle = '#2FB57A'; c.lineWidth = 3; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-6 + i * 8, -10 + i * 2); c.lineTo(8 + i * 8, -16 + i * 2); c.stroke(); }
    c.restore();
    poly(c, body); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    c.strokeStyle = 'rgba(40,30,25,.4)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-44, 10); c.lineTo(44, 6); c.stroke();
    gloss(c, -28, 0, 9, 3, -.15, .4);
  },
  raincoat(c) {
    const p = () => rrect(c, -43, -31, 86, 62, 6);
    p(); fs(c, '#F2C438');
    shade(c, p, 'rgba(255,255,255,.18)', 'rgba(120,80,10,.16)');
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    c.save(); p(); c.clip();
    c.fillStyle = '#D9A521'; c.fillRect(-43, 14, 86, 17);
    // mũ trùm gấp ở góc
    c.beginPath(); c.arc(-24, -31, 18, 0, Math.PI); c.fillStyle = '#D9A521'; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = 'rgba(90,60,10,.5)'; c.stroke();
    c.fillStyle = '#3B2A4A';
    for (let y = -6; y < 14; y += 10) { c.beginPath(); c.arc(20, y, 3, 0, Math.PI * 2); c.fill(); }   // cúc
    c.restore();
    folds(c, -34, -14, 68, 2, 'rgba(120,80,10,.22)');
    gloss(c, 16, -22, 10, 4, -.2, .35);
  },

  // ================= Personal Care =================
  tissue(c) {
    const p = () => rrect(c, -28, -21, 56, 42, 10);
    p(); fs(c, '#8FD6EF');
    shade(c, p, 'rgba(255,255,255,.2)', 'rgba(20,70,95,.15)');
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    // khe rút giấy + tờ giấy trắng nhô lên
    rrect(c, -15, -9, 30, 12, 6); c.fillStyle = '#2E86AB'; c.fill();
    c.beginPath(); c.moveTo(-8, -8); c.lineTo(0, -18); c.lineTo(8, -8); c.closePath();
    c.fillStyle = '#FFFFFF'; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(40,60,80,.45)'; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.6)'; rrect(c, -18, 8, 36, 6, 3); c.fill();
    gloss(c, -14, -14, 8, 3);
  },
  sanitizer(c) {
    rrect(c, -8, -45, 16, 12, 3); fs(c, '#E24B6A', 2.5);                      // nắp bơm
    rrect(c, -5, -40, 14, 6, 3); c.fillStyle = '#E24B6A'; c.fill();
    const p = () => rrect(c, -17, -33, 34, 66, 12);
    p(); fs(c, '#F4F9FB');
    c.save(); p(); c.clip();
    c.fillStyle = '#BFE8F5'; c.fillRect(-17, -6, 34, 39);                     // mực gel
    c.fillStyle = '#FFFFFF'; rrect(c, -12, -20, 24, 18, 4); c.fill();         // nhãn
    c.lineWidth = 1.6; c.strokeStyle = 'rgba(40,60,80,.4)'; c.stroke();
    c.fillStyle = '#3FB8AF'; c.fillRect(-8, -15, 16, 3); c.fillRect(-8, -9, 10, 3);
    c.restore();
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    gloss(c, -11, -14, 3, 16, 0, .55);
  },
  handtowel(c) {
    const p = () => rrect(c, -29, -20, 58, 40, 5);
    p(); fs(c, '#F79FB8');
    shade(c, p, 'rgba(255,255,255,.2)', 'rgba(120,30,60,.14)');
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    c.save(); p(); c.clip();
    c.fillStyle = '#FFFFFF'; c.fillRect(-29, -4, 58, 8);
    c.strokeStyle = 'rgba(140,40,70,.35)'; c.lineWidth = 2;
    for (const y of [-13, 12]) { c.beginPath(); c.moveTo(-29, y); c.lineTo(29, y); c.stroke(); }
    c.restore();
    gloss(c, -18, -12, 9, 3);
  },
  lipbalm(c) {
    const p = () => rrect(c, -10, -38, 20, 76, 9);
    p(); fs(c, '#F6D34B');
    c.save(); p(); c.clip();
    c.fillStyle = '#E24B6A'; c.fillRect(-10, -38, 20, 26);                    // nắp
    c.fillStyle = 'rgba(255,255,255,.65)'; c.fillRect(-10, 2, 20, 5);
    c.restore();
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    c.lineWidth = 2; c.strokeStyle = 'rgba(90,60,10,.45)';
    c.beginPath(); c.moveTo(-10, -12); c.lineTo(10, -12); c.stroke();
    gloss(c, -5, 10, 2, 14, 0, .5);
  },
  wetwipes(c) {
    const p = () => rrect(c, -30, -20, 60, 40, 8);
    p(); fs(c, '#7BD3A8');
    shade(c, p, 'rgba(255,255,255,.18)', 'rgba(15,80,55,.16)');
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    rrect(c, -17, -11, 34, 13, 6); c.fillStyle = '#3E9E77'; c.fill();          // nắp nhựa
    c.lineWidth = 2; c.strokeStyle = 'rgba(10,60,40,.5)'; c.stroke();
    c.fillStyle = '#FFFFFF'; rrect(c, -14, 7, 28, 7, 3); c.fill();
    gloss(c, -19, -14, 7, 3);
  },

  // ================= Electronics =================
  tablet(c) {
    const p = () => rrect(c, -56, -40, 112, 80, 7);
    p(); fs(c, '#3A3550');
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    rrect(c, -49, -33, 98, 66, 4);
    const g = c.createLinearGradient(-49, -33, 49, 33);
    g.addColorStop(0, '#59C8F5'); g.addColorStop(.55, '#7B86F0'); g.addColorStop(1, '#C06BE8');
    c.fillStyle = g; c.fill();
    c.save(); rrect(c, -49, -33, 98, 66, 4); c.clip();
    c.fillStyle = 'rgba(255,255,255,.28)';
    for (let i = 0; i < 3; i++) rrect(c, -40 + i * 30, -22, 20, 20, 5), c.fill();
    c.fillStyle = 'rgba(255,255,255,.2)'; rrect(c, -40, 6, 80, 8, 4); c.fill();
    c.restore();
    rrect(c, -49, -33, 98, 66, 4); c.lineWidth = 2; c.strokeStyle = 'rgba(0,0,0,.35)'; c.stroke();
    c.fillStyle = '#5C5675'; c.beginPath(); c.arc(0, 36, 2.5, 0, Math.PI * 2); c.fill();
    gloss(c, -30, -22, 16, 5, -.3, .35);
  },
  calculator(c) {
    const p = () => rrect(c, -22, -27, 44, 54, 5);
    p(); fs(c, '#E8734A');
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    rrect(c, -16, -21, 32, 13, 3); c.fillStyle = '#2E3B2F'; c.fill();          // màn hình
    c.fillStyle = '#8FE87A'; c.font = '700 9px Nunito'; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText('42', 13, -14);
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) { rrect(c, -16 + col * 11, -3 + r * 10, 8, 7, 2); c.fill(); }
    gloss(c, -14, -24, 6, 2.5);
  },
  earbuds(c) {
    c.beginPath(); c.arc(0, 0, 25, 0, Math.PI * 2); fs(c, '#F5F2EC');
    c.save(); c.beginPath(); c.arc(0, 0, 25, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#DCD6CC'; c.fillRect(-25, 4, 50, 21);
    c.restore();
    c.beginPath(); c.arc(0, 0, 25, 0, Math.PI * 2); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    c.lineWidth = 2; c.strokeStyle = 'rgba(70,60,50,.45)';
    c.beginPath(); c.moveTo(-25, 3); c.lineTo(25, 3); c.stroke();
    c.beginPath(); c.arc(0, 13, 4, 0, Math.PI * 2); c.fillStyle = '#8FD6EF'; c.fill(); c.stroke();
    gloss(c, -10, -11, 7, 3);
  },
  charger(c) {
    const p = () => rrect(c, -23, -24, 46, 48, 9);
    p(); fs(c, '#F7F4EE');
    shade(c, p, 'rgba(255,255,255,.2)', 'rgba(60,50,40,.14)');
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    c.fillStyle = '#B9B2A6';                                                    // chấu cắm
    rrect(c, -11, -24, 7, 12, 2); c.fill(); rrect(c, 4, -24, 7, 12, 2); c.fill();
    c.lineWidth = 2; c.strokeStyle = theme.ink; rrect(c, -11, -24, 7, 12, 2); c.stroke(); rrect(c, 4, -24, 7, 12, 2); c.stroke();
    rrect(c, -9, 6, 18, 9, 3); c.fillStyle = '#2E3B4A'; c.fill();               // cổng USB
    gloss(c, -14, -8, 5, 8, -.2, .4);
  },

  // ================= Food & Drink =================
  waterbottle(c) {
    rrect(c, -9, -66, 18, 18, 5); fs(c, '#E24B6A', 2.5);                        // nắp
    const p = () => rrect(c, -16, -50, 32, 100, 12);
    p(); fs(c, '#BFE8F5');
    c.save(); p(); c.clip();
    c.fillStyle = '#6FC9E8'; c.fillRect(-16, -14, 32, 64);                       // nước
    c.fillStyle = '#FFFFFF'; c.fillRect(-16, -20, 32, 7);
    c.fillStyle = 'rgba(255,255,255,.9)'; rrect(c, -13, 2, 26, 22, 4); c.fill();  // nhãn
    c.fillStyle = '#3FB8AF'; c.fillRect(-9, 8, 18, 3); c.fillRect(-9, 15, 12, 3);
    c.restore();
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    gloss(c, -10, -30, 3, 18, 0, .6);
  },
  sandwich(c) {
    const tri = [[-54, 30], [54, 30], [0, -46]];
    poly(c, tri); fs(c, '#F3D9A4');
    c.save(); poly(c, tri); c.clip();
    c.fillStyle = '#E8C074'; c.fillRect(-60, 18, 120, 14);                       // vỏ bánh dưới
    c.fillStyle = '#7BC96F'; c.beginPath(); c.moveTo(-40, 12); c.quadraticCurveTo(0, -2, 40, 12); c.lineTo(40, 18); c.lineTo(-40, 18); c.closePath(); c.fill();
    c.fillStyle = '#E8734A'; c.beginPath(); c.arc(-14, 6, 8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(12, 4, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#FFF6D9'; c.beginPath(); c.moveTo(-30, -4); c.lineTo(28, -4); c.lineTo(20, -12); c.lineTo(-22, -12); c.closePath(); c.fill();
    c.restore();
    poly(c, tri); c.lineWidth = 3; c.strokeStyle = theme.ink; c.lineJoin = 'round'; c.stroke();
    gloss(c, -12, -22, 8, 4, -.5, .3);
  },
  apple(c) {
    c.strokeStyle = '#7A5230'; c.lineWidth = 5; c.lineCap = 'round';             // cuống
    c.beginPath(); c.moveTo(0, -24); c.quadraticCurveTo(4, -34, 10, -36); c.stroke();
    c.beginPath(); c.moveTo(2, -30); c.quadraticCurveTo(16, -38, 22, -28); c.quadraticCurveTo(10, -22, 2, -30);
    c.fillStyle = '#5FBF6B'; c.fill(); c.lineWidth = 2; c.strokeStyle = theme.ink; c.stroke();
    c.beginPath(); c.arc(0, 0, 27, 0, Math.PI * 2); fs(c, '#E8434F');
    c.save(); c.beginPath(); c.arc(0, 0, 27, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#C42B3C'; c.beginPath(); c.arc(14, 12, 20, 0, Math.PI * 2); c.fill();
    c.restore();
    gloss(c, -10, -12, 8, 5, -.5, .55);
  },
  banana(c) {
    const body = [[-36, -6], [-22, -18], [0, -22], [22, -14], [34, 4], [26, 14], [4, 6], [-18, 8], [-34, 6]];
    poly(c, body); fs(c, '#F6D34B');
    c.save(); poly(c, body); c.clip();
    c.fillStyle = '#E0B92F'; c.beginPath(); c.moveTo(-36, 2); c.quadraticCurveTo(0, 14, 34, 2); c.lineTo(34, 16); c.lineTo(-36, 16); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(140,100,10,.35)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-28, -8); c.quadraticCurveTo(0, -14, 26, -4); c.stroke();
    c.restore();
    poly(c, body); c.lineWidth = 3; c.strokeStyle = theme.ink; c.lineJoin = 'round'; c.stroke();
    c.fillStyle = '#6B4A2A'; c.beginPath(); c.arc(-34, 0, 4, 0, Math.PI * 2); c.fill();
    gloss(c, -6, -14, 12, 3, -.1, .45);
  },
  milk(c) {
    const top = [[-22, -20], [22, -20], [10, -34], [-10, -34]];
    poly(c, top); fs(c, '#D8E8F5');
    const p = () => poly(c, [[-22, -20], [22, -20], [22, 32], [-22, 32]]);
    p(); fs(c, '#FFFFFF');
    c.save(); p(); c.clip();
    c.fillStyle = '#4FB3E8'; c.fillRect(-22, 6, 44, 26);
    c.fillStyle = '#E8F4FB'; c.beginPath(); c.arc(0, 2, 11, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#4FB3E8'; c.beginPath(); c.arc(0, 2, 7, 0, Math.PI * 2); c.fill();
    c.restore();
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    c.lineWidth = 2; c.strokeStyle = 'rgba(40,70,100,.45)';
    c.beginPath(); c.moveTo(-22, -20); c.lineTo(22, -20); c.stroke();
    gloss(c, -15, -8, 3, 14, 0, .5);
  },
  granola(c) {
    const p = () => rrect(c, -31, -18, 62, 36, 6);
    p(); fs(c, '#C98A4B');
    c.save(); p(); c.clip();
    c.fillStyle = '#8A5A2B';
    for (const [x, y] of [[-20, -6], [-6, 4], [8, -8], [20, 2], [-14, 8], [14, 10]]) { c.beginPath(); c.arc(x, y, 3.5, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(-31, -18, 62, 9);          // mép bao bì
    c.fillStyle = '#E8434F'; c.fillRect(-31, -18, 62, 4);
    c.restore();
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    gloss(c, -18, -12, 8, 2.5);
  },

  // ================= Accessories =================
  cap(c) {
    rrect(c, 5, 10, 54, 16, 8); fs(c, '#2F55B0');                                // lưỡi trai
    c.beginPath(); c.arc(-6, -4, 30, Math.PI, Math.PI * 2); c.lineTo(24, 12); c.lineTo(-36, 12); c.closePath();
    fs(c, '#3F6FD8');
    c.save(); c.beginPath(); c.arc(-6, -4, 30, Math.PI, Math.PI * 2); c.lineTo(24, 12); c.lineTo(-36, 12); c.closePath(); c.clip();
    c.strokeStyle = 'rgba(15,30,80,.4)'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-6, -34); c.lineTo(-6, 12); c.stroke();
    c.beginPath(); c.moveTo(-6, -34); c.quadraticCurveTo(-26, -14, -34, 12); c.stroke();
    c.beginPath(); c.moveTo(-6, -34); c.quadraticCurveTo(14, -14, 22, 12); c.stroke();
    c.fillStyle = '#F6D34B'; c.beginPath(); c.arc(-16, -10, 7, 0, Math.PI * 2); c.fill();
    c.restore();
    c.beginPath(); c.arc(-6, -4, 30, Math.PI, Math.PI * 2); c.lineTo(24, 12); c.lineTo(-36, 12); c.closePath();
    c.lineWidth = 3; c.strokeStyle = theme.ink; c.lineJoin = 'round'; c.stroke();
    c.fillStyle = '#2F55B0'; c.beginPath(); c.arc(-6, -33, 4, 0, Math.PI * 2); c.fill();
    c.lineWidth = 2; c.strokeStyle = theme.ink; c.stroke();
    gloss(c, -20, -18, 8, 4, -.5, .35);
  },
  umbrella(c) {
    const p = () => rrect(c, -15, -52, 30, 104, 14);
    p(); fs(c, '#7B4FD8');
    c.save(); p(); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3;
    for (const x of [-8, 0, 8]) { c.beginPath(); c.moveTo(x, -52); c.lineTo(x, 52); c.stroke(); }
    c.fillStyle = '#5A34AC'; c.fillRect(-15, 30, 30, 22);
    c.restore();
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    // quai cong
    c.strokeStyle = '#C98A4B'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 52); c.lineTo(0, 62); c.quadraticCurveTo(0, 72, -10, 70); c.stroke();
    c.lineWidth = 2.4; c.strokeStyle = theme.ink; c.stroke();
    // chóp
    c.beginPath(); c.moveTo(-5, -52); c.lineTo(0, -62); c.lineTo(5, -52); c.closePath();
    c.fillStyle = '#F6D34B'; c.fill(); c.lineWidth = 2; c.strokeStyle = theme.ink; c.stroke();
    gloss(c, -9, -30, 3, 16, 0, .4);
  },
  keyring(c) {
    c.beginPath(); c.arc(-14, 0, 15, 0, Math.PI * 2);
    c.lineWidth = 7; c.strokeStyle = theme.ink; c.stroke();
    c.lineWidth = 4; c.strokeStyle = '#C9CCD6'; c.stroke();
    rrect(c, -1, 0, 26, 12, 5); fs(c, '#E8434F');
    c.save(); rrect(c, -1, 0, 26, 12, 5); c.clip();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-1, 0, 26, 4);
    c.restore();
    c.fillStyle = '#F6D34B'; rrect(c, 14, 8, 5, 7, 2); c.fill();
    gloss(c, -19, -6, 4, 2, -.5, .6);
  },
  studentcard(c) {
    const p = () => rrect(c, -31, -20, 62, 40, 5);
    p(); fs(c, '#FFFFFF');
    c.save(); p(); c.clip();
    c.fillStyle = '#4FB3E8'; c.fillRect(-31, -20, 62, 12);                       // dải đầu thẻ
    c.fillStyle = '#DCE6EE'; rrect(c, -25, -3, 18, 20, 3); c.fill();             // ảnh
    c.fillStyle = '#9AA8B4'; c.beginPath(); c.arc(-16, 3, 5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(-16, 18, 9, Math.PI, 0); c.fill();
    c.fillStyle = '#B9C4CE';
    for (let i = 0; i < 3; i++) { rrect(c, -2, 0 + i * 7, 24 - i * 5, 4, 2); c.fill(); }
    c.restore();
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    gloss(c, -20, -15, 7, 2.5);
  },

  // ================= Context Gear =================
  notebook(c) {
    const p = () => rrect(c, -37, -34, 74, 68, 3);
    p(); fs(c, '#E8734A');
    c.save(); p(); c.clip();
    c.fillStyle = '#FFF8EE'; c.fillRect(28, -34, 9, 68);                          // mép giấy
    c.fillStyle = '#C9552F'; c.fillRect(-37, -34, 13, 68);                        // gáy
    c.fillStyle = 'rgba(255,255,255,.9)'; rrect(c, -16, -20, 38, 26, 2); c.fill();
    c.fillStyle = '#C9552F';
    for (let i = 0; i < 3; i++) c.fillRect(-11, -14 + i * 7, 28 - i * 6, 3);
    c.restore();
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    c.fillStyle = '#B9B2A6';                                                       // lò xo
    for (let y = -28; y < 30; y += 9) { rrect(c, -35, y, 9, 4, 2); c.fill(); }
    gloss(c, 8, -26, 9, 3);
  },
  textbook(c) {
    const p = () => rrect(c, -52, -43, 104, 86, 3);
    p(); fs(c, '#2FB57A');
    c.save(); p(); c.clip();
    c.fillStyle = '#FFF8EE'; c.fillRect(42, -43, 10, 86);
    c.fillStyle = '#1F8F5E'; c.fillRect(-52, -43, 15, 86);
    c.fillStyle = 'rgba(255,255,255,.92)'; rrect(c, -26, -30, 58, 34, 3); c.fill();
    c.fillStyle = '#F6D34B'; c.beginPath(); c.arc(3, -13, 11, 0, Math.PI * 2); c.fill();
    c.lineWidth = 2.4; c.strokeStyle = '#1F8F5E'; c.stroke();
    c.fillStyle = '#1F8F5E';
    for (let i = 0; i < 3; i++) c.fillRect(-26, 12 + i * 9, 54 - i * 12, 5);
    c.restore();
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-37, -43); c.lineTo(-37, 43); c.stroke();
    gloss(c, 20, -35, 11, 3);
  },
  ruler(c) {
    const p = () => rrect(c, -9, -48, 18, 96, 3);
    p(); fs(c, '#F6D34B');
    c.save(); p(); c.clip();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-9, -48, 7, 96);
    c.strokeStyle = 'rgba(90,60,10,.75)'; c.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const y = -44 + i * 8, long = i % 2 === 0;
      c.beginPath(); c.moveTo(9, y); c.lineTo(long ? -3 : 2, y); c.stroke();
    }
    c.restore();
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
  },
  pencil(c) {
    const body = [[-7, -40], [7, -40], [7, 32], [0, 46], [-7, 32]];
    poly(c, body); fs(c, '#F2A33C');
    c.save(); poly(c, body); c.clip();
    c.fillStyle = '#D9862A'; c.fillRect(0, -40, 7, 90);
    c.fillStyle = '#F7E2C0'; c.beginPath(); c.moveTo(-7, 32); c.lineTo(7, 32); c.lineTo(0, 46); c.closePath(); c.fill();
    c.fillStyle = '#3B2A4A'; c.beginPath(); c.moveTo(-3, 40); c.lineTo(3, 40); c.lineTo(0, 46); c.closePath(); c.fill();
    c.fillStyle = '#F79FB8'; c.fillRect(-7, -40, 14, 11);                          // cục tẩy
    c.fillStyle = '#B9B2A6'; c.fillRect(-7, -29, 14, 5);                           // khoen kim loại
    c.restore();
    poly(c, body); c.lineWidth = 3; c.strokeStyle = theme.ink; c.lineJoin = 'round'; c.stroke();
  },
  gluestick(c) {
    const p = () => rrect(c, -11, -35, 22, 70, 8);
    p(); fs(c, '#7BD3A8');
    c.save(); p(); c.clip();
    c.fillStyle = '#3E9E77'; c.fillRect(-11, -35, 22, 20);                          // nắp
    c.fillStyle = '#FFFFFF'; rrect(c, -9, -8, 18, 24, 3); c.fill();
    c.fillStyle = '#3E9E77'; c.fillRect(-6, -3, 12, 3); c.fillRect(-6, 3, 8, 3);
    c.restore();
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    c.lineWidth = 2; c.strokeStyle = 'rgba(10,60,40,.5)';
    c.beginPath(); c.moveTo(-11, -15); c.lineTo(11, -15); c.stroke();
    gloss(c, -6, 8, 2.5, 12, 0, .5);
  },
  paintbox(c) {
    const p = () => rrect(c, -48, -27, 96, 54, 6);
    p(); fs(c, '#4A4560');
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    rrect(c, -43, -21, 86, 42, 4); c.fillStyle = '#33304A'; c.fill();
    const cols = ['#E8434F', '#F2A33C', '#F6D34B', '#5FBF6B', '#4FB3E8', '#7B4FD8', '#F79FB8', '#8A5A2B'];
    cols.forEach((col, i) => {
      const x = -33 + (i % 4) * 22, y = i < 4 ? -11 : 11;
      c.beginPath(); c.arc(x, y, 8.5, 0, Math.PI * 2); c.fillStyle = col; c.fill();
      c.lineWidth = 1.6; c.strokeStyle = 'rgba(0,0,0,.35)'; c.stroke();
      gloss(c, x - 2.5, y - 2.5, 2.5, 1.4, -.7, .5);
    });
    rrect(c, -8, -29, 16, 6, 3); c.fillStyle = '#B9B2A6'; c.fill();
  },

  // ================= Công cụ =================
  key(c) {
    rrect(c, -9, -4, 34, 8, 3); fs(c, '#F6D34B', 2.4);
    c.beginPath(); c.arc(-16, 0, 11, 0, Math.PI * 2); fs(c, '#F6D34B', 2.4);
    c.beginPath(); c.arc(-16, 0, 4.5, 0, Math.PI * 2); c.fillStyle = theme.ink; c.fill();
    c.fillStyle = '#F6D34B'; c.lineWidth = 2.2; c.strokeStyle = theme.ink;
    rrect(c, 11, 4, 5, 8, 1.5); c.fill(); c.stroke();
    rrect(c, 19, 4, 5, 6, 1.5); c.fill(); c.stroke();
    gloss(c, -19, -4, 3.5, 1.8, -.6, .6);
  },
  mystery(c) {
    const p = () => rrect(c, -31, -31, 62, 62, 9);
    p(); fs(c, '#2B2540');
    c.save(); p(); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2;
    for (let d = -70; d < 70; d += 14) { c.beginPath(); c.moveTo(d, -31); c.lineTo(d + 62, 31); c.stroke(); }
    c.restore();
    p(); c.lineWidth = 3; c.strokeStyle = theme.ink; c.stroke();
    c.strokeStyle = 'rgba(246,211,75,.55)'; c.lineWidth = 2; c.setLineDash([5, 5]);
    rrect(c, -23, -23, 46, 46, 5); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#F6D34B'; c.font = '700 36px Fredoka, Nunito, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 2);
    rrect(c, -9, 21, 18, 7, 2); c.fillStyle = '#F6D34B'; c.fill();
    c.lineWidth = 1.6; c.strokeStyle = theme.ink; c.stroke();
  },
};
