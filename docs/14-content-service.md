# Đưa thay đổi từ Level Editor sang game

Trả lời cho câu hỏi: editor sửa xong, bấm Publish, làm sao bên game nhận được — cả trên web
lẫn sau này khi đóng gói thành app mobile.

## 1. Điều quan trọng nhất: content là thứ thứ ba

Sau khi tách repo, dễ nghĩ là có hai phần: game và editor. Thực ra có **ba**:

| Phần | Là gì | Ai đổi | Đổi lúc nào |
|---|---|---|---|
| Game client | mã chơi game | lập trình viên | mỗi lần deploy |
| Level Editor | mã dựng level | lập trình viên | mỗi lần deploy |
| **Content** | chương, level, ảnh item, ảnh túi, nền | **designer** | **mỗi ngày** |

Hiện tại content đang nằm trong `snug/public/content`, tức là nằm trong bản build của game.
Sửa một con số trong level cũng phải build lại và deploy lại cả game. Đó chính là lý do
"bấm Publish bên editor thì bên game nhận được" chưa chạy được.

Content phải **ra khỏi cả hai repo**, sang một chỗ thứ ba mà cả hai cùng trỏ vào.
Mọi thứ còn lại trong tài liệu này là chi tiết của việc đó.

## 2. Ý tưởng của bạn — đúng chỗ nào, cần sửa chỗ nào

Bạn đề xuất: chương 1 gắn thẳng vào bản build; khi chơi chương 1 thì tải trước chương 2 rồi
lưu lại; mỗi lần mở lại game thì kiểm tra có thay đổi không, có thì tải lại; ảnh thì để dạng
link, tự tải về.

Khung này **đúng**. Đây đúng là cách các game live-content vẫn làm. Bốn điểm cần siết lại:

**a. Đừng dùng localStorage để chứa content.**
localStorage chỉ khoảng 5MB, chỉ chứa chuỗi, và **đồng bộ** — đọc ghi là đứng hình giao diện.
Ảnh item mà nhét vào đây thì phải mã hoá base64, phình thêm 33%, vài chục món là hết chỗ.
Dùng đúng công cụ:

| Loại dữ liệu | Chỗ lưu | Vì sao |
|---|---|---|
| JSON level, map, manifest | IndexedDB | không giới hạn 5MB, bất đồng bộ |
| Ảnh item, túi, nền | Cache Storage API | sinh ra để lưu nguyên response ảnh |
| Số hiệu bản content đang dùng | localStorage | vài byte, cần đọc nhanh lúc khởi động |

Cả ba API này chạy nguyên si trong WebView của Capacitor, nên lên mobile không phải viết lại.

**b. Đừng hỏi "có thay đổi không" bằng cách tải lại cả chương.**
Tải một file con trỏ vài chục byte thôi. Chỉ khi số hiệu bản khác mới tải manifest, rồi
so hash từng file để biết đúng file nào đổi. Sửa một level thì chỉ tải về một file đó.

**c. Ảnh phải có hash trong tên file.**
Code hiện tại đang gắn `?v=${Date.now()}` vào mọi URL ảnh, nghĩa là **ảnh không bao giờ được
cache** — mở game lần nào cũng tải lại toàn bộ art. Đổi sang tên file có hash
(`17.a3f9c1.png`) thì ảnh cache được vĩnh viễn, mà đổi ảnh vẫn ăn ngay vì tên file đổi theo.
Đây là thứ đáng sửa sớm nhất, không liên quan gì tới backend.

**d. Phải tách bản nháp và bản phát hành.**
Đây là thứ ý tưởng ban đầu còn thiếu, và là thứ dễ gây tai nạn nhất. Nếu editor ghi thẳng
vào chỗ game đọc, thì mỗi lần designer kéo thử một món là người chơi thật lãnh đủ, kể cả khi
level đang dở dang. Editor lưu vào **nháp**, bấm Publish mới đẩy sang **bản phát hành**.

## 3. Thiết kế đề nghị

### Cách sắp xếp trên server

```
live.json                          ← con trỏ: {"version": 27}
v27/index.json                     ← manifest: mọi file + hash + kích thước
v27/pack.json
v27/maps/school-day/map.json
v27/maps/school-day/levels/sd-01.json
...
assets/items/17.a3f9c1.png         ← tên có hash, nội dung không bao giờ đổi
assets/bg/1.77b204.webp
```

Hai quy tắc làm nên toàn bộ hệ thống:

**Publish là nguyên tử.** Ghi xong toàn bộ cây `v28/` rồi mới ghi đè `live.json` thành 28.
Thao tác cuối cùng chỉ là một file vài chục byte. Người chơi không bao giờ gặp trạng thái
nửa cũ nửa mới. Publish hỏng giữa chừng thì `live.json` vẫn trỏ 27, không ai thấy gì.

**Rollback là đổi một số.** Bản 28 lỗi thì sửa `live.json` về 27. Xong. Không cần build,
không cần deploy, không cần ai chờ.

### Lúc game khởi động

