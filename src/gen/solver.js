// Máy xếp: có nhét hết đồ vào lòng túi được không, và xếp thế nào.
//
// Raster hoá lòng túi thành lưới ô CELL, raster hoá HÌNH THẬT của từng món ở nhiều góc
// xoay thành mặt nạ ô, rồi xếp từ đáy lên: mỗi lượt xem trong những món còn lại món nào
// đặt được THẤP nhất, bám chắc nhất, để lại ít hố nhất — chọn món đó, không xếp theo một
// thứ tự định sẵn. Thử vài phương án có ngẫu nhiên trong một ngân sách thời gian.
//
// Đo trên 20 level hiện có (bench trong scratchpad): lưới mịn hơn 5px hay nhiều hơn 8 góc
// KHÔNG xếp được thêm món trong cùng ngân sách thời gian — mỗi phương án đắt hơn nên thử
// được ít hơn. Mặc định giữ 5px · 8 góc · lấy tâm ô, đúng như ước lượng cũ của editor.
// Máy tự chơi truyền tuỳ chọn riêng (xem game/autoplay.js).
//
// Kế hoạch trả về sắp theo MÉP DƯỚI từ thấp lên cao: xếp to trước như cũ thì món to nằm
// trên rơi xuống khi món dưới chưa có mặt, cả đống trật chỗ.
import { pointInPolygon, bbox, mulberry32 } from '../util/geom.js';
import { defById } from '../data/items.js';
import { blockPoly } from '../data/blocks.js';

// Tuỳ chọn mặt nạ:
//   center  ô thuộc món khi TÂM ô nằm trong hình — không thiên lệch, ước lượng sát nhất
//   inner   thêm bốn góc lùi vào 30% — món "béo" ra chút, kế hoạch bớt chèn nhau khi chơi thật
//   full    bốn góc sát mép — bảo toàn hẳn, phí chỗ nhiều
const LUI_THEO_MASK = { center: null, inner: .3, full: .08 };
function diemThu(mask) {
  const lui = LUI_THEO_MASK[mask] ?? null;
  return lui == null ? [[.5, .5]] : [[.5, .5], [lui, lui], [1 - lui, lui], [lui, 1 - lui], [1 - lui, 1 - lui]];
}
// Lòng túi luôn đo ở tâm ô (cách cũ): ô có tâm trong túi là trống
const DIEM_TUI = [[.5, .5]];

// ---------- hình thật của món ----------
const TRON_DINH = 16;   // hình tròn xấp xỉ bằng đa giác bấy nhiêu đỉnh

/** Các đa giác tạo nên hình vật lý của món, đơn vị logic, gốc tại tâm món */
export function hinhMon(id) {
  const d = defById(id); if (!d) return null;
  const manh = d.kind === 'compound' ? d.parts : [d, ...(d.extra ? [d.extra] : [])];
  const ra = [];
  for (const p of manh) {
    const dx = p.dx || 0, dy = p.dy || 0;
    if (p.kind === 'circle') {
      const v = [];
      for (let i = 0; i < TRON_DINH; i++) {
        const a = i / TRON_DINH * 2 * Math.PI;
        v.push([dx + Math.cos(a) * p.r, dy + Math.sin(a) * p.r]);
      }
      ra.push(v);
    } else if (p.kind === 'rect') {
      const w = p.w / 2, h = p.h / 2;
      ra.push([[dx - w, dy - h], [dx + w, dy - h], [dx + w, dy + h], [dx - w, dy + h]]);
    } else if (p.kind === 'poly' && p.pts?.length >= 3) {
      ra.push(p.pts.map(([x, y]) => [dx + x, dy + y]));
    }
  }
  if (!ra.length && d.box) {
    const [x0, y0, x1, y1] = d.box;
    ra.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  }
  return ra.length ? ra : null;
}

export const xoay = (pts, a, k) => {
  const cs = Math.cos(a), sn = Math.sin(a);
  return pts.map(([x, y]) => [(x * cs - y * sn) * k, (x * sn + y * cs) * k]);
};

/**
 * Mặt nạ ô của một món ở một góc xoay.
 * minX/minY là toạ độ cục bộ của mép mặt nạ, cần để quy ngược ra vị trí tâm món.
 * day[c] là hàng thấp nhất có ô ở cột c (−1 nếu cột trống), dùng để đếm hố dưới món.
 */
