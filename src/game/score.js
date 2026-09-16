// Chấm điểm một ván thắng.
//
// Đo bốn thứ, mỗi thứ người chơi đều tác động được:
//   - Xếp gọn: đồ có sát nhau không, hay để hở nhiều khe giữa các món.
//   - Chỗ trống còn lại: túi còn dư bao nhiêu chỗ chưa dùng tới.
//   - Thời gian: còn lại bao nhiêu so với giờ cho phép.
//   - Booster: dùng càng ít càng khéo.
//
// Riêng "xếp gọn" phải tính theo VÙNG ĐỒ CHIẾM chứ không theo cả lòng túi: tổng diện
// tích các món là con số cố định của level, chia cho diện tích lòng túi thì ván nào
// cũng ra đúng một kết quả, chấm điểm kiểu đó không phản ánh gì về người chơi.
import Matter from 'matter-js';
import { S, BAG, partsOf } from './state.js';
import { pointInPolygonTolerant } from '../util/geom.js';
import { DEFAULT_BOOSTS } from './boosters.js';

const O = 4;   // cạnh ô lưới khi đo, đơn vị logic

/**
 * Quét lưới lòng túi.
 * - trongTui: ô nằm trong lòng túi
 * - coDo:     ô bị món chiếm
 * - vungChiem: ô nằm trong lòng túi và ở NGANG hoặc DƯỚI món cao nhất của cột đó
 *              — tức phần túi mà đống đồ đang trải ra, kể cả khe hở giữa các món.
 */
function quetLuoi() {
  let trongTui = 0, coDo = 0, vungChiem = 0;
  const than = S.bodies.filter(b => !b.chuaVao).flatMap(partsOf);

  for (let x = BAG.left; x <= BAG.right; x += O) {
    let dinhCot = null;
    const cot = [];
    for (let y = BAG.top; y <= BAG.bottom; y += O) {
      if (!pointInPolygonTolerant(x, y, BAG.poly, 0)) continue;
      const diem = { x, y };
      const dinh = than.some(p => Matter.Vertices.contains(p.vertices, diem));
      cot.push(dinh);
      if (dinh && dinhCot === null) dinhCot = cot.length - 1;
    }
    trongTui += cot.length;
    coDo += cot.filter(Boolean).length;
    if (dinhCot !== null) vungChiem += cot.length - dinhCot;
  }
  return { trongTui, coDo, vungChiem };
}

const kep = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Chấm ván vừa thắng. Trả về các tỉ lệ 0..1, điểm 0..100 và số sao 1..3. */
export function chamDiem() {
  const { trongTui, coDo, vungChiem } = quetLuoi();

  // Xếp gọn: phần vùng đồ trải ra thực sự có đồ. Kín mít = 1, rỗng nhiều khe = thấp.
  const gon = vungChiem > 0 ? kep(coDo / vungChiem) : 0;
  // Chỗ trống còn lại trong túi.
  const trong = trongTui > 0 ? kep(1 - coDo / trongTui) : 0;

  const tongGiay = S.LEVEL?.timer || 0;
  const conGiay = Math.max(0, Math.ceil(S.timeLeft / 1000));
  const dungGiay = Math.max(0, tongGiay - conGiay);
  const thoiGian = tongGiay > 0 ? kep(conGiay / tongGiay) : 0;

  const daCap = { ...DEFAULT_BOOSTS, ...(S.LEVEL?.boosters || {}) };
  const tongBooster = Object.values(daCap).reduce((s, v) => s + v, 0);
  const conBooster = Object.values(S.boosts).reduce((s, v) => s + v, 0);
  const dungBooster = Math.max(0, tongBooster - conBooster);
  const tietKiem = tongBooster > 0 ? kep(conBooster / tongBooster) : 1;

  // Xếp gọn nặng nhất: đó mới là kỹ năng chính của trò này.
  const diem = Math.round(gon * 55 + thoiGian * 30 + tietKiem * 15);
  const sao = diem >= 80 ? 3 : diem >= 55 ? 2 : 1;

  return { gon, trong, thoiGian, tietKiem, diem, sao, dungGiay, tongGiay, dungBooster, tongBooster };
}
