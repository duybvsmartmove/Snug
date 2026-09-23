# Everything Fits

Cozy packing puzzle cho mobile web, chuyển thể từ [Snug](https://cookiecrayon.itch.io/snug),
xây theo GDD của Smartmove (bản chép trong `docs/`).

Stack: **Vite + ES modules + Matter.js**, Canvas 2D, không framework UI.

Một repo, ba trang:

| Trang | Là gì |
|---|---|
| `index.html` | game |
| `editor.html` | Level Editor: sắp xếp chương, level, quản lý art |
| `creative.html` | Creative Tool: chọn level, máy chơi, quay video và chụp ảnh store |

## Chạy

```bash
npm install
npm run dev        # game http://localhost:5173  ·  editor /editor.html  ·  creative tool /creative.html
npm run build
npm run preview
```

`npm run dev` có `--host` nên mở được trên điện thoại cùng wifi. Chơi ở màn hình dọc.

## Game

**Splash**: mở game là màn Splash (`src/ui/splash.js`): đồ của chương đầu mưa từ trên cao xuống,
chất thành đống bằng vật lý thật, logo ở giữa, hiện 3 giây (`DUNG_LAU`) rồi tự sang trang chủ;
chạm vào đâu cũng bỏ qua sớm. Đồ và nền theo bộ art đang dùng. Mở thẳng level
(`?level=`), khung xem thử của editor và Creative Tool bỏ qua màn này.

| Hành động | Cách làm |
|---|---|
| Nhặt / đặt đồ | Chạm giữ và kéo, thả ngón để đặt |
| Xoay | Chạm vào món để chọn, nút hai mũi tên hiện ở góc món; giữ nút rồi kéo, món quay theo ngón |
| Booster | Đóng băng · Thu nhỏ 20% · Bỏ đi, mỗi loại có số lượt hiện trên badge |

**Đóng băng**: trong 20 giây mọi món nằm gọn trong túi, và mọi món thả vào túi, đứng yên đúng chỗ
(không trọng lực, không bị đẩy), để kê chồng hay đặt chênh vênh mà không đổ. Hết giờ thì trả lại
cho vật lý. Tính theo đồng hồ game nên tạm dừng là băng cũng dừng. Code ở `src/game/boosters.js`.
| Tạm dừng / đổi level | Nút góc phải trên |

Luật theo GDD: vừa chỗ thì viền xanh, không vừa thì viền đỏ và rung, thả ra là bật ngược ra ngoài túi.
Hết giờ là thua, có thể dùng Extra Time. Hộp bí ẩn mở bằng cách kéo chạm chìa khoá đặt sẵn trong túi.

### Máy tự chơi

Nút **Auto** trong Creative Tool và **Máy chơi thử** trong editor dùng chung `src/game/autoplay.js`.
Máy làm việc như một người chơi cẩn thận:

1. **Lập kế hoạch trọn** cho cả túi bằng máy xếp (`src/gen/solver.js`): lòng túi thành lưới ô,
   hình thật của từng món ở nhiều góc xoay thành mặt nạ, xếp từ đáy lên, chấm điểm chỗ bám
   chắc và phạt chỗ thiếu đỡ bên dưới. Thử lần lượt vài cấu hình lưới (5px·8 góc → 3px·16 góc)
   tới khi có kế hoạch xếp hết; buộc phải bỏ món thì so theo diện tích, món to luôn được ưu tiên.
   Tính chạy nhả nhịp (`solveAsync`) nên game vẫn vẽ đều lúc quay video.
2. **Bám theo kế hoạch** từ dưới lên: trước mỗi món kiểm tra chỗ đã định bằng hình học thật
   (thân vật lý tạm, đo độ lún với đồ trong túi và với thành túi), lệch thì nhích vài đơn vị,
   hỏng hẳn mới lập lại từ hiện trạng. Hộp bí ẩn được kéo chạm chìa trước khi xếp gì.
3. **Không dùng booster**, trừ khi bật nút 🎁 Booster trong tool. Hết chỗ thì dừng và báo.

Level đầy trên ~90% (`sd-09` 95%, `sd-10` 100%, `wt-09` 97%, `wt-10` 105%: tổng diện tích đồ bằng
hoặc vượt lòng túi) không ai xếp vừa nếu không thu nhỏ hay bỏ món — đó là thiết kế cần booster,
không phải giới hạn của máy. Đo máy xếp trên mọi level: `node check_levels.mjs [chương]`.

Máy xếp tính theo **gốc hình** của món còn thân vật lý xoay quanh **trọng tâm**; hai điểm này
lệch nhau vài đơn vị với hình sinh từ ảnh, `autoplay.js` quy đổi qua `body.origin`. Sửa chỗ nào
đặt món theo toạ độ máy xếp thì nhớ quy đổi, không thì món rơi trật vài px và khe hở dồn lại.

### Ngôn ngữ

Game nói **tiếng Anh mặc định**, đổi sang tiếng Việt bằng nút `EN/VI` trên trang chủ hoặc `?lang=vi`.
Chữ của giao diện nằm trong `src/i18n.js`. Tên level và chữ gợi ý trong túi là nội dung, nằm
trong `levels.json`: `name`/`emptyText` tiếng Việt, `nameEn`/`emptyTextEn` tiếng Anh (editor có ô
**Tên EN**). Thiếu bản Anh thì hiện bản Việt. Tên món tiếng Anh tra theo `slug` trong `i18n.js`.

## Creative Tool

`creative.html` dành cho team creative: chọn chương và level, máy tự chơi, chụp ảnh store
và quay video gameplay. Game chạy **thật** trong iframe (`index.html?creative=1`), tool chỉ
điều khiển từ ngoài qua postMessage (`src/game/creative.js`), nên HUD, bảng thắng thua, nhạc
đều đúng như game. Khác ba điều: không ghi tiến độ vào máy, mọi màn đều mở, máy chơi không
hiện toast.

| Nút | Phím | Làm gì |
|---|---|---|
| ← Levels | Esc | về màn chọn chương và level (có tên và độ khó từng level) |
| Reset | R | chơi lại màn |
| Auto | S | máy chơi một mạch; bấm lại để dừng |
| 1 món | D | máy xếp **một** món rồi chờ, bấm tiếp mới xếp món sau |
| Tay / Time | | nhịp tay của máy · tốc độ thời gian game (0.5x là quay chậm) |
| 👆 Tay | F | ngón tay giả bay theo món khi máy chơi |
| ⏱ Giờ | T | đếm giờ hay đóng băng đồng hồ (không thua) |
| Boost · HUD | | ép số lượt booster · ẩn riêng tên level, pause, đồng hồ, booster |
| Hide UI | H | ẩn thanh công cụ, chỉ còn khung game |
| Art · Aspect · Lang | | bộ art cozy/casual · khung 9:16, 1:1, 4:5 · ngôn ngữ game |
| 📷 Chụp · ● Quay | | chụp PNG / quay WEBM đúng khung, đúng cỡ xuất |

Ở 1:1 và 4:5 game vẫn 9:16 đặt giữa khung, phần thừa tô bằng bối cảnh làm mờ. Cỡ xuất theo
khung: 1080×1920, 1080×1080, 1080×1350. Chụp và quay dùng API ghi màn hình của trình duyệt:
lần đầu Chrome hỏi chọn tab, chọn đúng tab này một lần, sau đó chụp và quay bao nhiêu lần cũng
được. Tool tự cắt phần khung game ra khỏi ảnh tab và co về đúng cỡ xuất; tiếng game đi kèm video.
Cần mp4 thì convert từ webm.

## Nội dung

Mọi thứ nằm trong `public/content` và đi kèm bản build. **Lúc chơi game không gọi mạng.**

```
public/content/
  config.json                        bộ art game đang dùng, editor ghi khi bấm Lưu
  cozy/                              bộ art cozy
    levels.json                      sắp xếp chương và level — editor ghi ra file này
    assets/index.json                mục lục: mã số → file mô tả, kèm nhóm "ui" (icon HUD)
    assets/01-school-day/items/…     ảnh món và mô tả, nằm cạnh nhau
    assets/01-school-day/bags/…      ảnh túi
    assets/01-school-day/backgrounds/…
    assets/ui/…                      icon booster, nút tạm dừng, khung đồng hồ
  casual/                            bộ art casual, cùng cấu trúc
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

### Hai bộ art

Bộ art chọn bằng `?art=cozy|casual` (Creative Tool và editor có ô chọn Art). Hai bộ **tách riêng
hoàn toàn**: mỗi bộ một thư mục gốc `public/content/<bộ>/` có level, mục lục, ảnh món, túi,
nền và vùng va chạm riêng. Dáng món khác thì vùng va chạm khác, level phải cân riêng, nên
không dùng chung gì. Tiến độ người chơi cũng lưu riêng theo bộ. Bộ nào chưa có `levels.json`
thì game lặng lẽ dùng bộ cozy.

**Game dùng bộ nào** ghi trong `public/content/config.json` (`{ "art": "cozy" }`), chung cho cả
hai bộ. Trong editor, ô **🎮 Game dùng** ở thanh trên đổi giá trị này; ô tô cam là đã đổi mà
chưa lưu. Bấm **Lưu** là ghi file (chạy ở máy) hoặc commit lên GitHub (editor trên web), game
mở lại là nhận. Ô **Sửa art** bên cạnh chỉ chọn bộ đang sửa trong editor, không đổi game.
Địa chỉ có `?art=` thì ưu tiên hơn config (Creative Tool, khung xem thử của editor dùng cách này).

- **cozy**: art mới. Hiện có chương 1 (15 món, ba lô, một nền giấy, icon HUD).
- **casual**: art viền đậm cũ, hai chương, giữ nguyên như trước khi tách.

HUD dùng icon ảnh khi mục lục của bộ có nhóm `ui` (`pause`, `timer`, `snow`, `small`, `delete`),
không có thì giữ icon vẽ sẵn. Bảng màu HUD của từng bộ nằm ở cuối `src/styles/main.css`.

Công cụ Node đều nhận `--art casual` (mặc định cozy):

| Lệnh | Làm gì |
|---|---|
| `node tools/import_items.mjs <thư mục PNG> --ghi` | nhập ảnh món theo mã `ITM_xxx` trong tên file: lọc nền rác, cắt sát viền, giữ diện tích món, sinh vùng va chạm |
| `node tools/import_bag.mjs <ảnh> --id backpack --ghi` | nhập túi dáng cố định: dò lòng túi trong đường khoá kéo, tách lớp body/frame |
| `node tools/import_ui.mjs ic_*.png --ghi` | nhập icon HUD, tên lấy theo file bỏ `ic_` |
| `node tools/build_cozy_levels.mjs --ghi` | dựng lại 10 level chương 1 của cozy từ bảng mẫu trong file |
| `node tools/refit_levels.mjs --ghi` | cân lại lòng túi kiểu cũ theo độ đầy của bộ tham chiếu |
| `node check_levels.mjs [chương]` | cho máy xếp thử từng level |

### Thay art

Đặt file PNG mới đè lên file cũ, giữ nguyên tên và đường dẫn mà `index.json` đang trỏ tới.
File mô tả đi kèm (`17.json`) khai báo `pixelsPerUnit`, tức ảnh lớn gấp mấy lần kích thước
thật trong game, và `collider` là vùng va chạm. Đổi ảnh mà giữ đúng tỉ lệ thì không phải sửa gì.

### Thành túi

Thành túi là các hình chữ nhật mỏng dọc theo từng cạnh polygon, dài đúng bằng cạnh; khe ở góc
lồi bịt bằng một cột tròn đặt hẳn ra ngoài. Trước đây mỗi đoạn được kéo dài thêm 7 đơn vị hai
đầu, ở góc **lõm** (túi chữ L, khuyết góc) phần đó chọc vào lòng túi thành vật cản vô hình.

### Vùng va chạm bám sát hình

Matter.js chỉ dựng được hình **lồi**. Không có thư viện tách hình thì mọi đa giác lõm
bị bọc thành bao lồi: trăng khuyết, chữ C, chữ U đều bị lấp kín phần khuyết và chiếm chỗ
nhiều hơn trông thấy.

`poly-decomp` được đăng ký ngay trong `src/game/physics.js`, Matter tự cắt hình lõm thành
nhiều mảnh lồi ghép lại. Matter có một khe hở: hình lõm tách ra rồi lọc mảnh vụn còn đúng
một mảnh thì nó trả thân ở toạ độ cục bộ quanh (0,0), không dời tới chỗ yêu cầu. Máy ảnh
(mã 39) rơi đúng khe này nên `makeItem` luôn đặt lại vị trí sau khi dựng đa giác. Đo bằng hình trăng khuyết: tách 16 mảnh, diện tích va chạm bằng
đúng diện tích hình; nếu dùng khung vuông thì chiếm gấp 2,15 lần.

Trong hai chương hiện có, giày thể thao là món lõm duy nhất, giờ tách thành 2 mảnh.

### Túi dáng cố định (cozy)

Túi cozy vẽ liền một tấm. Hình lòng túi **đi theo ảnh**: `import_bag.mjs` dò mảng lòng túi nằm
trong đường khoá kéo thành đa giác `inner` trong file mô tả túi. Level không kéo hình túi nữa,
chỉ chọn **cỡ túi** (`container.scale`, ảnh phóng đều, không méo) và đặt **vật cản**. Túi kín bốn
bề, không có miệng hở. Level vẫn ghi kèm `shape` tính sẵn cho công cụ Node đọc, nhưng lúc chơi
và lúc mở trong editor luôn tính lại từ ảnh túi. Đáy ảnh túi luôn neo trên mép bàn, cỡ lớn nhất
giới hạn để túi không chạm đồng hồ (`src/data/bag.js`).

Vật cản có năm hình (chữ nhật, tròn, viên thuốc, tam giác, thoi) và màu tuỳ chọn
(`src/data/blocks.js`). Trong editor, tool Vật cản: kéo để tạo, bấm để chọn, kéo để dời chỗ,
đổi hình và màu ở ô bên cạnh, Delete để xoá.

### Túi có ba lớp (casual)

Túi casual không thể là một ảnh phẳng vì lòng túi đổi hình theo từng level. Mỗi kiểu túi có ba ảnh:

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
| `https://<chủ>.github.io/<repo>/creative.html` | Creative Tool |

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
creative.html          Creative Tool
src/
  main.js              điểm vào game
  i18n.js              song ngữ en/vi
  content/loader.js    đọc levels.json và art; hàm ghi cho editor
  data/items.js        hình vật lý + metadata từng món
  art/                 helpers · items(sprite) · scenes · scene-registry · bags
  game/                state · canvas · physics · rules · input · mechanics · boosters · level · render · autoplay · creative (cầu nối tool)
  gen/                 difficulty · solver · generator
  ui/hud.js            HUD và các overlay
  util/geom.js         hình học + PRNG có seed
  editor/              main · draw · manage · generate · pool · assets · editor.css
  creative/            main · creative.css
public/content/        levels.json + assets
docs/                  bản chép GDD từ Notion + kế hoạch
```

## Tài liệu

`docs/` chứa bản chép GDD (Core Game, Booster, Level Generation, Meta, Art Style, Wireframe),
kế hoạch thiết kế lại, kế hoạch map 1 và editor, pipeline asset và content, phân tích bảng
Level Design, và kế hoạch content service (`14`).