function matNa(hinh, goc, k, CELL, DIEM_O) {
  const manh = hinh.map(p => xoay(p, goc, k));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of manh) for (const [x, y] of p) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const cw = Math.max(1, Math.ceil((maxX - minX) / CELL));
  const ch = Math.max(1, Math.ceil((maxY - minY) / CELL));
  const o = new Uint8Array(cw * ch);
  let so = 0;
  for (let r = 0; r < ch; r++) for (let c = 0; c < cw; c++) {
    const x0 = minX + c * CELL, y0 = minY + r * CELL;
    if (DIEM_O.some(([u, v]) => manh.some(p => pointInPolygon(x0 + u * CELL, y0 + v * CELL, p)))) { o[r * cw + c] = 1; so++; }
  }
  if (!so) { o.fill(1); so = cw * ch; }   // món mảnh hơn một ô: lấp đầy để nó vẫn chiếm chỗ
  const day = new Int16Array(cw).fill(-1);
  for (let c = 0; c < cw; c++) for (let r = ch - 1; r >= 0; r--) if (o[r * cw + c]) { day[c] = r; break; }
  return { o, cw, ch, minX, minY, so, day, goc };
}

/** Hai mặt nạ giống hệt nhau (hình đối xứng xoay 180°) thì chỉ giữ một */
function locTrung(list) {
  const ra = [];
  for (const m of list) {
    const trung = ra.some(x => x.cw === m.cw && x.ch === m.ch && x.o.every((v, i) => v === m.o[i]));
    if (!trung) ra.push(m);
  }
  return ra;
}

// ---------- lưới lòng túi ----------
/** 1 = ô trống trong lòng túi, ngoài ngăn khoá */
function rasterize(container, CELL) {
  const shape = container.shape, bb = bbox(shape);
  const cols = Math.ceil(bb.w / CELL), rows = Math.ceil(bb.h / CELL);
  const grid = new Uint8Array(cols * rows);
  const blocks = (container.blocks || []).map(b => ({ ...b, poly: !b.kind || b.kind === 'rect' ? null : blockPoly(b) }));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x0 = bb.minX + c * CELL, y0 = bb.minY + r * CELL;
    let ok = DIEM_TUI.every(([u, v]) => pointInPolygon(x0 + u * CELL, y0 + v * CELL, shape));
    for (const b of blocks) {
      if (!ok) break;
      // vật cản: ô nào chạm vào là bận
      if (!(x0 + CELL > b.x && x0 < b.x + b.w && y0 + CELL > b.y && y0 < b.y + b.h)) continue;
      if (!b.poly) { ok = false; continue; }
      // hình khác chữ nhật: bận khi tâm hoặc một góc ô nằm trong hình, hoặc một đỉnh hình rơi vào ô
      ok = ![[.5, .5], [0, 0], [1, 0], [0, 1], [1, 1]].some(([u, v]) => pointInPolygon(x0 + u * CELL, y0 + v * CELL, b.poly))
        && !b.poly.some(([px, py]) => px >= x0 && px <= x0 + CELL && py >= y0 && py <= y0 + CELL);
    }
    grid[r * cols + c] = ok ? 1 : 0;
  }
  return { grid, cols, rows };
}

/** Món có đặt được ở (c0, r0) không. Soát từ hàng dưới lên: đồ vướng nhau ở đáy là chính. */
function vua(g, m, c0, r0) {
  if (c0 < 0 || r0 < 0 || c0 + m.cw > g.cols || r0 + m.ch > g.rows) return false;
  for (let r = m.ch - 1; r >= 0; r--) {
    const hangM = r * m.cw, hangG = (r0 + r) * g.cols + c0;
    for (let c = 0; c < m.cw; c++) if (m.o[hangM + c] && g.grid[hangG + c] !== 1) return false;
  }
  return true;
}
function danh(g, m, c0, r0, v) {
  for (let r = 0; r < m.ch; r++) {
    const hangM = r * m.cw, hangG = (r0 + r) * g.cols + c0;
    for (let c = 0; c < m.cw; c++) if (m.o[hangM + c]) g.grid[hangG + c] = v;
  }
}

/**
 * Điểm của một chỗ đặt, càng cao càng tốt:
 *   + số cạnh ô của món tựa vào thành túi hoặc món đã xếp (bám chắc, không chơ vơ)
 *   − 4 × số ô trống ngay dưới đáy món (hố: vừa phí chỗ vừa làm món nghiêng khi rơi)
 *   − phạt thêm khi đáy được đỡ dưới nửa bề rộng: thả xuống là món lật, cả kế hoạch vỡ
 */
