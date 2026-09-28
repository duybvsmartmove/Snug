// Bóng bay: món có meta.physics === 'float' (đánh dấu body.bay lúc tạo, xem physics.js).
//
// Mô phỏng bóng bay bơm khí nhẹ ngoài đời:
//   - TRONG TÚI: lực nổi lớn hơn trọng lực, bóng dâng lên, ép vào đồ phía trên hoặc vào miệng
//     túi (lòng túi kín), nằm yên ở chỗ cao nhất còn trống. Đồ nặng đè lên thì bóng bị ghì
//     lại hoặc lách sang bên, như bóng thật kẹt giữa đống đồ.
//   - NGOÀI TÚI (trên khay): bóng lơ lửng quanh một độ cao, như bóng có sợi dây chạm bàn: lên
//     cao hơn thì phần dây nhấc khỏi bàn kéo xuống, thấp hơn thì lực nổi đẩy lên. Không cho
//     bay vọt lên trần, người chơi luôn với tới được.
//   - Không khí cản mạnh (frictionAir), đung đưa nhè nhẹ, và luôn tự dựng thẳng (nút buộc
//     với sợi dây nặng hơn ở dưới), nghiêng đi thì từ từ trở lại.
// Món khác không bị đụng tới: vòng lặp bỏ qua mọi body không có cờ bay.
import Matter from 'matter-js';
import { S, BAG, isHeld, daVao, TABLE_Y } from './state.js';
import { pointInPolygon } from '../util/geom.js';

const { Body } = Matter;

const NOI_TRONG_TUI = 1.45;   // lực nổi trong túi, tính theo trọng lực: 1.45 = dâng lên với 0,45g
// Độ cao bóng lơ lửng trên khay (tâm bóng). Thấp hẳn dưới đáy túi: bóng lơ lửng sát đáy là
// chạm vùng túi, bị tính nhầm là đã vào túi và dâng lên kẹt dưới đáy túi từ bên ngoài.
const LO_LUNG = TABLE_Y + 62;
const LO_LUNG_CUNG = .014;    // lệch 1 đơn vị so với độ cao đó thì lực đổi chừng này (theo g)
const LO_LUNG_TRAN = .7;      // lực chỉnh độ cao không quá chừng này (theo g)
const DUNG_THANG = .0035;     // độ mạnh tự dựng thẳng
const DUNG_THANG_CAN = .9;    // hãm quay mỗi bước khi đang dựng thẳng

const goc0 = a => Math.atan2(Math.sin(a), Math.cos(a));   // góc về khoảng (-π, π]

/** Gọi mỗi bước vật lý, trước Engine.update */
export function tickFloat() {
  if (!S.engine || S.won || S.lost || S.paused) return;
  const g = S.engine.gravity, gA = g.y * g.scale;    // gia tốc trọng lực trên mỗi đơn vị khối lượng
  const t = S.clock || 0;
  for (const b of S.bodies) {
    if (!b.bay || b.isStatic || !daVao(b) || isHeld(b)) continue;
    let noi;
    // trong túi = TÂM bóng nằm trong lòng túi; vùng túi nới rộng của luật xếp thì quá rộng
    if (BAG.poly && pointInPolygon(b.position.x, b.position.y, BAG.poly)) noi = NOI_TRONG_TUI;
    else {
      const lech = b.position.y - LO_LUNG;          // dương: đang thấp hơn độ cao lơ lửng
      noi = 1 + Math.max(-LO_LUNG_TRAN, Math.min(LO_LUNG_TRAN, lech * LO_LUNG_CUNG));
    }
    const pha = (b.khoa ?? b.itemId) * 1.7;
    noi += Math.sin(t * .0021 + pha) * .05;          // nhấp nhô
    const gio = Math.sin(t * .0013 + pha * 2.3) * .035;   // đung đưa ngang
    Body.applyForce(b, b.position, { x: gio * gA * b.mass, y: -noi * gA * b.mass });
    // tự dựng thẳng: xoay về góc 0, hãm dần cho khỏi lắc qua lắc lại
    const a = goc0(b.angle);
    Body.setAngularVelocity(b, b.angularVelocity * DUNG_THANG_CAN - a * DUNG_THANG);
  }
}
