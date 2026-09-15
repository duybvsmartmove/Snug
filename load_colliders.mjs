// Nạp vùng va chạm từ manifest vào ITEM_DEFS khi chạy bằng Node.
// Các công cụ thiết kế phải gọi cái này trước khi đo, nếu không chúng vẫn đo bằng
// hình viết tay cũ còn người chơi thì gặp hình sinh từ ảnh.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEM_DEFS, defById } from './src/data/items.js';
import { applyCollider } from './src/data/collider.js';

const CONTENT = resolve(dirname(fileURLToPath(import.meta.url)), 'public/content');

export function napCollider() {
  const index = JSON.parse(readFileSync(resolve(CONTENT, 'assets/index.json'), 'utf8'));
  let n = 0;
  for (const [id, duong] of Object.entries(index.items || {})) {
    let man;
    try { man = JSON.parse(readFileSync(resolve(CONTENT, duong), 'utf8')); } catch { continue; }
    if (!man.collider) continue;
    let def = defById(Number(id));
    if (!def) {
      def = { id: Number(id), slug: man.slug || `item${id}`, name: man.name || `Món ${id}`,
              kind: 'rect', w: 40, h: 40, box: [-20, -20, 20, 20],
              meta: { size: 'Medium', shape: 'Rectangle', physics: 'normal', cost: 1, canLink: true, canLock: true } };
      ITEM_DEFS.push(def);
    }
    if (man.meta) def.meta = { ...def.meta, ...man.meta };
    applyCollider(def, man.collider);
    n++;
  }
  return n;
}
