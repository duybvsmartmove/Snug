// Bối cảnh: toàn bộ là ảnh nạp từ content pack, không còn hàm vẽ nền nào.
// Mỗi bối cảnh là một hoặc nhiều lớp ảnh xếp chồng, khai báo trong assets/backgrounds/<id>.json.
import { ctx } from '../game/canvas.js';
import { S, W, H } from '../game/state.js';
import { IMAGE_SCENES } from './scene-registry.js';

export function drawScene() {
  const id = Number(S.LEVEL?.background ?? 1);
  const def = IMAGE_SCENES[id] || IMAGE_SCENES[Object.keys(IMAGE_SCENES)[0]];
  if (!def) { ctx.fillStyle = '#F2EAD2'; ctx.fillRect(0, 0, W, H); return; }

  ctx.fillStyle = def.fill || '#F2EAD2';
  ctx.fillRect(0, 0, W, H);
  for (const layer of def.layers || []) {
    if (!layer.img?.complete || !layer.img.naturalWidth) continue;
    ctx.save();
    if (layer.opacity != null) ctx.globalAlpha = layer.opacity;
    const w = layer.w ?? W, h = layer.h ?? (layer.img.height * (w / layer.img.width));
    ctx.drawImage(layer.img, layer.x ?? 0, layer.y ?? 0, w, h);
    ctx.restore();
  }
}
