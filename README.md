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

Level và art là dữ liệu, không phải code:

```
public/content/
  pack.json                        version + danh sách chương
  maps/school-day/map.json         thứ tự level trong chương
  maps/school-day/levels/*.json    từng level
  assets/items/<id>.json           manifest: sprite + collider + metadata
  assets/sprites/<id>.png          ảnh món
```

Món chưa có ảnh thì game vẽ bằng hàm vector trong `src/art/items.js`.

Content trong repo này là **bản đóng gói sẵn** đi kèm bản build. Cách đưa thay đổi từ editor
sang game khi chạy thật: xem `docs/14-content-service.md`.

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
```

## Cấu trúc mã

```
src/
  main.js                điểm vào game
  content/loader.js      đọc pack / map / level / manifest  ·  setContentBase() đổi nguồn content
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
