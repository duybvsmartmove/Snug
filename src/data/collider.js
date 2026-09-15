// Áp vùng va chạm từ manifest vào định nghĩa món.
// Tách riêng vì hai bên cùng cần: game chạy trong trình duyệt (qua content/loader.js)
// và các công cụ chạy bằng Node (check_levels, build_levels). Trước đây chỉ game áp,
// nên bảng kiểm tra độ khó vẫn đo bằng hình viết tay cũ trong khi người chơi gặp hình mới.
export function applyCollider(def, c) {
  if (!c) return def;
  if (c.kind === 'circle') {
    Object.assign(def, { kind: 'circle', r: c.r, box: [-c.r, -c.r, c.r, c.r] });
    delete def.parts; delete def.extra;
  } else if (c.kind === 'rect') {
    Object.assign(def, { kind: 'rect', w: c.w, h: c.h, chamfer: c.chamfer || 0,
      box: [-c.w / 2, -c.h / 2, c.w / 2, c.h / 2] });
    delete def.parts; delete def.extra;
  } else if (c.kind === 'poly') {
    const xs = c.pts.map(p => p[0]), ys = c.pts.map(p => p[1]);
    Object.assign(def, { kind: 'poly', pts: c.pts,
      box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
    delete def.parts; delete def.extra;
  }
  return def;
}
