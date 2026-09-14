// Danh mục bối cảnh. Tách riêng khỏi scenes.js để editor dùng được mà không cần canvas của game.
// scenes.js (có canvas) đăng ký hàm vẽ vào đây; loader đăng ký nền dạng ảnh.

// Bối cảnh cũng mang mã SỐ như món đồ, để level JSON chỉ chứa số.
// Mã 1–9 dành cho nền vẽ bằng code, từ 10 trở lên là nền dạng ảnh do người dùng thêm.

/** Nền vẽ bằng code: id (số) → { name, draw } */
export const SCENES = {};
export function registerScene(id, name, draw) { SCENES[Number(id)] = { id: Number(id), name, draw }; }

/** Nền dạng ảnh nạp từ content pack: id (số) → { name, fill, layers } */
export const IMAGE_SCENES = {};
export function registerImageScene(id, def) { IMAGE_SCENES[Number(id)] = { ...def, id: Number(id) }; }

/** Danh sách cho ô chọn trong editor, sắp theo mã */
export function sceneOptions() {
  return [
    ...Object.values(SCENES).map(s => ({ id: s.id, name: `${s.id} · ${s.name}`, drawn: true })),
    ...Object.values(IMAGE_SCENES).map(s => ({ id: s.id, name: `${s.id} · ${s.name || 'Nền ' + s.id}`, drawn: false })),
  ].sort((a, b) => a.id - b.id);
}

/** Mã số chưa dùng, gợi ý cho nền mới */
export function nextSceneId() {
  const used = new Set([...Object.keys(SCENES), ...Object.keys(IMAGE_SCENES)].map(Number));
  let n = 10; while (used.has(n)) n++;   // nền ảnh bắt đầu từ 10
  return n;
}

/** Danh mục kiểu túi, dùng chung cho game và editor */
export const BAG_KINDS = [
  { id: 'lunchbox', name: 'Hộp cơm' },
  { id: 'tote', name: 'Túi tote' },
  { id: 'backpack', name: 'Ba lô' },
];
