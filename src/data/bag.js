// Túi dáng cố định: hình lòng túi đi theo ảnh (manifest túi có `fixed` + `inner`), level chỉ
// chọn cỡ (container.scale) và đặt vật cản. Level vẫn ghi kèm `shape` đã tính sẵn để công cụ
// chạy bằng Node (máy xếp, bảng độ khó) đọc thẳng, nhưng lúc chơi luôn tính lại từ ảnh túi:
// vẽ lại túi là hình lòng túi của mọi level đổi theo, không để sót level nào còn hình cũ.

/** Lòng túi của một túi dáng cố định ở cỡ scale, toạ độ level (gốc giữa đáy) */
export const fixedShape = (skin, scale = 1) =>
  skin.inner.map(([x, y]) => [Math.round(x * scale * 10) / 10, Math.round(y * scale * 10) / 10]);

export const isFixedSkin = skin => !!(skin?.fixed && skin.inner?.length >= 3);

/** container của level → container để dựng: túi dáng cố định thì hình lấy từ ảnh túi */
export function resolveContainer(c, skins) {
  const skin = skins?.[c?.skin];
  if (!isFixedSkin(skin)) return c;
  const s = c.scale || 1;
  // chỗ đặt túi cũng tính lúc chạy: đổi mốc BAG_FLOOR là mọi level dời theo, không phải dựng lại
  return { ...c, scale: s, bottom: +(BAG_FLOOR - (skin.image.y + skin.image.h) * s).toFixed(1), shape: fixedShape(skin, s), closed: true };
}

// Chỗ đặt túi trên màn: đáy ẢNH túi luôn ngay trên mép bàn (TABLE_Y 452), túi to thì nhô lên
// phía trên, không được cao quá dòng BAG_CEIL (vùng đồng hồ và số món).
export const BAG_FLOOR = 436, BAG_CEIL = 150;
/** Cỡ túi lớn nhất cho chỉnh trong editor và Creative. Trước đây kẹp theo chỗ trống giữa
 *  đồng hồ và mép bàn (thường ~100%); người thiết kế cần phóng tới 200%, túi to quá thì nhô
 *  lên sau HUD hay tràn hai mép màn, tự canh bằng mắt. */
export const MAX_SCALE = 2;
export const maxScale = () => MAX_SCALE;
/** Cỡ lớn nhất túi còn nằm gọn giữa đồng hồ và mép bàn, không tràn hai mép màn (để tham khảo) */
export const BAG_MAX_W = 408;
export const vuaManHinh = skin => Math.min((BAG_FLOOR - BAG_CEIL) / skin.image.h, BAG_MAX_W / skin.image.w);
export const MIN_SCALE = .5;

/**
 * Đặt túi dáng cố định về cỡ s: hình lòng túi tính lại từ ảnh, vật cản phóng cùng tỉ lệ
 * (giữ nguyên chỗ tương đối trong túi), đáy ảnh túi neo trên mép bàn.
 */
export function placeFixed(c, skin, s) {
  s = +s.toFixed(3);   // cỡ lưu 3 chữ số; hình và chỗ đặt tính theo đúng số đã lưu
  const cu = c.scale || s, k = s / cu;
  return {
    ...c, skin: c.skin, cx: c.cx ?? 210, scale: s,
    bottom: +(BAG_FLOOR - (skin.image.y + skin.image.h) * s).toFixed(1),
    shape: fixedShape(skin, s),
    blocks: (c.blocks || []).map(b => ({ ...b, x: Math.round(b.x * k), y: Math.round(b.y * k), w: Math.round(b.w * k), h: Math.round(b.h * k) })),
  };
}
