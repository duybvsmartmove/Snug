// Tấm màn chuyển cảnh.
//
// Đổi màn mà không che thì người chơi nhìn thấy đúng cái quá trình dựng: trang chủ mờ đi
// trong khi level còn đang lắp, HUD hiện trước, đồ rơi vào sau, ảnh về sau nữa. Che kín
// một nhịp rồi mới mở ra, người chơi chỉ thấy hai cảnh hoàn chỉnh nối nhau.
//
// Cùng tấm này lo cả lúc mở app (index.html cho nó sẵn class "boot" nên nó đã che từ khung
// hình đầu tiên, trước khi bất kỳ dòng JS nào chạy).
const el = document.getElementById('veil');

// Khớp với hai transition khai trong index.html. Lệch số ở đây là màn mở sớm hơn lúc nó
// thực sự trong suốt, hoặc treo thêm một nhịp thừa.
const KEO_VAO = 190, MO_RA = 300;

const doi = ms => new Promise(r => setTimeout(r, ms));
const haiKhungHinh = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

/** Kéo màn che kín. Trả về khi màn đã đục hẳn. */
export async function keoMan() {
  if (!el) return;
  el.classList.remove('off');
  await doi(KEO_VAO);
}

/**
 * Mở màn ra. Chờ hai khung hình trước đã: cảnh mới vừa dựng xong trong bộ nhớ thôi,
 * chưa chắc đã vẽ ra màn hình. Mở sớm một khung là lộ đúng cái nhấp nháy cần giấu.
 */
export async function moMan() {
  if (!el) return;
  await haiKhungHinh();
  el.classList.remove('boot');
  el.classList.add('off');
  await doi(MO_RA);
}

/** Che màn → làm việc → mở màn. Việc có hỏng thì màn vẫn phải mở, không bỏ ai kẹt sau nó. */
export async function chuyenMan(viec) {
  await keoMan();
  try {
    return await viec();
  } finally {
    await moMan();
  }
}
