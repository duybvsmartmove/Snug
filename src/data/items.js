// Item của chương School Day, lấy từ sheet "Level Design SNUG Mobile".
//
// Kích thước chọn theo mục tiêu diện tích để Packing Density có ý nghĩa:
//   Small ≈ 2.300 px²   ·   Medium ≈ 5.000 px²   ·   Large ≈ 9.000 px²
// Món dạng Long cố tình nhỏ hơn mục tiêu vì đặc tính của nó là dài và hẹp.
//
//  kind  : rect | circle | poly (đa giác lồi) | compound (nhiều part)
//  box   : khung vẽ cục bộ [x0, y0, x1, y1]
//  meta  : size · shape · physics · cost · canLink · canLock (theo GDD Level Generation)
//
// Toạ độ hình vật lý trùng với toạ độ hàm vẽ trong art/items.js.

const M = (size, shape, physics, cost, canLink = true, canLock = true) => ({ size, shape, physics, cost, canLink, canLock });

export const ITEM_DEFS = [
  // ---------- Clothing ----------
  { id: 1, slug: 'tshirt', code: 'ITM_001', name: 'Áo phông gấp', kind: 'rect', w: 84, h: 60, chamfer: 8, box: [-42, -30, 42, 30],
    meta: M('Medium', 'Rectangle', 'normal', 1) },
  { id: 2, slug: 'shorts', code: 'ITM_002', name: 'Quần short gấp', kind: 'rect', w: 80, h: 58, chamfer: 8, box: [-40, -29, 40, 29],
    meta: M('Medium', 'Rectangle', 'normal', 1) },
  { id: 3, slug: 'socks', code: 'ITM_003', name: 'Tất cuộn', kind: 'circle', r: 27, box: [-27, -27, 27, 27],
    meta: M('Small', 'Oval', 'rolling', 2) },
  { id: 4, slug: 'sneaker', code: 'ITM_004', name: 'Giày thể thao', kind: 'poly',
    pts: [[-44, 8], [-38, -6], [-10, -14], [6, -26], [22, -26], [30, -8], [44, 4], [44, 20], [-44, 20]], box: [-44, -26, 44, 20],
    meta: M('Medium', 'L-shape', 'normal', 2, true, false) },
  { id: 5, slug: 'raincoat', code: 'ITM_005', name: 'Áo mưa gấp', kind: 'rect', w: 86, h: 62, chamfer: 6, box: [-43, -31, 43, 31],
    meta: M('Medium', 'Rectangle', 'normal', 1) },

  // ---------- Personal Care ----------
  { id: 6, slug: 'tissue', code: 'ITM_006', name: 'Gói giấy ăn', kind: 'rect', w: 56, h: 42, chamfer: 10, box: [-28, -21, 28, 21],
    meta: M('Small', 'Rectangle', 'normal', 1) },
  { id: 7, slug: 'sanitizer', code: 'ITM_007', name: 'Nước rửa tay', kind: 'rect', w: 34, h: 66, chamfer: 12, box: [-17, -45, 17, 33],
    extra: { kind: 'rect', w: 16, h: 14, dx: 0, dy: -40 },
    meta: M('Small', 'Rounded rect', 'normal', 1) },
  { id: 8, slug: 'handtowel', code: 'ITM_008', name: 'Khăn tay', kind: 'rect', w: 58, h: 40, chamfer: 5, box: [-29, -20, 29, 20],
    meta: M('Small', 'Rectangle', 'normal', 1) },
  { id: 9, slug: 'lipbalm', code: 'ITM_009', name: 'Son dưỡng môi', kind: 'rect', w: 20, h: 76, chamfer: 9, box: [-10, -38, 10, 38],
    meta: M('Small', 'Long', 'rolling', 2) },
  { id: 10, slug: 'wetwipes', code: 'ITM_010', name: 'Khăn ướt', kind: 'rect', w: 60, h: 40, chamfer: 8, box: [-30, -20, 30, 20],
    meta: M('Small', 'Rectangle', 'normal', 1) },

  // ---------- Electronics ----------
  { id: 11, slug: 'tablet', code: 'ITM_011', name: 'Máy tính bảng', kind: 'rect', w: 112, h: 80, chamfer: 7, box: [-56, -40, 56, 40],
    meta: M('Large', 'Rectangle', 'normal', 3, false, true) },
  { id: 12, slug: 'calculator', code: 'ITM_012', name: 'Máy tính bỏ túi', kind: 'rect', w: 44, h: 54, chamfer: 5, box: [-22, -27, 22, 27],
    meta: M('Small', 'Rectangle', 'normal', 1) },
  { id: 13, slug: 'earbuds', code: 'ITM_013', name: 'Hộp tai nghe', kind: 'circle', r: 25, box: [-25, -25, 25, 25],
    meta: M('Small', 'Oval', 'rolling', 2) },
  { id: 14, slug: 'charger', code: 'ITM_014', name: 'Củ sạc', kind: 'rect', w: 46, h: 48, chamfer: 9, box: [-23, -24, 23, 24],
    meta: M('Small', 'Rectangle', 'normal', 1) },

  // ---------- Food & Drink ----------
  { id: 15, slug: 'waterbottle', code: 'ITM_015', name: 'Bình nước', kind: 'rect', w: 32, h: 100, chamfer: 12, box: [-16, -64, 16, 50],
    extra: { kind: 'rect', w: 18, h: 18, dx: 0, dy: -57 },
    meta: M('Medium', 'Long', 'rolling', 2) },
  { id: 16, slug: 'sandwich', code: 'ITM_016', name: 'Hộp bánh mì kẹp', kind: 'poly', pts: [[-54, 30], [54, 30], [0, -46]], box: [-54, -46, 54, 30],
    meta: M('Medium', 'Triangle', 'normal', 2) },
  { id: 17, slug: 'apple', code: 'ITM_017', name: 'Quả táo', kind: 'circle', r: 27, box: [-27, -38, 27, 27],
    meta: M('Small', 'Circle', 'rolling', 2, true, false) },
  { id: 18, slug: 'banana', code: 'ITM_018', name: 'Quả chuối', kind: 'poly',
    pts: [[-36, -6], [-22, -18], [0, -22], [22, -14], [34, 4], [26, 14], [4, 6], [-18, 8], [-34, 6]], box: [-36, -22, 34, 14],
    meta: M('Small', 'Curved', 'rolling', 2, true, false) },
  { id: 19, slug: 'milk', code: 'ITM_019', name: 'Hộp sữa', kind: 'poly', pts: [[-22, -20], [22, -20], [22, 32], [-22, 32]],
    extra: { kind: 'poly', pts: [[-22, -20], [22, -20], [10, -34], [-10, -34]] }, box: [-22, -34, 22, 32],
    meta: M('Small', 'Rectangle', 'normal', 1) },
  { id: 20, slug: 'granola', code: 'ITM_020', name: 'Thanh ngũ cốc', kind: 'rect', w: 62, h: 36, chamfer: 6, box: [-31, -18, 31, 18],
    meta: M('Small', 'Rectangle', 'normal', 1) },

  // ---------- Accessories ----------
  { id: 21, slug: 'cap', code: 'ITM_021', name: 'Mũ lưỡi trai', kind: 'compound',
    parts: [{ kind: 'circle', r: 30, dx: -6, dy: -4 }, { kind: 'rect', w: 54, h: 16, dx: 32, dy: 18, chamfer: 8 }], box: [-38, -36, 62, 28],
    meta: M('Medium', 'Irregular', 'normal', 2, true, false) },
  { id: 22, slug: 'umbrella', code: 'ITM_022', name: 'Ô gấp', kind: 'rect', w: 30, h: 104, chamfer: 14, box: [-15, -52, 15, 70],
    extra: { kind: 'rect', w: 14, h: 22, dx: 0, dy: 60 },
    meta: M('Medium', 'Long', 'rolling', 2) },
  { id: 23, slug: 'keyring', code: 'ITM_023', name: 'Móc chìa khóa', kind: 'compound',
    parts: [{ kind: 'circle', r: 15, dx: -14, dy: 0 }, { kind: 'rect', w: 26, h: 12, dx: 12, dy: 6, chamfer: 5 }], box: [-31, -19, 27, 19],
    meta: M('Small', 'Irregular', 'normal', 1, true, false) },
  { id: 24, slug: 'studentcard', code: 'ITM_024', name: 'Thẻ học sinh', kind: 'rect', w: 62, h: 40, chamfer: 5, box: [-31, -20, 31, 20],
    meta: M('Small', 'Rectangle', 'normal', 1) },

  // ---------- Context Gear ----------
  { id: 25, slug: 'notebook', code: 'ITM_025', name: 'Vở ghi', kind: 'rect', w: 74, h: 68, chamfer: 3, box: [-37, -34, 37, 34],
    meta: M('Medium', 'Rectangle', 'normal', 1) },
  { id: 26, slug: 'textbook', code: 'ITM_026', name: 'Sách giáo khoa', kind: 'rect', w: 104, h: 86, chamfer: 3, box: [-52, -43, 52, 43],
    meta: M('Large', 'Rectangle', 'normal', 3, false, true) },
  { id: 27, slug: 'ruler', code: 'ITM_027', name: 'Thước kẻ', kind: 'rect', w: 18, h: 96, chamfer: 3, box: [-9, -48, 9, 48],
    meta: M('Small', 'Long', 'normal', 1) },
  { id: 28, slug: 'pencil', code: 'ITM_028', name: 'Bút chì', kind: 'poly', pts: [[-7, -40], [7, -40], [7, 32], [0, 46], [-7, 32]], box: [-7, -40, 7, 46],
    meta: M('Small', 'Long', 'rolling', 1) },
  { id: 29, slug: 'gluestick', code: 'ITM_029', name: 'Keo dán', kind: 'rect', w: 22, h: 70, chamfer: 8, box: [-11, -35, 11, 35],
    meta: M('Small', 'Long', 'rolling', 1) },
  { id: 30, slug: 'paintbox', code: 'ITM_030', name: 'Hộp màu nước', kind: 'rect', w: 96, h: 54, chamfer: 6, box: [-48, -27, 48, 27],
    meta: M('Medium', 'Rectangle', 'normal', 2) },

  // ================= Chương 2 · Weekend Trip =================
  // ---------- Clothing ----------
  { id: 31, slug: 'jacket', code: 'ITM_031', name: 'Áo khoác gấp', kind: 'rect', w: 108, h: 80, chamfer: 8, box: [-54, -40, 54, 40],
    meta: M('Large', 'Rectangle', 'normal', 3) },
  { id: 32, slug: 'pajamas', code: 'ITM_032', name: 'Bộ ngủ gấp', kind: 'rect', w: 82, h: 60, chamfer: 8, box: [-41, -30, 41, 30],
    meta: M('Medium', 'Rectangle', 'normal', 1) },

  // ---------- Personal Care ----------
  { id: 33, slug: 'toothbrush', code: 'ITM_033', name: 'Bàn chải', kind: 'rect', w: 16, h: 76, chamfer: 6, box: [-11, -38, 11, 38],
    meta: M('Small', 'Long', 'normal', 1) },
  { id: 34, slug: 'toothpaste', code: 'ITM_034', name: 'Kem đánh răng', kind: 'rect', w: 22, h: 66, chamfer: 7, box: [-11, -33, 11, 33],
    meta: M('Small', 'Long', 'normal', 1) },
  { id: 35, slug: 'shampoo', code: 'ITM_035', name: 'Chai dầu gội', kind: 'rect', w: 34, h: 64, chamfer: 12, box: [-17, -32, 17, 32],
    meta: M('Small', 'Rounded rect', 'normal', 1) },
  { id: 36, slug: 'hairbrush', code: 'ITM_036', name: 'Lược chải', kind: 'poly',
    pts: [[-14, -34], [14, -34], [18, -10], [14, 14], [6, 34], [-6, 34], [-14, 14], [-18, -10]], box: [-18, -34, 18, 34],
    meta: M('Medium', 'Irregular', 'normal', 2) },
  { id: 37, slug: 'deodorant', code: 'ITM_037', name: 'Lăn khử mùi', kind: 'rect', w: 30, h: 58, chamfer: 12, box: [-15, -29, 15, 29],
    meta: M('Small', 'Rounded rect', 'normal', 1) },

  // ---------- Electronics ----------
  { id: 38, slug: 'smartphone', code: 'ITM_038', name: 'Điện thoại', kind: 'rect', w: 38, h: 72, chamfer: 8, box: [-19, -36, 19, 36],
    meta: M('Small', 'Rectangle', 'vibrating', 2) },
  { id: 39, slug: 'camera', code: 'ITM_039', name: 'Máy ảnh nhỏ', kind: 'poly',
    pts: [[-34, -12], [-20, -24], [16, -24], [34, -12], [34, 20], [-34, 20]], box: [-34, -30, 34, 20],
    meta: M('Medium', 'Irregular', 'normal', 2) },
  { id: 40, slug: 'powerbank', code: 'ITM_040', name: 'Pin dự phòng', kind: 'rect', w: 44, h: 52, chamfer: 7, box: [-22, -26, 22, 26],
    meta: M('Small', 'Rectangle', 'normal', 1) },
  { id: 41, slug: 'cable', code: 'ITM_041', name: 'Dây sạc cuộn', kind: 'circle', r: 24, box: [-24, -24, 24, 24],
    meta: M('Small', 'Circle', 'rolling', 1) },

  // ---------- Food & Drink ----------
  { id: 42, slug: 'crackers', code: 'ITM_042', name: 'Gói bánh quy', kind: 'rect', w: 60, h: 40, chamfer: 6, box: [-30, -20, 30, 20],
    meta: M('Small', 'Rectangle', 'normal', 1) },
  { id: 43, slug: 'juice', code: 'ITM_043', name: 'Hộp nước ép', kind: 'rect', w: 36, h: 62, chamfer: 4, box: [-18, -31, 18, 36],
    meta: M('Small', 'Rectangle', 'normal', 1) },

  // ---------- Accessories ----------
  { id: 44, slug: 'sunglasses', code: 'ITM_044', name: 'Kính râm', kind: 'poly',
    pts: [[-38, -12], [38, -12], [38, 2], [22, 14], [8, 4], [-8, 4], [-22, 14], [-38, 2]], box: [-38, -14, 38, 14],
    meta: M('Small', 'Irregular', 'normal', 2, true, false) },
  { id: 45, slug: 'wallet', code: 'ITM_045', name: 'Ví tiền', kind: 'rect', w: 58, h: 42, chamfer: 6, box: [-29, -21, 29, 21],
    meta: M('Small', 'Rectangle', 'normal', 1) },
  { id: 46, slug: 'sleepmask', code: 'ITM_046', name: 'Bịt mắt ngủ', kind: 'poly',
    pts: [[-34, -12], [-14, -18], [14, -18], [34, -12], [34, 8], [14, 16], [-14, 16], [-34, 8]], box: [-34, -18, 34, 16],
    meta: M('Small', 'Curved', 'normal', 1) },
  { id: 47, slug: 'neckpillow', code: 'ITM_047', name: 'Gối cổ', kind: 'compound',
    parts: [{ kind: 'rect', w: 26, h: 62, dx: -30, dy: 4, chamfer: 12 },
            { kind: 'rect', w: 26, h: 62, dx: 30, dy: 4, chamfer: 12 },
            { kind: 'rect', w: 86, h: 30, dx: 0, dy: -20, chamfer: 14 }], box: [-43, -35, 43, 35],
    meta: M('Large', 'U-shape', 'normal', 3, true, false) },

  // ---------- Context Gear ----------
  { id: 48, slug: 'guidebook', code: 'ITM_048', name: 'Sách hướng dẫn', kind: 'rect', w: 64, h: 86, chamfer: 4, box: [-32, -43, 32, 43],
    meta: M('Medium', 'Rectangle', 'normal', 2) },
  { id: 49, slug: 'map', code: 'ITM_049', name: 'Bản đồ gấp', kind: 'rect', w: 62, h: 44, chamfer: 3, box: [-31, -22, 31, 22],
    meta: M('Small', 'Rectangle', 'normal', 1) },
  { id: 50, slug: 'ticket', code: 'ITM_050', name: 'Vé tàu xe', kind: 'rect', w: 56, h: 30, chamfer: 3, box: [-28, -15, 28, 15],
    meta: M('Small', 'Rectangle', 'normal', 1) },
  { id: 51, slug: 'cards', code: 'ITM_051', name: 'Bộ bài', kind: 'rect', w: 40, h: 56, chamfer: 4, box: [-20, -28, 20, 28],
    meta: M('Small', 'Rectangle', 'normal', 1) },
  { id: 52, slug: 'travelmug', code: 'ITM_052', name: 'Cốc giữ nhiệt', kind: 'poly',
    pts: [[-20, -36], [20, -36], [24, 0], [20, 36], [-20, 36], [-24, 0]], box: [-30, -36, 30, 36],
    meta: M('Medium', 'Irregular', 'normal', 2) },

  // ---------- Công cụ (không nằm trong sheet) ----------
  { id: 0, slug: 'key', code: null, name: 'Chìa khóa', kind: 'compound',
    parts: [{ kind: 'circle', r: 11, dx: -16, dy: 0 }, { kind: 'rect', w: 34, h: 8, dx: 8, dy: 0, chamfer: 3 }], box: [-29, -13, 27, 13],
    meta: M('Small', 'Irregular', 'normal', 0, false, false) },
];

