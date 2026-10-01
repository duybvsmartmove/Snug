// Nội dung qua mạng cho app Android (Capacitor).
//
// Bản web đọc content/ ngay trên GitHub Pages, nên editor đổi bộ art hay sửa level là người chơi
// thấy liền. App Android thì mang theo một bản content/ đóng gói lúc build: không làm gì thêm thì
// app mãi chạy đúng bản lúc build. Ở đây, mỗi lần mở game, app hỏi GitHub Pages trước:
//   - lấy được config.json VÀ levels.json của bộ art trong đó → mọi nội dung (bộ art, level,
//     ảnh món, túi, nền) đọc từ GitHub Pages, y như bản web;
//   - không có mạng / chậm quá HAN_CHO / lỗi → dùng bản đóng gói trong APK, vẫn chơi được.
// Ảnh tải về được WebView giữ trong bộ nhớ đệm HTTP như trình duyệt (GitHub Pages: 10 phút rồi
// hỏi lại bằng ETag), nên mở lại game không phải tải lại từ đầu.
//
// Lưu ý: nội dung mới phải chạy được với CODE của bản app đang cài. Level dùng tính năng mới
// (kiểu vật lý mới, loại vật cản mới…) thì phải phát hành bản app mới cùng lúc.
import { setContentBase } from './loader.js';

export const NOI_DUNG_MANG = 'https://duybvsmartmove.github.io/Snug/content/';
const HAN_CHO = 3000;   // mili giây, cho cả hai lượt hỏi

const laAppNative = () => !!window.Capacitor?.isNativePlatform?.();

async function hoi(url, signal) {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/**
 * Gọi một lần lúc khởi động, TRƯỚC khi đọc config và level. Trả về 'mang' khi đã chuyển sang
 * nội dung trên GitHub Pages, 'goc' khi dùng bản đóng gói (hoặc không phải app native).
 */
export async function chonNguonNoiDung() {
  if (!laAppNative()) return 'goc';
  const ac = new AbortController();
  const han = setTimeout(() => ac.abort(), HAN_CHO);
  try {
    const cfg = await hoi(`${NOI_DUNG_MANG}config.json`, ac.signal);
    const art = cfg?.art === 'casual' ? 'casual' : 'cozy';
    // levels.json cũng phải về được: config về mà level lỗi thì thà dùng trọn bản đóng gói
    await hoi(`${NOI_DUNG_MANG}${art}/levels.json`, ac.signal);
    setContentBase(NOI_DUNG_MANG);
    console.info('[nội dung] dùng bản trên GitHub Pages, bộ art', art);
    return 'mang';
  } catch (e) {
    console.info('[nội dung] dùng bản đóng gói trong app:', e?.message || e);
    return 'goc';
  } finally {
    clearTimeout(han);
  }
}
