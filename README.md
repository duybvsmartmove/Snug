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

Món chưa có ảnh thì game vẽ bằng hàm vector trong `src/art/items.js`. Hiện **chưa có file ảnh nào**
trong repo, toàn bộ art đang là code vẽ.

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