/** Hộp đen thay cho món bị khóa cho tới khi mở */
export const MYSTERY = { id: -1, slug: 'mystery', code: null, name: 'Hộp bí ẩn', kind: 'rect', w: 62, h: 62, chamfer: 9, box: [-31, -31, 31, 31],
  meta: M('Medium', 'Rectangle', 'normal', 2, false, false) };

// Mỗi món có 3 cách gọi tên:
//   id   — SỐ, trùng số thứ tự trong sheet (ITM_017 → 17). Đây là khoá chính, dùng trong level JSON.
//   slug — chuỗi ngắn, chỉ dùng để tra hàm vẽ trong art/items.js cho dễ đọc code.
//   code — mã gốc trong sheet, để đối chiếu khi sheet thay đổi.
/**
 * Tra món theo mã. Hộp bí ẩn nằm ngoài ITEM_DEFS nhưng vẫn phải tìm ra được,
 * nếu không loader sẽ tưởng chưa có rồi tạo một bản trùng mã, và bản game dùng
 * lại là bản không có ảnh.
 */
export const defById = id => {
  const n = Number(id);
  return ITEM_DEFS.find(d => d.id === n) || (n === -1 ? MYSTERY : undefined);
};
export const defBySlug = slug => ITEM_DEFS.find(d => d.slug === slug);
export const defByCode = code => ITEM_DEFS.find(d => d.code === code);
/** Diện tích xấp xỉ theo khung vẽ — để so sánh món lớn / nhỏ trong booster */
export function areaOf(def) { const [x0, y0, x1, y1] = def.box; return (x1 - x0) * (y1 - y0); }
/** Nhãn hiển thị: "17 · Quả táo" */
export const labelOf = def => `${def.id} · ${def.name}`;

export const KEY_ID = 0;        // chìa khoá mở hộp bí ẩn
export const MYSTERY_ID = -1;
