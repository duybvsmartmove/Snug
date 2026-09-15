// Món nào thuộc chương nào. Dùng chung cho Kho đồ ở tab dựng level và Danh sách đồ ở tab art.
//
//   own  món có ảnh nằm trong thư mục của chương
//   all  own cộng những món mà level trong chương đang dùng, kể cả món mượn từ chương khác
import { loadAssetIndex } from '../content/loader.js';

/** @returns {{all:Set<number>, own:Set<number>}} */
export async function chapterItemIds(E) {
  const all = new Set(), own = new Set();
  for (const it of E.level?.items || []) all.add(Number(it.id));
  for (const ids of E.levelItemIds?.values() || []) for (const id of ids) all.add(Number(id));
  try {
    const index = await loadAssetIndex(true);
    const folder = `assets/${String(E.map?.no || 1).padStart(2, '0')}-${E.mapId}/`;
    for (const [id, path] of Object.entries(index.items || {})) {
      if (!path.startsWith(folder)) continue;
      all.add(Number(id)); own.add(Number(id));
    }
  } catch {}
  return { all, own };
}

/** Sắp món riêng của chương lên trước, món mượn xuống sau */
export const byChapterFirst = own => (a, b) => (own.has(b.id) ? 1 : 0) - (own.has(a.id) ? 1 : 0);