function diemCho(g, m, c0, r0) {
  let bam = 0, ho = 0;
  for (let r = 0; r < m.ch; r++) for (let c = 0; c < m.cw; c++) {
    if (!m.o[r * m.cw + c]) continue;
    const gr = r0 + r, gc = c0 + c;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const mr = r + dr, mc = c + dc;
      if (mr >= 0 && mc >= 0 && mr < m.ch && mc < m.cw && m.o[mr * m.cw + mc]) continue;  // ô của chính món
      const nr = gr + dr, nc = gc + dc;
      if (nr < 0 || nc < 0 || nr >= g.rows || nc >= g.cols) { bam++; continue; }
      if (g.grid[nr * g.cols + nc] !== 1) bam++;
    }
  }
  let cot = 0;
  for (let c = 0; c < m.cw; c++) {
    const d = m.day[c]; if (d < 0) continue;
    cot++;
    const nr = r0 + d + 1, nc = c0 + c;
    if (nr < g.rows && g.grid[nr * g.cols + nc] === 1) ho++;
  }
  const do_ = cot ? (cot - ho) / cot : 1;
  return bam - 4 * ho - (do_ < .5 ? 30 : 0);
}

/**
 * Chỗ đặt tốt nhất cho một món, duyệt theo MÉP DƯỚI từ đáy túi đi lên.
 *
 * Không lấy "hàng sâu nhất có chỗ" rồi thôi: một cái bình dựng chéo tựa lên một đỉnh chui
 * được sâu hơn một hàng so với đặt nằm ngang, thế là thắng, rồi thả vào túi nó lăn lệch cả
 * chục px và kéo cả kế hoạch trật theo. Gom ứng viên trong CUA_SO hàng kể từ hàng sâu nhất
 * có chỗ, chấm điểm tổng = điểm chỗ + MOI_HANG × độ sâu; mỗi hàng sâu hơn chỉ đáng vài ô
 * bám, nên chỗ nằm chắc, nhiều cạnh tựa thắng chỗ chông chênh.
 * Trả về { m, c, r, day, diem } hoặc null.
 */
const CUA_SO = 2, MOI_HANG = 20;
function choThapNhat(g, b) {
  let tot = null, tongTot = -Infinity, dayDau = -1;
  for (let day = g.rows; day >= 1; day--) {
    if (dayDau >= 0 && dayDau - day >= CUA_SO) break;
    for (const m of b.matNa) {
      const r = day - m.ch;
      if (r < 0) continue;
      for (let c = 0; c <= g.cols - m.cw; c++) {
        if (!vua(g, m, c, r)) continue;
        if (dayDau < 0) dayDau = day;
        const diem = diemCho(g, m, c, r), tong = diem + MOI_HANG * day;
        if (tong > tongTot) { tongTot = tong; tot = { m, c, r, day, diem }; }
      }
    }
  }
  return tot;
}

/**
 * Một phương án xếp. Mỗi lượt tìm chỗ thấp nhất cho TỪNG món còn lại rồi chọn món đặt
 * được thấp nhất; bằng nhau thì món to trước (to là khó nhét, để sau dễ kẹt), rồi điểm.
 * `nhieu` > 0: thay vì luôn lấy ứng viên tốt nhất, thỉnh thoảng lấy ứng viên kế — để
 * các lần thử sau khác nhau mà vẫn không xếp bừa.
 */
function phuongAn(g0, mon, rand, nhieu, hetGio) {
  const g = { grid: g0.grid.slice(), cols: g0.cols, rows: g0.rows };
  const conLai = mon.slice();
  const placed = [];
  while (conLai.length) {
    if (hetGio()) break;
    const uv = [];
    for (const b of conLai) {
      const cho = choThapNhat(g, b);
      if (cho) uv.push({ b, cho });
    }
    if (!uv.length) break;
    uv.sort((x, y) => (y.cho.day - x.cho.day) || (y.b.so - x.b.so) || (y.cho.diem - x.cho.diem));
    let k = 0;
    if (nhieu > 0 && uv.length > 1 && rand() < nhieu) k = 1 + Math.floor(rand() * Math.min(2, uv.length - 1));
    const { b, cho } = uv[k];
    danh(g, cho.m, cho.c, cho.r, 2);
    placed.push({ id: b.id, ref: b.ref, c: cho.c, r: cho.r, m: cho.m, goc: cho.m.goc });
    conLai.splice(conLai.indexOf(b), 1);
  }
  // độ cao đỉnh đống đồ: thấp hơn là gọn hơn, dùng để so hai phương án cùng số món
  let dinh = g.rows;
  for (const p of placed) dinh = Math.min(dinh, p.r);
  return { ok: conLai.length === 0, placed, failed: conLai[0]?.id, dinh };
}

