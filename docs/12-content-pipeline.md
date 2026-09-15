# Content pipeline: Editor sinh art + level → Game nhận

> **Lưu ý:** bản thiết kế ban đầu. Cách làm thực tế đã khác và đơn giản hơn nhiều:
> game và editor chung một repo, nội dung nằm trong `public/content`, xem README.


## 1. Hợp đồng chung: Content Pack
Editor và game không nói chuyện trực tiếp. Cả hai đọc/ghi cùng một cấu trúc thư mục gọi là **content pack**:

```
content/
  pack.json                     # version, danh sách map, hash để biết có gì mới
  maps/pack-and-go/
    map.json                    # tên map, thứ tự level, background mặc định, reward cuối map
    levels/m1-l01.json … m1-l10.json
  assets/
    items/hoodie.png + hoodie.json          # ảnh + manifest (collider, meta)
    containers/suitcase_m_back.png, _front.png, suitcase_m.json
    backgrounds/bedroom_day/*.png + bedroom_day.json
```
Game chỉ cần `pack.json` là biết tải gì. Editor chỉ cần ghi đúng cấu trúc này. Thêm map, đổi art, sửa level đều là thay đổi trong `content/`, code game không đổi.

## 2. Luồng trong Editor (một chỗ làm cả art và level)

```
[Tab Assets]
  Cách A: kéo PNG có sẵn vào
  Cách B: nhập prompt → gọi API gen ảnh → nhận PNG
      ↓
  Remove background (API hoặc ngưỡng alpha)
      ↓
  Auto-trace collider từ alpha → simplify → tách đa giác lồi
      ↓
  Chỉnh: scale theo bảng kích thước, pivot, kéo đỉnh collider, đặt id + metadata (size, physics, canLink…)
      ↓
  Save → content/assets/items/<id>.png + <id>.json     ← món mới xuất hiện ngay trong palette

[Tab Container]  chọn ảnh túi (hoặc gen) → tách back/front → kéo polygon lòng túi → shape presets → Save

[Tab Level]      chọn container + shape, thả item từ palette, gắn mechanic, timer, reward
                 hoặc Generate theo template + seed → Bake
      ↓
  Playtest ngay trong editor (chạy engine thật)
      ↓
  Save → content/maps/<map>/levels/<id>.json + cập nhật map.json + pack.json (version+1)
```
Vì editor nhúng chính engine game (cùng code `src/game`), cái bạn thấy khi Playtest chính là cái người chơi sẽ thấy. Không có bước "convert".

## 3. Luồng trong Game
```
Khởi động → tải pack.json → so version với bản đã cache
   → tải map.json của map đang chơi
   → vào level: tải level JSON + chỉ những asset level đó cần (item, container, background)
   → dựng vật lý từ collider trong manifest, dựng lòng túi từ polygon
   → render sprite; item nào chưa có ảnh thì fallback vector
```
Loader là một module duy nhất `src/content/loader.js`, cache theo hash, có màn loading ngắn.

## 4. Editor ghi file bằng cách nào
| Môi trường | Cách ghi | Game nhận |
|---|---|---|
| **Dev (máy GD)** | Vite plugin mở endpoint `POST /__content/save` ghi thẳng vào `content/` trong repo | Vite hot-reload, refresh là thấy |
| **Team, không chạy dev server** | Nút Export → tải `.zip` content pack; hoặc Save lên một server nhỏ (S3/Firebase Storage) | Game tải `pack.json` từ URL đó |
| **Production / live ops** | Editor publish pack lên CDN với version mới | Game so version khi mở app, tải pack mới về, không cần cập nhật app |

Bản nháp luôn tự lưu localStorage của editor để không mất khi đóng tab.

## 5. Gen art bằng AI ngay trong editor
- Editor gọi API gen ảnh (bất kỳ: OpenAI Images, Stability, Ideogram, hoặc model nội bộ) qua một endpoint proxy trên dev server để không lộ API key ra trình duyệt.
- **Prompt template** cố định để giữ style: `flat lay top-down view of a {item}, bold dark outline, saturated colors, cozy stylized casual game asset, plain white background, no shadow, centered`. GD chỉ điền `{item}`.
- Sau khi gen: remove bg (rembg / API), auto-collider, hiện preview **ngay trong túi ở level đang mở** để so tỉ lệ với các món khác, có thanh scale để cân.
- Giữ lại prompt + seed trong manifest (`"gen": {prompt, seed, model}`) để gen lại biến thể cùng style.
- Túi và nền gen theo cách tương tự; túi thì gen thêm lệnh "open empty suitcase, top view" rồi tách back/front bằng mask lòng túi ngay trong editor.

## 6. Kiểm tra tự động khi Save (để game không vỡ)
- Level: mọi item id có trong assets; density trong khoảng tier; solver ra Solvable; chìa khóa nằm trong lòng túi nếu có locked; link chỉ trỏ đến item tồn tại.
- Asset: có collider, area > 0, ảnh không quá 512 px cạnh dài, id không trùng.
- Sai thì báo đỏ ở panel, không cho Save.

## 7. Việc cần làm (bổ sung vào kế hoạch)
1. Định nghĩa schema JSON cho pack / map / level / item / container / background (kèm validator).
2. `src/content/loader.js` + cache + preload theo level.
3. Vite plugin `content-save` (dev) + Export zip.
4. Editor Tab Assets với import PNG, auto-collider; API gen ảnh nối sau khi chọn nhà cung cấp.
5. Chuyển 2 level hiện tại sang content pack đầu tiên để làm mẫu.
