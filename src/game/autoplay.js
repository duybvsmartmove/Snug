// Tự chơi: dùng solver tìm chỗ cho từng món rồi lần lượt nhấc và đặt vào, như người chơi thật.
// Dùng để kiểm tra nhanh một level có xếp được không mà không phải ngồi kéo tay,
// và để Creative Tool quay video gameplay.
//
// Hai chế độ:
//   full   xếp một mạch tới hết
//   step   xếp MỘT món rồi đứng chờ; gọi autoStep() thì xếp món tiếp. Dùng khi cần canh
//          đúng khung hình: túi đầy một nửa, món cuối đang bay…
import Matter from 'matter-js';
import { thaVaoSan } from './level.js';
import { S, BAG, isHeld } from './state.js';
import { KEY_ID, MYSTERY } from '../data/items.js';
import { makeItem } from './physics.js';
import { solve, solveAsync } from '../gen/solver.js';
import { bagZone } from './rules.js';
import { toast } from '../ui/hud.js';
import { t } from '../i18n.js';

const { Body, World, Bounds, Collision, Vector } = Matter;

// Nhịp của máy tự chơi, tính bằng mili giây THẬT ở tốc độ 1x.
// "nghi" là quãng chờ cho món vừa thả lắng xuống trước khi đặt món tiếp: rút quá tay
// thì món sau đè lên món trước lúc nó còn đang xê dịch, máy xếp được ít đi.
const NHIP = { moDau: 300, bay: 210, nghi: 60, ketThuc: 420, langToiDa: 620, tayToi: 260, tayNhac: 120 };

let running = false;
let mode = 'full';
let waitingStep = false;        // step: đang đứng chờ lệnh xếp món tiếp
let releaseStep = null;         // hàm mở khoá cho lần chờ hiện tại
let quiet = false;              // Creative Tool: không hiện toast của máy, lộ ngay là bot

export const isAutoplaying = () => running;
/** 'idle' | 'busy' (đang bay/đang lắng) | 'waiting' (step: chờ bấm tiếp) */
export const autoState = () => (!running ? 'idle' : waitingStep ? 'waiting' : 'busy');
export const autoMode = () => mode;
export function setAutoQuiet(v) { quiet = !!v; }

/** Tốc độ máy chơi nhân với tốc độ game: quay chậm thì tay cũng phải chậm theo */
export let playSpeed = 1;
export function setPlaySpeed(v) { playSpeed = Math.max(.1, Number(v) || 1); }
const heSo = () => playSpeed * (S.timeScale || 1);
const wait = ms => new Promise(r => setTimeout(r, ms / heSo()));
// Chờ theo thời gian GAME (chỉ chia tốc độ thời gian, không chia nhịp tay): dùng cho những
// việc vật lý phải làm xong — lắc túi lắng lại, đồ vừa thu nhỏ rơi xuống — tay nhanh hay
// chậm không đổi được tốc độ của chúng.
const waitGame = ms => new Promise(r => setTimeout(r, ms / (S.timeScale || 1)));
const note = (msg, ms) => { if (!quiet) toast(msg, ms); };

/**
 * Chờ món vừa thả nằm yên hẳn rồi mới xếp món tiếp.
 * Nhịp nghỉ cố định là sai: món rơi từ trên cao xuống đống đồ cần lâu hơn món đặt sát
 * đáy. Đặt món tiếp khi đống đồ còn đang xê dịch thì nó rơi trượt đi, để lại khe hở.
 * Chờ theo tốc độ thật nên vừa chắc vừa không phí thời gian ở những món rơi nhanh.
 */
async function choLang(body) {
  const t0 = performance.now();
  await wait(NHIP.nghi);
  while (running && performance.now() - t0 < NHIP.langToiDa / heSo()) {
    if (body.speed < .35 && body.angularSpeed < .06) break;
    await wait(32);
  }
}

