# Everything Fits

Cozy packing puzzle cho mobile web, chuyển thể từ [Snug](https://cookiecrayon.itch.io/snug),
xây theo GDD của Smartmove (bản chép trong `docs/`).

Stack: **Vite + ES modules + Matter.js**, Canvas 2D, không framework UI.

Một repo, hai trang:

| Trang | Là gì |
|---|---|
| `index.html` | game |
| `editor.html` | Level Editor: sắp xếp chương, level, quản lý art |

## Chạy

```bash
npm install
npm run dev        # game http://localhost:5173  ·  editor http://localhost:5173/editor.html
npm run build
npm run preview
```

`npm run dev` có `--host` nên mở được trên điện thoại cùng wifi. Chơi ở màn hình dọc.

## Game

| Hành động | Cách làm |
|---|---|
| Nhặt / đặt đồ | Chạm giữ và kéo, thả ngón để đặt |
| Xoay | Chạm vào món để chọn, nút hai mũi tên hiện ở góc món; giữ nút rồi kéo, món quay theo ngón |
| Booster | Lắc túi · Thu nhỏ 20% · Bỏ đi, mỗi loại có số lượt hiện trên badge |
| Tạm dừng / đổi level | Nút góc phải trên |

Luật theo GDD: vừa chỗ thì viền xanh, không vừa thì viền đỏ và rung, thả ra là bật ngược ra ngoài túi.
Hết giờ là thua, có thể dùng Extra Time. Hộp bí ẩn mở bằng cách kéo chạm chìa khoá đặt sẵn trong túi.

## Nội dung

Mọi thứ nằm trong `public/content` và đi kèm bản build. **Lúc chơi game không gọi mạng.**

```
public/content/
  levels.json                      sắp xếp chương và level — editor ghi ra file này
  assets/index.json                mục lục: mã số → file mô tả
  assets/01-school-day/items/…     ảnh món và mô tả, nằm cạnh nhau
  assets/01-school-day/bags/…      ảnh ba lớp của từng kiểu túi
  assets/01-school-day/backgrounds/…
  assets/02-weekend-trip/…
```

`levels.json` chứa toàn bộ chương và level trong một file, khoảng 40 KB. Bấm **Lưu sắp xếp**
trong editor là ghi lại file đó, mở lại game là thấy ngay.

Món dùng lại ở nhiều chương thì **không nhân bản**: file ảnh nằm ở chương đầu tiên tạo ra nó,
chương sau chỉ ghi mã số, `assets/index.json` lo phần tìm đường. Mỗi chương tự khai báo cần
những ảnh nào nên game chỉ nạp phần của chương đang chơi.

## Art

**Toàn bộ phần nhìn là sprite.** Không còn hàm vẽ hình nào trong game: món, bối cảnh và túi
đều là ảnh PNG. Hai chương hiện có tổng 74 ảnh, khoảng 7,9 MB.

Art xếp theo chương, ảnh và file mô tả nằm cạnh nhau:

```
public/content/assets/
  index.json                      mục lục: mã số → đường dẫn file mô tả
  01-school-day/
    items/        17.png + 17.json
    backgrounds/  bg-1.png + 1.json
    bags/         lunchbox-body.png + lunchbox.json
  02-weekend-trip/
    …
```

Món **dùng lại** ở nhiều chương thì không nhân bản: file nằm ở chương đầu tiên tạo ra nó,
chương sau chỉ ghi mã số vào level, `index.json` lo phần tìm đường. Theo bảng Level Design
việc này xảy ra nhiều, ví dụ Water Bottle có mặt ở 6 chương.

### Thay art

Đặt file PNG mới đè lên file cũ, giữ nguyên tên và đường dẫn mà `index.json` đang trỏ tới.
File mô tả đi kèm (`17.json`) khai báo `pixelsPerUnit`, tức ảnh lớn gấp mấy lần kích thước
thật trong game, và `collider` là vùng va chạm. Đổi ảnh mà giữ đúng tỉ lệ thì không phải sửa gì.

### Vùng va chạm bám sát hình

Matter.js chỉ dựng được hình **lồi**. Không có thư viện tách hình thì mọi đa giác lõm
bị bọc thành bao lồi: trăng khuyết, chữ C, chữ U đều bị lấp kín phần khuyết và chiếm chỗ
nhiều hơn trông thấy.

`poly-decomp` được đăng ký ngay trong `src/game/physics.js`, Matter tự cắt hình lõm thành
nhiều mảnh lồi ghép lại. Đo bằng hình trăng khuyết: tách 16 mảnh, diện tích va chạm bằng
đúng diện tích hình; nếu dùng khung vuông thì chiếm gấp 2,15 lần.

Trong hai chương hiện có, giày thể thao là món lõm duy nhất, giờ tách thành 2 mảnh.

### Túi có ba lớp

Túi không thể là một ảnh phẳng vì lòng túi đổi hình theo từng level. Mỗi kiểu túi có ba ảnh:

| Lớp | Vai trò |
|---|---|
| `body` | thân túi, nằm sau đồ, kéo giãn theo khung túi |
| `lining` | lót trong, **cắt theo polygon của level** nên hình khuyết góc vẫn đúng |
| `frame` | khung và trang trí, đè lên đồ để che phần thò ra |

Ngăn khoá, mép lòng túi và chữ gợi ý vẫn vẽ lúc chơi vì chúng là dữ liệu của từng level.

### Chương nào nạp ảnh của chương đó

Mỗi chương khai báo cần những ảnh nào ngay trong `levels.json`, do editor tính lại mỗi lần lưu:

```json
"assets": { "items": [0,1,3,4,…], "backgrounds": [1,2,3], "bags": ["backpack","lunchbox","tote"] }
```

Game chỉ nạp phần của chương đang chơi, không đụng tới ảnh của chương khác.

## Deploy

Repo này deploy thẳng lên GitHub Pages, không cần dịch vụ nào khác.

1. **Mở repo thành công khai.** Pages trên gói Free chỉ chạy với repo công khai.
   Settings → General → Danger Zone → Change visibility.
2. **Bật Pages:** Settings → Pages → Source chọn **GitHub Actions**.
3. **Đẩy lên nhánh `main`.** Workflow `.github/workflows/pages.yml` tự build và đưa lên.

Xong thì có hai link chia sẻ được:

| Link | Là gì |
|---|---|
| `https://<chủ>.github.io/<repo>/` | game |
| `https://<chủ>.github.io/<repo>/editor.html` | Level Editor |

### Editor trên web lưu bằng cách nào

Trang trên Pages là trang tĩnh nên không ghi file được. Editor tự dò lúc khởi động rồi chọn
đường lưu:

| | Chạy ở máy | Trên Pages |
|---|---|---|
| Bấm Lưu | ghi thẳng `public/content/levels.json` | commit file đó lên GitHub |
| Cần token | không | có, dán một lần cho mỗi trình duyệt |
| Người chơi thấy sau | mở lại game | khoảng 40 giây, workflow tự deploy lại |

`levels.json` luôn được tải với `cache: no-store`. GitHub Pages đặt `max-age=600` cho file tĩnh,
không ép thì mười phút sau người chơi mới thấy sắp xếp mới. File chỉ khoảng 40 KB nên không đáng kể.

Trên web, nút **🔑** ở thanh trên mở hộp thoại dán token. Tạo ở **GitHub → Settings →
Developer settings → Fine-grained tokens**, chọn đúng repo này, cấp **Contents: Read and write**.
Token nằm trong `localStorage` của trình duyệt người dùng, chỉ gửi tới `api.github.com`,
thu hồi lúc nào cũng được.

Ai không có token thì vẫn xem và sắp xếp được, nhưng chỉ tải `levels.json` về máy chứ không
sửa được nội dung game. Mỗi người một token nên lịch sử commit cho biết ai đổi gì.

## Script dựng content

```bash
node build_levels.mjs                 # dựng lại level chương 1 · School Day
node build_levels.mjs weekend-trip    # dựng lại level chương 2
node check_levels.mjs                 # kiểm tra density, Difficulty Point, solver
node check_levels.mjs weekend-trip
```

Cả hai đọc và ghi `public/content/levels.json`.
Thêm chương mới thì thêm một mục vào `CHAPTERS` và `LEVELS` trong `build_levels.mjs`.

Hai chương hiện có, mỗi chương 10 level, món lấy từ sheet Level Design:

| Chương | Túi | Bối cảnh | Món riêng |
|---|---|---|---|
| 1 · School Day | Hộp cơm, Túi tote, Ba lô | Góc học tập sáng/trưa/chiều | 30 |
| 2 · Weekend Trip | Túi nhỏ, Ba lô, Vali | Phòng ngủ ban ngày/chiều tối | 22 mới + 8 dùng lại |



## Cấu trúc mã

```
index.html             game
editor.html            Level Editor
src/
  main.js              điểm vào game
  content/loader.js    đọc levels.json và art; hàm ghi cho editor
  data/items.js        hình vật lý + metadata từng món
  art/                 helpers · items(sprite) · scenes · scene-registry · bags
  game/                state · canvas · physics · rules · input · mechanics · boosters · level · render · autoplay
  gen/                 difficulty · solver · generator
  ui/hud.js            HUD và các overlay
  util/geom.js         hình học + PRNG có seed
  editor/              main · draw · manage · generate · pool · assets · editor.css
public/content/        levels.json + assets
docs/                  bản chép GDD từ Notion + kế hoạch
```

## Tài liệu

`docs/` chứa bản chép GDD (Core Game, Booster, Level Generation, Meta, Art Style, Wireframe),
kế hoạch thiết kế lại, kế hoạch map 1 và editor, pipeline asset và content, phân tích bảng
Level Design, và kế hoạch content service (`14`).
