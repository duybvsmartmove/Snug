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

## 6. Đã làm được tới đâu

Giai đoạn 1 và giai đoạn 3 đã dựng xong và chạy được, **chưa cần backend nào**.
Giai đoạn 2 (đưa lên dịch vụ thật) là phần còn lại.

### Thư mục content giờ có ba tầng

```
public/content/
  draft/            ← editor ghi vào đây. Người chơi KHÔNG thấy.
  v1/ v2/ v3/       ← bản đã phát hành, chỉ chứa JSON, không bao giờ sửa lại
  assets/           ← ảnh, tên gắn hash nội dung, dùng chung mọi bản
  live.json         ← con trỏ: {"version": 3}
```

### Phát hành

`tools/publish.mjs` đóng gói draft thành một bản mới:

```bash
node tools/publish.mjs status              # xem bản đang phát hành
node tools/publish.mjs publish "ghi chú"   # phát hành bản mới
node tools/publish.mjs rollback 2          # quay lui
```

Editor có nút **Phát hành** ở thanh trên gọi đúng hàm này qua server dev, kèm nhãn hiện
bản đang live.

Ảnh được đặt tên theo hash nội dung rồi để ngoài thư mục bản, nên hai bản dùng chung một
ảnh không tốn thêm chỗ, và ảnh cache được vĩnh viễn. Đường dẫn ảnh trong JSON được viết lại
tự động lúc phát hành, người dựng level không phải quan tâm.

### Game nhận thay đổi

`src/content/sync.js` chạy lúc khởi động: tải `live.json`, so với bản đang giữ ở máy, khác
thì tải `v<N>/index.json` rồi **chỉ tải những file có hash khác**. File không đổi được chuyển
thẳng từ bản cũ sang, không tốn một byte mạng nào.

`src/content/store.js` giữ kho: JSON trong IndexedDB, ảnh trong Cache Storage, số hiệu bản
trong localStorage. Chặn hết thì tự lùi về bộ nhớ tạm trong RAM, game vẫn chạy.

Đã đo thực tế: đổi thời gian một level rồi phát hành, lần mở game sau tải đúng ba file
(`live.json`, `index.json`, và một file level), 12 file còn lại lấy từ kho.

### Khung xem thử của editor

Đọc thẳng bản nháp (`?preview=1` → `useDraft()`), nên sửa xong thấy ngay, không phải phát hành.
Chơi thật thì đọc bản đã phát hành.

## 7. Còn lại phải làm

**Giai đoạn 2 — đưa content lên dịch vụ thật.** Hiện `publish` ghi ra thư mục trên đĩa và
server dev của editor phục vụ nó. Bản deploy lên web chưa có chỗ nào để ghi. Cần:

1. Tạo bucket (Supabase Storage hoặc tương đương), bật đọc công khai
2. Viết driver thay `writeFile` trong `tools/publish.mjs` thành upload
3. Game gọi `initContent('https://<cdn>/content/')` thay vì `'./content/'` — đúng một dòng
4. Đăng nhập cho editor, chỉ người trong team mới bấm Phát hành được

**Giai đoạn 4 — mobile.** Đóng gói Capacitor. Ba API lưu trữ ở trên chạy nguyên trong WebView.
Thêm: kiểm tra bản mới khi app quay lại foreground, và chỉ tải ảnh nặng khi đang dùng wifi.

**Chưa làm: tải trước chương sau.** Mới có một chương nên chưa cần. Khi có chương 2, thêm vào
`sync.js` một hàm chạy lúc máy rảnh, tải `v<N>/maps/<chương kế tiếp>/` vào kho.