/** Nội suy ease in-out từ 0 tới 1 trong ms mili giây (đã chia tốc độ) */
async function animate(ms, fn) {
  const t0 = performance.now(), dur = ms / heSo();
  for (;;) {
    const k = Math.min(1, (performance.now() - t0) / dur);
    fn(k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
    if (k >= 1) break;
    await wait(16 * heSo());
    if (!running) return;
  }
}

/** Ngón tay giả bay tới chỗ món trước khi nhấc; không bật ngón tay thì bỏ qua ngay */
async function tayToi(body) {
  if (!S.showFinger) return;
  const from = S.finger || { x: body.position.x, y: body.position.y + 120 };
  const sx = from.x, sy = from.y, tx = body.position.x, ty = body.position.y;
  await animate(NHIP.tayToi, e => { S.finger = { x: sx + (tx - sx) * e, y: sy + (ty - sy) * e, down: false }; });
  S.finger = { x: tx, y: ty, down: true };
  await wait(NHIP.tayNhac);
}

/** Đưa món từ chỗ hiện tại tới đích theo đường cong, trong lúc đó món không va chạm với ai */
async function moveTo(body, tx, ty, targetAngle, ms = NHIP.bay) {
  const sx = body.position.x, sy = body.position.y, sa = body.angle;
  await animate(ms, e => {
    const x = sx + (tx - sx) * e, y = sy + (ty - sy) * e - Math.sin(e * Math.PI) * 26;
    Body.setPosition(body, { x, y });
    Body.setAngle(body, sa + (targetAngle - sa) * e);
    if (S.showFinger) S.finger = { x, y, down: true };
  });
}

/** Nhấc một món lên, bay tới chỗ, thả xuống, chờ lắng */
async function datMon(body, step) {
  await tayToi(body);
  World.remove(S.world, body);                       // nhấc lên: tạm rời khỏi thế giới vật lý
  Body.setVelocity(body, { x: 0, y: 0 }); Body.setAngularVelocity(body, 0);
  const dich = viTriThan(body, step.x, step.y - 1, step.angle || 0);   // cao hơn 1 đơn vị: không chèn vào món dưới ngay lúc thả
  await moveTo(body, dich.x, dich.y, step.angle || 0);
  // Hộp bí ẩn bay ngang qua chìa khoá là mở ra ngay giữa đường (checkUnlock chạy mỗi bước):
  // thân cũ đã bị thay, thêm nó lại vào thế giới là có một vật ma không ai quản.
  if (!S.bodies.includes(body)) { if (S.finger) S.finger = { ...S.finger, down: false }; await wait(NHIP.nghi * 3); return; }
  World.add(S.world, body);                          // thả xuống
  Body.setVelocity(body, { x: 0, y: 0 }); Body.setAngularVelocity(body, 0);
  if (S.showFinger && S.finger) S.finger = { ...S.finger, down: false, y: S.finger.y - 4 };
  await choLang(body);                               // chờ nằm yên rồi mới sang món sau
}

const ngoaiTui = step => step.x < BAG.left - 40 || step.x > BAG.right + 40 || step.y < BAG.top - 40 || step.y > BAG.bottom + 40;

/**
 * Cửa chờ giữa hai món. Chế độ full đi thẳng; chế độ step đứng lại cho tới khi
 * autoStep() gọi. Món đầu tiên không chờ: bấm nút là phải thấy một món bay ngay.
 */
let daXepMon = 0;
async function cuaCho() {
  if (mode !== 'step' || daXepMon === 0) return;
  waitingStep = true;
  await new Promise(r => { releaseStep = r; });
  releaseStep = null; waitingStep = false;
}

// Danh mục cấu hình máy xếp, thử lần lượt tới khi có kế hoạch TRỌN. Đo trên các level đầy
// 82–89%: không cấu hình nào thắng hết, nhưng level nào cũng có ít nhất một cấu hình xếp
// trọn trong ~2 giây. Lưới thô thử được nhiều phương án hơn nên đứng trước; mặt nạ 'inner'
// (món béo ra chút, không chèn nhau khi thả) đứng trước 'center'. Mỗi cấu hình 2 giây,
// chỉ tính trọn ở đầu ván và khi kế hoạch vỡ; solveAsync nhả nhịp nên game vẫn vẽ đều.
const DANH_MUC = [
  { cell: 5, mask: 'inner', goc: 8 },
  { cell: 5, mask: 'center', goc: 8 },
  { cell: 4, mask: 'inner', goc: 16 },
  { cell: 3, mask: 'inner', goc: 16 },
];
const MOI_CAU_HINH = { tries: 20000, budgetMs: 1500 };
let cauHinhDangDung = DANH_MUC[0];

// Có được dùng booster khi hết chỗ không. Mặc định KHÔNG: video quảng cáo cần cảnh xếp
// vừa bằng tay. Bật lên thì máy dùng như người chơi: lắc → thu nhỏ → bỏ.
let dungBoosterKhiKet = false;
export function setAutoBoosters(v) { dungBoosterKhiKet = !!v; }
export const autoBoosters = () => dungBoosterKhiKet;

/**
 * Gốc hình ↔ trọng tâm. Máy xếp tính bằng hình của món quanh GỐC HÌNH (toạ độ trong định
 * nghĩa món), còn thân vật lý xoay quanh TRỌNG TÂM. Với hình sinh từ ảnh hai điểm này lệch
 * nhau vài đơn vị, và độ lệch xoay theo món. Trước đây máy đặt trọng tâm vào chỗ dành cho
 * gốc hình nên món nào cũng rơi trật kế hoạch vài px, sai lệch dồn lại thành khe hở.
 * body.origin = gốc hình − trọng tâm ở góc 0, chưa nhân cỡ (level.js không cập nhật khi scale).
 */
function gocHinh(b) {           // vị trí gốc hình trên màn của một thân đang nằm
  const k = b.artScale || 1, o = b.origin || { x: 0, y: 0 };
  const r = Vector.rotate({ x: o.x * k, y: o.y * k }, b.angle);
  return { x: b.position.x + r.x, y: b.position.y + r.y };
}
function viTriThan(b, x, y, goc) {   // trọng tâm phải ở đâu để gốc hình nằm đúng (x, y) ở góc goc
  const k = b.artScale || 1, o = b.origin || { x: 0, y: 0 };
  const r = Vector.rotate({ x: o.x * k, y: o.y * k }, goc || 0);
  return { x: x - r.x, y: y - r.y };
}

/** Hiện trạng túi cho máy xếp: vật cản là mọi thứ đang nằm trong vùng túi, theo hình và góc thật */
function hienTrang(ungVien) {
  const c = S.LEVEL.container, cx = c.cx ?? 210, bottom = c.bottom ?? 404;
  const dangDat = new Set(ungVien);
  const vatCan = S.bodies.filter(b => !b.chuaVao && !dangDat.has(b) && !isHeld(b) && bagZone(b).inZone);
  return {
    container: c,
    items: [
      // artScale là cỡ THẬT đang có: cỡ riêng trong level nhân với các lần thu nhỏ bằng booster
      ...vatCan.map(b => { const g = gocHinh(b); return { id: b.locked ? -1 : b.itemId, inBag: true, angle: b.angle, scale: b.artScale || 1, x: g.x - cx, y: g.y - bottom }; }),
      ...ungVien.map(b => ({ id: b.locked ? -1 : b.itemId, scale: b.artScale || 1, ref: b })),
    ],
  };
}

/**
 * Kế hoạch đang bám theo: danh sách bước sắp từ dưới lên, mỗi bước mang `ref` là body.
 * Lập trọn một lần từ hiện trạng; mỗi lượt lấy bước kế, KIỂM TRA lại chỗ đó trước hiện
 * trạng mới (đồ rơi vào không nằm đúng như vẽ), nhích vài ô nếu cần; chỗ đó hỏng hẳn thì
 * mới lập lại cả kế hoạch. Nhờ vậy giữ được cái nhìn toàn cục của lần tìm kiếm dài, thay
 * vì mỗi bước lại tham lam chọn món thấp nhất rồi tự dồn mình vào góc.
 */
let keHoach = [];
// Nhật ký gỡ lỗi của máy chơi, đọc ở console: __game.autoLog
export const autoLog = [];
const ghi = (...a) => { if (autoLog.length > 400) autoLog.shift(); autoLog.push(`${(performance.now() / 1000).toFixed(1)}s ` + a.join(' ')); };

async function lapKeHoach(ungVien) {
  const tt = hienTrang(ungVien);
  let best = null;
  const t0 = performance.now();
  for (let i = 0; i < DANH_MUC.length; i++) {
    const ch = DANH_MUC[i];
    if (!running) break;
    const sol = await solveAsync(tt, { ...MOI_CAU_HINH, ...ch });
    sol.cauHinh = ch;
    ghi(`  thử cell${ch.cell}/${ch.mask}/${ch.goc}: ${sol.placedCount}/${sol.needCount} ${sol.solvable ? 'TRỌN' : ''} (${sol.tries} lần)`);
    const hon = !best || sol.placedCount > best.placedCount;
    if (!best || sol.solvable || hon) best = sol;
    if (sol.solvable) break;                    // có kế hoạch trọn thì thôi, không thử tiếp
    if (i >= 1 && !hon) break;                  // hai cấu hình liền không nhích được thì lưới không phải chỗ nghẽn
  }
  cauHinhDangDung = best?.cauHinh || DANH_MUC[0];
  keHoach = (best?.plan || []).filter(st => !ngoaiTui(st) && st.ref && S.bodies.includes(st.ref));
  ghi(`lập kế hoạch: ứng viên [${ungVien.map(b => b.label).join(' ')}], vật cản ${tt.items.filter(i => i.inBag).length}, kế hoạch ${keHoach.length} bước [${keHoach.map(st => st.ref.label).join(' ')}], ${Math.round(performance.now() - t0)}ms`);
  return best;
}

/**
 * Chỗ (x, y, góc) có đặt được món này không, đo bằng HÌNH HỌC THẬT chứ không qua lưới:
 * dựng một thân vật lý tạm đúng hình, cỡ, góc rồi xem nó nằm trọn trong lòng túi và lún
 * vào đồ đang nằm trong túi không quá 2 đơn vị (vật lý tự tách được mức đó, không xô ai).
 * Kiểm tra qua lưới thì đồ nằm lệch 1px so với kế hoạch đã đủ lệch một ô, báo "không vừa"
 * sai và kéo theo tính lại vô ích.
 */
// Mặt nạ lưới 5px hụt so với hình thật tới 1,5px mỗi mép, nên hai món cạnh nhau trong kế
// hoạch có thể chồng thật 3px. Vật lý tách 3–4px êm, không xô ai; chặt hơn là chỗ đúng bị
// từ chối, món phải nhích đi, sai lệch dồn tới món cuối thì hết chỗ.
const LUN_DO = 3.5, LUN_TUONG = 3;
let lyDoTuChoi = '';   // vì sao lần kiểm tra gần nhất từ chối, cho chẩn đoán
function choHopLe(body, x, y, goc) {
  const def = body.locked ? MYSTERY : (body.realDef || body.def);
  const tam = makeItem(def, x, y);
  const k = body.artScale || 1;
  if (k !== 1) { Body.scale(tam, k, k); tam.artScale = k; }
  Body.setAngle(tam, goc || 0);
  Body.setPosition(tam, viTriThan(tam, x, y, goc));   // gốc hình đúng chỗ (x, y) sau khi xoay
  lyDoTuChoi = '';
  if (!bagZone(tam).fullyInside) { lyDoTuChoi = `ngoài túi bounds[${Math.round(tam.bounds.min.x)},${Math.round(tam.bounds.min.y)},${Math.round(tam.bounds.max.x)},${Math.round(tam.bounds.max.y)}] túi[${Math.round(BAG.left)},${Math.round(BAG.top)},${Math.round(BAG.right)},${Math.round(BAG.bottom)}]`; return false; }
  const manhTam = tam.parts.length > 1 ? tam.parts.slice(1) : [tam];
  const soat = (khac, nguong, ten) => {
    for (const o of khac) {
      if (!Bounds.overlaps(o.bounds, tam.bounds)) continue;
      const manhO = o.parts.length > 1 ? o.parts.slice(1) : [o];
      for (const a of manhTam) for (const b of manhO) {
        const c = Collision.collides(a, b);
        if (c && c.collided && c.depth > nguong) { lyDoTuChoi = `${ten} ${o.label} lún ${c.depth.toFixed(1)}`; return false; }
      }
    }
    return true;
  };
  if (!soat(S.bodies.filter(o => o !== body && !o.chuaVao && !isHeld(o)), LUN_DO, 'chạm')) return false;
  return soat(S.staticBodies, LUN_TUONG, 'tường');
}

/** Chẩn đoán: lập kế hoạch cho hiện trạng rồi soi từng bước ở đúng chỗ kế hoạch định */
export async function chanDoan() {
  const ungVien = conOKhay();
  const sol = await solveAsync(hienTrang(ungVien), { ...MOI_CAU_HINH, ...DANH_MUC[0] });
  return (sol.plan || []).map(st => {
    const ok = st.ref ? choHopLe(st.ref, st.x, st.y, st.angle || 0) : null;
    return `${st.ref?.label} (${st.x},${st.y}) ${Math.round((st.angle || 0) * 180 / Math.PI)}° → ${ok ? 'ok' : lyDoTuChoi}`;
  });
}

/** Tìm chỗ hợp lệ gần chỗ kế hoạch định: đúng chỗ trước, rồi nhích vài đơn vị, rồi xoay nhẹ */
const LECH_Y = [0, -2, -4, -7, -10, 2], LECH_X = [0, -2, 2, -4, 4, -7, 7];
function timChoGan(body, st) {
  const buocGoc = Math.PI / cauHinhDangDung.goc;
  for (const da of [0, -buocGoc / 2, buocGoc / 2]) for (const dy of LECH_Y) for (const dx of LECH_X) {
    const goc = (st.angle || 0) + da;
    if (choHopLe(body, st.x + dx, st.y + dy, goc)) return { ...st, x: st.x + dx, y: st.y + dy, angle: goc, lech: Math.abs(dx) + Math.abs(dy), xoay: da !== 0 };
  }
  return null;
}

async function buocTiepTheo(ungVien) {
  if (!S.LEVEL?.container || !ungVien.length) return null;
  const conHopLe = () => { keHoach = keHoach.filter(st => ungVien.includes(st.ref)); return keHoach.length > 0; };
  if (!conHopLe()) await lapKeHoach(ungVien);
  if (!conHopLe()) return null;

  const st = keHoach[0];
  const chinh = timChoGan(st.ref, st);
  if (chinh) { ghi(`đặt ${st.ref.label} theo kế hoạch, lệch ${chinh.lech}${chinh.xoay ? ', xoay nhẹ' : ''}`); keHoach.shift(); return { body: st.ref, step: chinh }; }

  // chỗ đã định không còn vừa → lập lại từ hiện trạng
  ghi(`chỗ của ${st.ref.label} không còn vừa → tính lại`);
  await lapKeHoach(ungVien);
  if (!keHoach.length) return null;
  const st2 = keHoach.shift();
  return { body: st2.ref, step: st2 };
}

/**
 * Mở hộp bí ẩn: nhấc hộp, đưa tới chạm chìa khoá đang nằm trong túi. checkUnlock bắt được
 * va chạm là thay hộp bằng món thật; món thật thường to hơn hộp nên game tự trả nó về khay
 * nếu chỗ đó không chứa nổi. Làm việc này TRƯỚC khi xếp món khác: kế hoạch phải biết hình
 * thật của món chứ không phải cái hộp 62×62.
 */
async function moKhoa(hop, chia) {
  ghi(`mở khoá: kéo ${hop.label} (${Math.round(hop.position.x)},${Math.round(hop.position.y)}) tới chìa (${Math.round(chia.position.x)},${Math.round(chia.position.y)})`);
  await tayToi(hop);
  World.remove(S.world, hop);
  Body.setVelocity(hop, { x: 0, y: 0 }); Body.setAngularVelocity(hop, 0);
  await moveTo(hop, chia.position.x, chia.position.y - 4, hop.angle);
  // chờ vài bước vật lý cho checkUnlock bắt va chạm
  const t0 = performance.now();
  while (running && S.bodies.includes(hop) && hop.locked && performance.now() - t0 < 700) await wait(32);
  if (S.bodies.includes(hop)) { World.add(S.world, hop); ghi('  mở khoá KHÔNG thành, thả hộp tại chỗ'); }
  else { const moi = S.bodies.find(b => b.itemId === hop.itemId); ghi(`  đã mở: ${moi?.label} giờ ở (${Math.round(moi?.position.x)},${Math.round(moi?.position.y)}), ${moi && bagZone(moi).inZone ? 'trong vùng túi' : 'ngoài khay'}`); }
  if (S.finger) S.finger = { ...S.finger, down: false };
  await wait(NHIP.nghi * 4);
}

/** Những món còn phải xếp: đang ở khay, chưa vào túi, không buộc dây (xếp tay khó mô phỏng) */
const conOKhay = () => S.bodies.filter(b => !b.chuaVao && !b.tether && b.itemId !== KEY_ID
  && !S.checked.has(b.itemId) && !S.gone.has(b.itemId) && !isHeld(b) && !bagZone(b).inZone);

/**
 * Hết chỗ mà đồ còn ở khay: làm đúng việc người chơi làm, theo thứ tự nhẹ tay trước.
 *   thu nhỏ   món to nhất ngoài túi bé đi 20%
 *   bỏ đi     bớt một món thường
 * Bấm qua chính nút trên HUD để số lượt, tiếng và hiệu ứng y như người bấm.
 * Trả về false khi không còn booster nào.
 */
async function dungBooster() {
  const bam = id => { const el = document.getElementById(id); if (!el || el.disabled) return false; el.click(); return true; };
  if (S.boosts.resize > 0 && bam('bResize')) { await waitGame(600); return true; }
  if (S.boosts.throw > 0 && bam('bThrow')) { await waitGame(700); return true; }
  return false;
}

/** Chạy tự chơi cho level đang mở */
export async function autoplay({ mode: m = 'full' } = {}) {
  if (running || S.won || S.lost || !S.LEVEL) return;
  running = true; mode = m; daXepMon = 0; waitingStep = false; keHoach = [];
  S.selected = null; S.drag = null;
  try { await chayTuChoi(); }
  catch (e) { console.error('autoplay:', e); ghi('LỖI ' + (e?.message || e)); }
  finally { S.finger = null; running = false; waitingStep = false; }
}

async function chayTuChoi() {

  // Đầu màn đồ vào sân lần lượt. Bấm tự chơi ngay lúc đó thì món chưa tới lượt vẫn bị
  // máy nhấc đi đặt, mà nó chưa được vẽ nên nhìn như biến mất. Cho vào sân hết trước đã.
  // Thả bằng đúng hàm của mở màn: món đang chờ nằm trên đỉnh màn, ngoài trần, phải được cho
  // xuyên trần rồi rơi xuống — add thẳng vào thế giới là nó kẹt trên trần mãi.
  for (const b of S.bodies) if (b.chuaVao) thaVaoSan(b);
  // rồi chờ cả đống rơi xuống sân nằm yên, không thì máy nhấc món đang lơ lửng giữa trời
  for (let i = 0; i < 200 && S.bodies.some(b => b.dangRoi || b.speed > .6); i++) await waitGame(50);

  const uocLuong = solve(S.LEVEL, { tries: 120, budgetMs: 120 });
  note(uocLuong.solvable ? t('autoAll') : t('autoSome', { a: uocLuong.placedCount, b: uocLuong.needCount }), 2600);
  await wait(NHIP.moDau);

  // Vòng chính: mỗi lượt tính lại từ hiện trạng, đặt một món, chờ lắng. Kẹt thì booster.
  // Món bị hất ra khay (luật đẩy-ra-khỏi-túi) tự quay lại danh sách ứng viên ở lượt sau.
  let ketKhongLoi = 0;
  while (running && !S.won && !S.lost) {
    // Còn hộp bí ẩn và còn chìa → mở trước
    const hop = S.bodies.find(b => b.locked && !b.chuaVao && !isHeld(b)), chia = S.bodies.find(b => b.itemId === KEY_ID);
    if (hop && chia) { await cuaCho(); if (!running) break; await moKhoa(hop, chia); daXepMon++; continue; }

    const ungVien = conOKhay();
    if (!ungVien.length) {
      // Còn món kẹt nửa trong nửa ngoài, hoặc hộp bí ẩn vừa mở ra thành món to hơn chỗ
      // của nó? Luật đẩy-ra-khỏi-túi cần chừng 2 giây THỰC (không theo tốc độ game) để
      // trả món về khay, lúc đó nó mới thành ứng viên. Chờ tới 5 giây rồi mới chịu thua.
      const keCon = S.bodies.some(b => !b.chuaVao && !b.tether && b.itemId !== KEY_ID && !S.checked.has(b.itemId) && !S.gone.has(b.itemId));
      if (!keCon || ++ketKhongLoi > 12) { ghi(keCon ? 'dừng: món kẹt không được trả về khay' : 'dừng: không còn món nào ở khay'); break; }
      await new Promise(r => setTimeout(r, 400)); continue;   // thời gian thực, không chia tốc độ
    }
    ketKhongLoi = 0;
    const buoc = await buocTiepTheo(ungVien);
    if (!running) break;
    if (!buoc) {
      if (dungBoosterKhiKet && await dungBooster()) continue;   // đã dùng booster, tính lại
      note(t('autoStuck', { n: ungVien.length }), 3200);
      break;                                                     // hết cách
    }
    await cuaCho(); if (!running) break;
    await datMon(buoc.body, buoc.step); daXepMon++;
    const b = buoc.body;
    if (S.bodies.includes(b)) { const gh = gocHinh(b); ghi(`  → ${b.label} gốc hình ở (${Math.round(gh.x)},${Math.round(gh.y)}) ${Math.round(b.angle * 180 / Math.PI)}°, kế hoạch (${buoc.step.x},${buoc.step.y}) ${Math.round((buoc.step.angle || 0) * 180 / Math.PI)}°`); }
  }

  await wait(NHIP.ketThuc);
  if (running) {
    const left = S.ITEMS.filter(d => !S.checked.has(d.id)).length;
    note(left ? t('autoDoneLeft', { n: left }) : t('autoDoneFit'), 3000);
  }
}

/**
 * Chế độ từng món: chưa chạy thì bắt đầu và xếp món đầu; đang chờ thì xếp món tiếp;
 * đang bay thì bỏ qua lần bấm (bấm dồn không làm hai món bay cùng lúc).
 */
export function autoStep() {
  if (!running) return autoplay({ mode: 'step' });
  if (waitingStep && releaseStep) releaseStep();
}

export function stopAutoplay() {
  running = false;
  if (releaseStep) releaseStep();      // đang đứng chờ thì thả ra để vòng lặp thoát
  waitingStep = false;
  S.finger = null;
}
