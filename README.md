# Everything Fits — game client

Cozy packing puzzle cho mobile web, chuyển thể từ [Snug](https://cookiecrayon.itch.io/snug),
xây theo GDD của Smartmove (bản chép trong `docs/`).

Stack: **Vite + ES modules + Matter.js**, Canvas 2D, không framework UI.

Repo này còn là **lõi dùng chung**: Level Editor nằm ở
[SnugLevelEditor](https://github.com/duybvsmartmove/SnugLevelEditor) và nhập các module
trong `src/` của repo này qua gói npm `snug`.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run preview
```

`npm run dev` có `--host` nên mở được trên điện thoại cùng wifi. Chơi ở màn hình dọc.

## Game

| Hành động | Cách làm |
|---|---|
| Nhặt / đặt đồ | Chạm giữ và kéo, thả ngón để đặt |
| Xoay | Chạm vào món để chọn, biểu tượng xoay hiện ở góc món, mỗi lần bấm xoay 90° |
| Booster | Lắc túi · Thu nhỏ 20% · Bỏ đi, mỗi loại có số lượt hiện trên badge |
| Tạm dừng / đổi level | Nút góc phải trên |

Luật theo GDD: vừa chỗ thì viền xanh, không vừa thì viền đỏ và rung, thả ra là bật ngược ra ngoài túi.
Hết giờ là thua, có thể dùng Extra Time. Hộp bí ẩn mở bằng cách kéo chạm chìa khoá đặt sẵn trong túi.

## Content pack

Level và art là dữ liệu, không phải code. Thư mục content có ba tầng:

```
public/content/
  draft/                           ← editor ghi vào đây, người chơi chưa thấy
    pack.json                      version + danh sách chương
    maps/school-day/map.json       thứ tự level trong chương
    maps/school-day/levels/*.json  từng level
    assets/items/<id>.json         manifest: sprite + collider + metadata
  v1/ v2/ v3/                      bản đã phát hành, chỉ JSON, không sửa lại
  assets/                          ảnh, tên gắn hash nội dung, dùng chung mọi bản
  live.json                        con trỏ: bản nào đang phát hành
```

Sửa level xong là ghi vào `draft/`, người chơi chưa thấy gì. **Phát hành** mới đóng gói
`draft/` thành `v<N>/` rồi đổi `live.json`. Bước đổi con trỏ là bước cuối cùng nên người chơi
không bao giờ gặp trạng thái nửa cũ nửa mới.

```bash
node tools/publish.mjs status              # xem bản đang phát hành
node tools/publish.mjs publish "ghi chú"   # phát hành bản mới
node tools/publish.mjs rollback 2          # quay lui, đổi một con số là xong
```

Editor có nút **Phát hành** ở thanh trên làm đúng việc này.

Lúc khởi động, game tải `live.json`, so với bản đang giữ ở máy, chỉ tải những file có hash
khác. JSON lưu ở IndexedDB, ảnh ở Cache Storage, nên mất mạng vẫn chơi được bản đã tải.
Chi tiết và kế hoạch đưa lên dịch vụ thật: `docs/14-content-service.md`.

## Art

**Toàn bộ phần nhìn là sprite.** Không còn hàm vẽ hình nào trong đường chạy của game:
món, bối cảnh và túi đều là ảnh nạp từ content pack. Nhờ vậy art dùng lại được cho Unity.

Art là **PNG**, dùng chung được cho cả web lẫn Unity. Tổng 44 ảnh, khoảng 4,5 MB.

### Art xếp theo chương

```
public/content/draft/assets/
  index.json                  mục lục: mã số → đường dẫn file mô tả
  01-school-day/
    items/        17.png + 17.json           ảnh và mô tả nằm cạnh nhau
    backgrounds/  bg-1.png + 1.json
    bags/         lunchbox-body.png + lunchbox.json
  02-<chương sau>/
    …
```

Chương sau thêm thư mục của nó. Món **dùng lại** ở nhiều chương thì **không nhân bản**:
file cứ nằm ở chương đầu tiên tạo ra nó, chương sau chỉ cần mã số, `index.json` lo phần
tìm đường. Theo bảng Level Design thì việc này xảy ra nhiều, ví dụ Water Bottle có mặt ở 6 chương.

Thư mục chương là cách xếp cho **người** nhìn. Lúc phát hành, ảnh được đổi tên theo hash nội dung
và gom về một chỗ phẳng, nên hai chương dùng chung một ảnh chỉ tốn một file.

### Chương nào tải ảnh của chương đó

Mỗi chương tự khai báo cần những ảnh nào. Danh sách do `tools/publish.mjs` quét các level
rồi ghi vào `map.json` lúc phát hành, không phải điền tay:

```json
"assets": { "items": [0,1,3,4,…], "backgrounds": [1,2,3], "bags": ["backpack","lunchbox","tote"] }
```

Game chỉ nạp phần của chương đang chơi, rồi lúc máy rảnh mới tải trước chương kế tiếp
(`prefetchChapter`). Nhờ vậy thêm chương mới **không phải tải lại ảnh của chương cũ**.

Chương đi kèm bản build nằm sẵn trong `public/content`, mở lần đầu không cần mạng.

### Sinh lại sprite

Art gốc vẽ bằng canvas được giữ ở `tools/legacy-art/` để còn sinh lại ảnh ở độ phân giải khác.
Nó **không nằm trong bản build**, chỉ trang sinh sprite bên editor mới dùng tới.

Mở `http://localhost:5174/tools/gen-sprites.html` rồi bấm **Sinh toàn bộ PNG**. Trang này vẽ
32 món ở tỉ lệ 4×, 3 bối cảnh ở 2×, 3 chiếc túi ở 3× rồi ghi thẳng vào bản nháp kèm manifest.
Muốn ảnh to hơn cho Unity thì sửa `ITEM_SCALE`, `BG_SCALE`, `BAG_SCALE` trong `gen-sprites.js`.

Ảnh món được căn sao cho tâm ảnh trùng trọng tâm hình vật lý, nếu không món sẽ lệch khỏi
vùng va chạm.

### Túi có ba lớp

Túi không thể là một ảnh phẳng vì lòng túi đổi hình theo từng level. Mỗi kiểu túi có ba ảnh:

| Lớp | Vai trò |
|---|---|
| `body` | thân túi, nằm sau đồ, kéo giãn theo khung túi |
| `lining` | lót trong, **cắt theo polygon của level** nên hình khuyết góc vẫn đúng |
| `frame` | khung và trang trí, đè lên đồ để che phần thò ra |

Ngăn khoá, mép lòng túi và chữ gợi ý vẫn vẽ lúc chơi vì chúng là dữ liệu của từng level.

### Thêm ảnh cho món

Không sửa code, làm hết trong editor:

1. Mở **🎨 Thư viện art**, tìm món, bấm **Sửa**
2. Kéo file PNG hoặc WebP nền trong suốt vào ô thả ảnh
3. Đặt **bề rộng thật** tính bằng pixel logic — đây là kích thước món trong game, không phải
   kích thước ảnh. Ảnh nên lớn hơn 3–4 lần cho nét trên màn retina
4. Bấm **Lưu món**. Vùng va chạm tự bám theo viền đục của ảnh
5. Bấm **Phát hành** khi muốn người chơi nhận được

Editor ghi ra hai file trong bản nháp:

```
draft/assets/sprites/<id>.png     ảnh
draft/assets/items/<id>.json      manifest: sprite + collider + metadata
```

Lúc phát hành, ảnh được đổi tên theo hash nội dung và đưa ra `content/assets/`, dùng chung cho
mọi bản. Đường dẫn trong JSON được viết lại tự động. Nhờ hash trong tên, ảnh cache được vĩnh viễn
mà đổi ảnh vẫn ăn ngay, và hai bản dùng chung một ảnh không tốn thêm chỗ.

Muốn bỏ ảnh quay về hình vẽ code thì bấm **Dùng lại hình vẽ** trong cùng hộp thoại.

Ảnh nền và ảnh túi đi theo đúng đường đó, thêm ở phần Bối cảnh trong Thư viện art.

## Chạy cùng Level Editor

Mở hai server cạnh nhau, editor sẽ đọc và ghi thẳng vào `public/content` của repo này:

```bash
# cửa sổ 1
cd snug && npm run dev                  # cổng 5173

# cửa sổ 2
cd snug_level_editor && npm run dev     # cổng 5174
```

Editor tự tìm `../snug/public/content`. Đặt khác thì dùng biến `SNUG_CONTENT_DIR`.

## Script dựng content

```bash
node build_levels.mjs     # dựng lại 10 level chương School Day từ template
node check_levels.mjs     # kiểm tra density, Difficulty Point, solver của cả chương
node tools/publish.mjs    # phát hành bản nháp hiện tại
```

`build_levels.mjs` và `check_levels.mjs` làm việc trên `public/content/draft/`.

## Cấu trúc mã

```
src/
  main.js                điểm vào game
  content/loader.js      đọc pack / map / level / manifest
  content/sync.js        kiểm tra bản mới, chỉ tải file có hash khác
  content/store.js       kho ở máy: IndexedDB cho JSON, Cache Storage cho ảnh
  data/items.js          hình vật lý + metadata từng món
  art/                   helpers · items · scenes · scene-registry · bags
  game/                  state · canvas · physics · rules · input · mechanics · boosters · level · render · autoplay
  gen/                   difficulty · solver · generator
  ui/hud.js              HUD và các overlay
  util/geom.js           hình học + PRNG có seed
docs/                    bản chép GDD từ Notion + kế hoạch
```

Phần Level Editor dùng lại: `data/` · `art/` · `content/` · `gen/` · `util/` · `game/state.js` · `game/physics.js`.
Sửa những chỗ này là ảnh hưởng cả hai bên.

## Tài liệu

`docs/` chứa bản chép GDD (Core Game, Booster, Level Generation, Meta, Art Style, Wireframe),
kế hoạch thiết kế lại, kế hoạch map 1 và editor, pipeline asset và content, phân tích bảng
Level Design, và kế hoạch content service (`14`).