```
1. Dựng màn hình từ cache có sẵn        → game mở tức thì, không chờ mạng
2. Tải live.json                        → ~30 byte
3. version mới hơn?  không → dừng ở đây
4. Tải index.json bản mới, so hash
5. Chỉ tải những file thật sự khác
6. Ghi vào cache, đổi con trỏ cục bộ
7. Áp dụng: đang ở màn chọn level thì nạp lại ngay;
   đang chơi dở thì đợi hết màn rồi mới đổi
```

Bước 1 đứng trước bước 2 là điều quan trọng: game **không bao giờ đứng chờ mạng**. Mất mạng
thì chơi bản cache, có mạng thì âm thầm cập nhật nền. Bước 7 tránh cảnh level đang chơi tự
đổi hình giữa chừng.

### Chương 1 đóng gói sẵn

Giữ đúng như bạn nghĩ. Chương 1 nằm trong bản build (`public/content` hiện tại, gọi là seed).
Mở game lần đầu không cần mạng, không phải chờ tải. Seed cũng có số hiệu version; server cao
hơn thì cập nhật như bình thường.

### Tải trước chương sau

Cũng giữ, nhưng **để manifest quyết định, đừng viết cứng "chương 2"**. Quy tắc: khi người
chơi vào chương N, lặng lẽ tải chương N+1 lúc máy rảnh (`requestIdleCallback`). Như vậy thêm
chương 3, 4 về sau không phải sửa code.

## 4. Chọn backend

| Cách | Được | Mất |
|---|---|---|
| **Supabase** | Postgres + Storage + Auth + CDN trong một gói, free tier rộng, publish tức thì | thêm một dịch vụ phải trông |
| Firebase | tương đương, SDK mobile quen tay hơn | dính vendor chặt hơn |
| Cloudflare R2 + Workers | rẻ nhất khi đông người, edge nhanh | phải tự viết API |
| GitHub làm CMS | miễn phí, có sẵn lịch sử và revert bằng git | publish chậm cỡ một phút, cần token, designer không rành git sẽ khổ |

**Đề nghị Supabase**, vì nó cho đủ ba thứ đang cần trong một lần dựng:

- **Storage bucket `content`** — chứa JSON và ảnh, đọc công khai, có CDN sẵn
- **Bảng `releases(version, author, created_at, note)`** — lịch sử phát hành, để rollback
- **Auth** — chỉ tài khoản có trong bảng `editors` mới ghi được

Người chơi đọc thẳng từ CDN, không cần đăng nhập, không tốn lượt gọi API.

### Về chuyện "ai vào cũng sửa được"

Bạn nói muốn bất kỳ ai vào cũng chơi được và chỉnh được level. Hai vế này nên tách:

- **Chơi**: mở cho tất cả, không cần đăng nhập.
- **Chỉnh**: cần đăng nhập. Editor không khoá thì một người nghịch là mất sạch level của cả team,
  và không có cách nào biết ai làm.

Nếu vẫn muốn cho người lạ nghịch thử, cách an toàn là cho họ dựng level trong **không gian nháp
riêng** của chính họ, chỉ người trong team mới bấm Publish được. Vừa mở, vừa không mất gì.

## 5. Làm theo thứ tự nào

**Giai đoạn 1 — dọn trước, chưa cần backend.** Làm được ngay, không phụ thuộc ai.
Bỏ `?v=Date.now()`, đổi sang tên file có hash. Gom mọi đường dẫn content về một chỗ
(`setContentBase()` đã có sẵn trong `src/content/loader.js`). Sinh `index.json` có hash lúc build.

**Giai đoạn 2 — dựng content service.** Tạo bucket Supabase, chuyển `public/content` lên đó,
game đọc từ CDN với cơ chế cache ở mục 3. Editor ghi lên bucket thay vì ghi file qua server dev.

**Giai đoạn 3 — nháp và Publish.** Editor lưu nháp liên tục vào `draft/`. Nút Publish đóng gói
`draft/` thành `v<N>/` rồi đổi `live.json`. Thêm màn hình lịch sử phát hành để rollback.

**Giai đoạn 4 — mobile.** Đóng gói bằng Capacitor. Ba API lưu trữ ở mục 2a chạy nguyên trong
WebView, nên phần cập nhật content không phải viết lại. Chỉ cần thêm: kiểm tra version khi app
quay lại foreground, và chỉ tải art nặng khi đang dùng wifi.

## 6. Trạng thái hiện tại

Sau khi tách repo, hai bên đang nối với nhau như sau khi chạy dev:

```
snug_level_editor  (cổng 5174)          snug  (cổng 5173)
  vite dev server                         vite dev server
  ├─ GET  /content/*   ─────┐             └─ GET /content/*  ─┐
  └─ POST /__content/save ──┤                                 │
                            └──→  snug/public/content  ←──────┘
```

Server dev của editor đọc và ghi thẳng vào thư mục content của game, nên mở hai server cạnh
nhau là làm việc được như trước khi tách. Đổi chỗ khác bằng biến `SNUG_CONTENT_DIR`.

Cách nối này **chỉ dùng được lúc dev**. Bản editor deploy lên web sẽ không có thư mục nào để ghi
— đó đúng là chỗ giai đoạn 2 lấp vào.
