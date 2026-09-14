# Asset pipeline: thay art vẽ code bằng ảnh (AI gen / designer vẽ)

> **Lưu ý:** đây là bản thiết kế ban đầu. Hai chỗ đã đổi khi làm thật:
> id món giờ là **số nguyên** (17) chứ không phải tên (`hoodie`), và đường dẫn nằm trong
> `public/content/draft/assets/` chứ không phải `public/assets/`.
> Cách làm thực tế xem mục "Thêm ảnh cho món" trong README, cơ chế phát hành xem `14-content-service.md`.

## Nguyên tắc
Hình vẽ và vật lý là hai thứ tách rời. Mỗi món/túi/nền là một **manifest JSON** trỏ tới ảnh + dữ liệu hình học. Renderer có 2 chế độ: `sprite` (ảnh) và `vector` (hàm vẽ canvas hiện tại). Có ảnh thì dùng ảnh, chưa có thì fallback vector. Thay art = thay file PNG + chỉnh manifest, không sửa code game.

```
public/assets/
  items/hoodie.png          ảnh món (PNG/WebP nền trong suốt)
  items/hoodie.json         manifest
  containers/suitcase_m.png + .json
  backgrounds/bedroom_day.png (+ layers)
  atlas/items-1.png + items-1.json   (tùy chọn: gộp sprite khi build)
```

## 1. Item
### Manifest
```jsonc
{
  "id": "hoodie",
  "name": "Áo hoodie",
  "sprite": { "src": "items/hoodie.png", "pixelsPerUnit": 3, "pivot": [0.5, 0.5] },
  "collider": {                       // toạ độ logic, gốc = pivot
    "kind": "polygons",               // circle | rect | polygons (nhiều đa giác lồi)
    "shapes": [ [[-40,-52],[40,-52],[44,10],[30,52],[-30,52],[-44,10]] ]
  },
  "meta": { "size": "L", "shape": "irregular", "physics": "normal", "difficultyCost": 3, "canLink": true, "canLock": true }
}
```
- **pixelsPerUnit = 3**: ảnh 3× kích thước logic (món 88 px logic → ảnh 264 px) để nét trên màn retina. Mọi item cùng tỉ lệ này, nhờ vậy kích thước tương đối giữa món tự đúng.
- **collider** sinh tự động từ alpha của ảnh (mục 4), GD chỉnh lại trong editor nếu cần. Matter chỉ nhận đa giác lồi → đa giác lõm được tách tự động (poly-decomp).
- `area` tính từ collider → dùng cho Packing Density và Difficulty, không cần nhập tay.

### Render
`drawBody`: translate(position) → rotate(angle) → scale(artScale) → `drawImage(img, -w/2, -h/2, w, h)` với `w = img.width / pixelsPerUnit`. Viền xanh/đỏ và lớp băng vẫn vẽ theo collider như hiện tại.

## 2. Container (túi)
```jsonc
{
  "id": "suitcase_m",
  "back":  { "src": "containers/suitcase_m_back.png",  "pixelsPerUnit": 3 },  // vỏ + lót, vẽ SAU đồ
  "front": { "src": "containers/suitcase_m_front.png", "pixelsPerUnit": 3 },  // khung viền, vẽ TRƯỚC đồ (đè lên)
  "anchor": [0.5, 1.0],                     // điểm đặt túi trên sàn
  "usable": [[-145,-115],[145,-115],[145,115],[-145,115]],   // polygon lòng túi mặc định
  "shapePool": { "S01": [...], "S02": [...] }               // preset lòng túi khác cho cùng 1 ảnh
}
```
Ảnh túi cắt làm 2 lớp: **back** (thân + lót) và **front** (viền, khóa kéo, quai) để đồ trông nằm trong. Lòng túi (usable) vẫn là polygon do GD kéo trong editor, độc lập với ảnh, nên một ảnh túi dùng được nhiều shape (đúng GDD Shape Pool).

## 3. Background
```jsonc
{ "id": "bedroom_day", "layers": [
  { "src": "backgrounds/bedroom_wall.png",  "y": 0,   "parallax": 0 },
  { "src": "backgrounds/bedroom_table.png", "y": 428, "parallax": 0 },
  { "src": "backgrounds/bedroom_props.png", "y": 0,   "parallax": 0, "opacity": 0.85 }
]}
```
Canvas logic 420×760, ảnh nền 1260×2280 (3×). Tách lớp tường / mặt bàn / props để đổi giờ trong ngày bằng tint hoặc swap 1 lớp. Feedback team "BG quá nổi bật" → chỉnh `opacity` trong manifest.

## 4. Sinh collider từ ảnh (tự động)
Trong editor, Tab **Assets**: kéo PNG vào → tool:
1. Đọc alpha, ngưỡng > 40 → mask.
2. Marching squares → contour ngoài.
3. Douglas–Peucker simplify (tolerance 2–3 px logic) → 10–20 đỉnh.
4. Nếu lõm → tách đa giác lồi (poly-decomp).
5. Preview collider đè lên ảnh, GD kéo đỉnh sửa, hoặc chọn nhanh Circle / Rect / Capsule.
6. Save → `items/<id>.json`.
Cùng thuật toán chạy được bằng script Node (`npm run assets`) để xử lý hàng loạt khi có nhiều ảnh mới.

## 5. Quy ước để ảnh AI gen "nhét vào là chạy"
- Nền **trong suốt** (hoặc nền phẳng 1 màu rồi remove bg). Không đổ bóng ra ngoài vật, bóng game tự vẽ.
- **Góc nhìn thẳng từ trên** (top-down / flat lay) như ảnh Art Style, không phối cảnh 3D.
- **Ánh sáng cùng hướng** cho cả bộ (trên-trái). Outline đậm cùng màu `#2B1B3D`, dày ~2% chiều rộng món.
- **Tỉ lệ thật**: gen theo bảng kích thước (hoodie 88 px logic, tất 40 px…), hoặc gen một tấm "sheet" nhiều món cùng lúc rồi cắt để giữ tỉ lệ tương đối. Editor có thanh **scale** để chỉnh nếu lệch.
- Xuất PNG 3× (tối đa ~400 px cạnh dài mỗi món), sau đó build gộp WebP để nhẹ.
- Túi: gen 1 ảnh vali mở, đã tách back/front (hoặc tách bằng mask trong editor), lòng túi để trống.
- Đặt tên file theo `id` trong item pool. Trùng id là game nhận ngay.

## 6. Tối ưu
- Build: script gộp `items/*.png` thành atlas (texture packer) + WebP, cache theo hash.
- Preload theo level: chỉ tải ảnh của item/container/background level đó, có màn loading ngắn.
- Thumbnail packing strip vẽ từ chính sprite (scale nhỏ) → tự khớp art mới.

## 7. Việc cần làm trong code (gộp vào Đợt 1 của kế hoạch level)
1. `AssetLoader`: tải ảnh + manifest, cache, promise theo level.
2. `ITEM_DEFS` đọc từ manifest JSON (`public/assets/items/*.json`); mục nào chưa có ảnh giữ `vector: true` dùng hàm vẽ cũ.
3. `drawBody` / `drawBag` / `drawScene` hỗ trợ sprite.
4. Collider polygons → Matter `Bodies.fromVertices` (kèm `poly-decomp`).
5. Editor Tab Assets: import PNG → trace collider → chỉnh → save.
6. Script `npm run assets` cho batch.
