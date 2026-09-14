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
export const defById = id => ITEM_DEFS.find(d => d.id === Number(id));
export const defBySlug = slug => ITEM_DEFS.find(d => d.slug === slug);
export const defByCode = code => ITEM_DEFS.find(d => d.code === code);
/** Diện tích xấp xỉ theo khung vẽ — để so sánh món lớn / nhỏ trong booster */
export function areaOf(def) { const [x0, y0, x1, y1] = def.box; return (x1 - x0) * (y1 - y0); }
/** Nhãn hiển thị: "17 · Quả táo" */
export const labelOf = def => `${def.id} · ${def.name}`;

export const KEY_ID = 0;        // chìa khoá mở hộp bí ẩn
export const MYSTERY_ID = -1;