/** Phương án theo một thứ tự định sẵn (cách cũ): rẻ hơn nhiều, thử được nhiều lần hơn */
function phuongAnTheoThuTu(g0, order, hetGio) {
  const g = { grid: g0.grid.slice(), cols: g0.cols, rows: g0.rows };
  const placed = [];
  for (const b of order) {
    if (hetGio()) break;
    const cho = choThapNhat(g, b);
    if (!cho) return { ok: false, placed, failed: b.id, dinh: dinhCua(placed, g) };
    danh(g, cho.m, cho.c, cho.r, 2);
    placed.push({ id: b.id, ref: b.ref, c: cho.c, r: cho.r, m: cho.m, goc: cho.m.goc });
  }
  return { ok: placed.length === order.length, placed, failed: undefined, dinh: dinhCua(placed, g) };
}
function dinhCua(placed, g) { let d = g.rows; for (const p of placed) d = Math.min(d, p.r); return d; }
const tron = (rand, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/**
 * Đổi kết quả xếp trên lưới thành toạ độ MÀN HÌNH cho autoplay, sắp theo MÉP DƯỚI từ
 * thấp lên cao: món nào nằm dưới thì có mặt trước, món trên thả xuống mới có chỗ tựa.
 * container.shape là toạ độ cục bộ, gốc ở giữa đáy lòng túi, nên phải cộng (cx, bottom).
 * Ô (0,0) của mặt nạ ứng với điểm cục bộ (minX, minY) của món, nên tâm món nằm ở
 * mép lưới trừ đi minX/minY.
 */
function toPlan(placed, level, CELL) {
  const c = level.container || {};
  const ox = c.cx ?? 210, oy = c.bottom ?? 404;
  const bb = bbox(c.shape);
  return placed.slice()
    .sort((a, b) => ((b.r + b.m.ch) - (a.r + a.m.ch)) || (b.m.so - a.m.so))
    .map(p => ({
      id: p.id, ref: p.ref,
      x: Math.round(ox + bb.minX + p.c * CELL - p.m.minX),
      y: Math.round(oy + bb.minY + p.r * CELL - p.m.minY),
      angle: p.goc,
    }));
}

/**
 * Dựng lưới và mặt nạ cho một level. Dùng chung cho solve (đồng bộ) và solveAsync.
 * Mỗi item có thể mang `ref` (bất kỳ), được chép nguyên sang kế hoạch để bên gọi tra
 * ngược ra vật thật khi hai món cùng mã (hai hộp bí ẩn).
 */
function chuanBi(level, { cell, mask, goc }) {
  const CELL = cell, DIEM_O = diemThu(mask);
  const GOC = Array.from({ length: goc }, (_, i) => i * 2 * Math.PI / goc);
  const g = rasterize(level.container, CELL);
  const bb = bbox(level.container.shape);
  const coRieng = it => Number(it.scale) || 1;

  // Món đặt sẵn trong túi: đánh dấu ô đã bận theo đúng hình và góc của nó
  for (const it of level.items) {
    if (!it.inBag) continue;
    const hinh = hinhMon(it.id); if (!hinh) continue;
    const m = matNa(hinh, it.angle || 0, coRieng(it), CELL, DIEM_O);
    const c0 = Math.round(((it.x ?? 0) + m.minX - bb.minX) / CELL);
    const r0 = Math.round(((it.y ?? 0) + m.minY - bb.minY) / CELL);
    for (let r = 0; r < m.ch; r++) for (let c = 0; c < m.cw; c++) {
      if (!m.o[r * m.cw + c]) continue;
      const gr = r0 + r, gc = c0 + c;
      if (gr >= 0 && gr < g.rows && gc >= 0 && gc < g.cols) g.grid[gr * g.cols + gc] = 0;
    }
  }

  const mon = level.items
    .filter(it => !it.inBag && it.id !== 0)
    .map(it => {
      const hinh = hinhMon(it.id); if (!hinh) return null;
      const k = coRieng(it);
      const theoGoc = locTrung(GOC.map(a => matNa(hinh, a, k, CELL, DIEM_O)));
      return { id: it.id, ref: it.ref, matNa: theoGoc, so: theoGoc[0].so };
    })
    .filter(Boolean);
  return { g, mon, CELL };
}

/** Một lần thử thứ t. Hai lối xen kẽ: chọn món theo chỗ (kỹ, chậm) và xếp theo thứ tự to-trước có trộn (rẻ). */
function thuLan(t, g, mon, theoCo, rand, hetGio) {
  if (t % 2 === 0) return phuongAn(g, mon, rand, t === 0 ? 0 : Math.min(.5, .15 + t * .02), hetGio);
  let order = theoCo;
  if (t > 1) {
    const half = Math.ceil(theoCo.length / 2);
    order = t % 3 === 0 ? tron(rand, theoCo) : theoCo.slice(0, half).concat(tron(rand, theoCo.slice(half)));
  }
  return phuongAnTheoThuTu(g, order, hetGio);
}
// Phương án nào hơn: xếp trọn > xếp được nhiều DIỆN TÍCH hơn > nhiều món hơn > đống đồ thấp hơn.
// So theo diện tích chứ không theo số món: bỏ lại một món to để nhét được hai món nhỏ là
// cách chắc chắn thua — món to không bao giờ còn chỗ về sau.
const dienTich = r => r.placed.reduce((s, p) => s + p.m.so, 0);
const totHon = (r, best) => !best || (r.ok && !best.ok)
  || (r.ok === best.ok && (dienTich(r) > dienTich(best)
    || (dienTich(r) === dienTich(best) && (r.placed.length > best.placed.length
      || (r.placed.length === best.placed.length && r.dinh > best.dinh)))));
function ketQua(best, t, needCount, level, CELL) {
  return {
    solvable: best.ok, tries: t, placedCount: best.placed.length, needCount,
    failed: best.ok ? undefined : best.failed, plan: toPlan(best.placed, level, CELL),
  };
}
const MAC_DINH = { tries: 150, seed: 1, budgetMs: 250, cell: 5, mask: 'center', goc: 8 };


/**
 * Ước lượng xem có xếp hết đồ vào lòng túi không, và trả về cách xếp tốt nhất tìm được.
 *
 * Vẫn là ước lượng, không phải lời giải thật: xếp trên lưới ô `cell` đơn vị, `goc` góc xoay
 * chứ không phải mọi góc, và không chạy physics (đồ dồn xuống, lèn vào nhau khi lắc).
 * Xếp được ở đây → gần như chắc chắn chơi được.
 * Không xếp được ở đây → vẫn có thể chơi được, chỉ là chặt tay.
 *
 * Món đã nằm sẵn trong túi (inBag, ví dụ chìa khoá) không phải xếp, nhưng chiếm chỗ thật.
 *
 * tries là số phương án tối đa, budgetMs là thời gian tối đa — hết cái nào trước thì dừng.
 * Phương án đầu không ngẫu nhiên nên cùng level luôn ra cùng kết quả lúc chưa hết giờ.
 */
export function solve(level, opts = {}) {
  const o = { ...MAC_DINH, ...opts };
  const t0 = performance.now();
  const hetGio = () => performance.now() - t0 > o.budgetMs;
  const { g, mon, CELL } = chuanBi(level, o);
  const needCount = mon.length;
  if (!needCount) return { solvable: true, tries: 0, placedCount: 0, needCount: 0, plan: [] };
  const rand = mulberry32(o.seed);
  const theoCo = mon.slice().sort((a, b) => b.so - a.so);
  let best = null, t = 0;
  for (; t < o.tries; t++) {
    const r = thuLan(t, g, mon, theoCo, rand, hetGio);
    if (totHon(r, best)) best = r;
    if (r.ok || hetGio()) { t++; break; }
  }
  return ketQua(best, t, needCount, level, CELL);
}

/**
 * Như solve nhưng nhả lại cho trình duyệt giữa hai phương án, để máy tự chơi tính kế hoạch
 * trong lúc game vẫn vẽ đều — quay video mà khung hình khựng 200ms là thấy ngay.
 * budgetMs ở đây là thời gian THỰC kể cả lúc nhả, nên đặt rộng hơn bản đồng bộ.
 */
export async function solveAsync(level, opts = {}) {
  const o = { ...MAC_DINH, ...opts };
  const t0 = performance.now();
  const hetGio = () => performance.now() - t0 > o.budgetMs;
  const nha = () => new Promise(r => setTimeout(r, 0));
  const { g, mon, CELL } = chuanBi(level, o);
  const needCount = mon.length;
  if (!needCount) return { solvable: true, tries: 0, placedCount: 0, needCount: 0, plan: [] };
  const rand = mulberry32(o.seed);
  const theoCo = mon.slice().sort((a, b) => b.so - a.so);
  let best = null, t = 0;
  for (; t < o.tries; t++) {
    const r = thuLan(t, g, mon, theoCo, rand, hetGio);
    if (totHon(r, best)) best = r;
    if (r.ok || hetGio()) { t++; break; }
    await nha();
  }
  return ketQua(best, t, needCount, level, CELL);
}
