// Bộ art các công cụ Node đang làm việc: thêm --art casual (mặc định cozy).
// Mỗi bộ là một thư mục gốc riêng trong public/content, có levels.json và assets/ của nó.
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.findIndex(a => a === '--art' || a.startsWith('--art='));
export const ART = i < 0 ? 'cozy' : (process.argv[i].split('=')[1] || process.argv[i + 1]);
if (!['cozy', 'casual'].includes(ART)) { console.error(`Không có bộ art "${ART}". Có: cozy, casual`); process.exit(1); }
/** Thư mục gốc của bộ art: public/content/<art> */
export const CONTENT = resolve(ROOT, 'public/content', ART);
/** Tham số dòng lệnh đã bỏ phần --art */
export const ARGS = process.argv.slice(2).filter((a, k, all) => !(a === '--art' || a.startsWith('--art=') || (all[k - 1] === '--art')));
