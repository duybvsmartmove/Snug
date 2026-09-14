# Map 1 "Pack & Go" (10 level đầu) + Level Editor

## 1. Nguyên tắc: level là DATA, không phải code
Mỗi level là một file JSON trong `src/data/levels/`. Game chỉ đọc JSON. Editor ghi JSON. Không ai phải sửa `.js` để đổi level.

```jsonc
{
  "id": "m1-l04",
  "chapter": "pack-and-go",
  "name": "Sunny escape",
  "timer": 90,                       // giây
  "background": "bedroom",           // skin nền: bedroom | hallway | ...
  "container": {
    "skin": "suitcase_m",            // art vỏ túi
    "shape": [[0,0],[300,0],[300,220],[0,220]],   // polygon lòng túi (toạ độ cục bộ)
    "areas": [],                     // vùng chứa phụ (ngăn) – polygon
    "forbidden": [],                 // vùng cấm đặt – polygon
    "blocks": [{"x":120,"y":0,"w":60,"h":30}]     // block chặn tĩnh trong túi
  },
  "mode": "fixed",                   // fixed = editor đặt tay | generated = template + seed
  "items": [
    {"id":"hoodie",  "x":60,  "y":520, "angle":0.3},
    {"id":"socksL",  "x":140, "y":540, "link":"socksR"},
    {"id":"socksR",  "x":190, "y":540},
    {"id":"camera",  "x":260, "y":530, "locked":true},
    {"id":"key",     "inBag":true, "x":40, "y":180}   // chìa đặt sẵn trong túi (GDD)
  ],
  "generate": null,                  // dùng khi mode = generated (xem mục 4)
  "reward": {"coin": 35, "memory": "postcard_04"},
  "difficulty": {"points": 8, "tier": "Medium"}      // editor tự tính, lưu để tra cứu
}
```

Item mechanics gắn ngay trên item: `link` (nối dây), `locked` (hộp bí ẩn), `inBag` (spawn sẵn trong túi, dùng cho chìa hoặc đồ đã có), `rolling`/`bouncy` lấy từ metadata món.

## 2. Map 1 "Pack & Go": chủ đề, nền, túi, item pool
Chủ đề: **chuẩn bị vali đi chơi cuối tuần** (khớp ảnh Art Style: vali đỏ trong phòng ngủ ấm).

**Background**: phòng ngủ có cửa sổ sáng, cây, thảm tròn, sticker "Pack it all!" trên tường. 1 nền dùng chung cả map, đổi nhẹ theo nhóm level (sáng → chiều → tối) để không nhàm.

**Container skins (3 vỏ, nhiều shape)**
| Skin | Dùng ở | Lòng túi | Shape pool |
|---|---|---|---|
| `backpack_s` balo xanh | L1–L3 | ~230×180 | S01 chữ nhật bo, S02 vát 1 góc |
| `suitcase_m` vali đỏ | L4–L8 | ~290×230 | S01 chữ nhật, S02 khuyết góc, S03 chữ L, S04 có block đai |
| `suitcase_l` vali lớn 2 ngăn | L9–L10 | ~300×260 | S01 hai ngăn (vách giữa), S02 ngăn lệch |

**Item pool (24 món, có metadata)**
| Nhóm | Món | Size | Shape | Physics |
|---|---|---|---|---|
| Quần áo | Áo hoodie, áo phông, quần jean, quần short, áo sọc, mũ len, mũ lưỡi trai, tất (đôi) | L/M/M/M/M/S/S/S | irregular/rect | normal |
| Phụ kiện | Kính râm, tai nghe, máy ảnh, điện thoại, sạc + cáp, sổ tay, sách | S/M/M/S/S/S/M | mixed | phone = vibrating |
| Vệ sinh | Bàn chải, kem chống nắng, chai nước, khăn cuộn, túi mèo | S/M/M/M/M | rect/round | towel = rolling |
| Vui | Bóng, hộp bánh, passport, chìa khóa | S/S/S/XS | round/rect | ball = bouncy |

Mỗi món: `size`, `area`, `shape`, `physics`, `difficultyCost`, `canLink`, `canLock`.

## 3. Curve 10 level (theo bảng Difficulty Point trong GDD)
| Lv | Container | Items | Density | Mechanic mới | Booster unlock | Điểm | Tier | Timer |
|---|---|---|---|---|---|---|---|---|
| 1 | backpack_s S01 | 4 | 60% | Tutorial kéo thả, xoay giữ 1,5s | – | 1 | Easy | 120 |
| 2 | backpack_s S01 | 5 | 68% | Item dài (cần xoay) | – | 2 | Easy | 110 |
| 3 | backpack_s S02 | 6 | 72% | Bóng lăn (rolling) | Jiggle | 4 | Easy | 100 |
| 4 | suitcase_m S01 | 7 | 76% | 1 Large (hoodie) | – | 6 | Easy | 90 |
| 5 | suitcase_m S01 | 7 | 78% | Linked pair (tất) | – | 8 | Medium | 90 |
| 6 | suitcase_m S02 khuyết góc | 8 | 80% | Container khuyết | Resize | 9 | Medium | 85 |
| 7 | suitcase_m S03 chữ L | 8 | 82% | Mystery box + chìa trong túi | – | 10 | Medium | 80 |
| 8 | suitcase_m S04 | 9 | 84% | Block chặn + 2 rolling | – | 12 | Hard | 75 |
| 9 | suitcase_l S01 hai ngăn | 10 | 86% | Linked + Locked cùng lúc | Extra Time | 14 | Hard | 70 |
| 10 | suitcase_l S02 | 10 | 88% | Boss map: phone rung + 2 rolling + linked | Throw Out (nếu unlock 9)| 16 | Very Hard | 70 |

Coin thưởng tạm: Easy 20 · Medium 35 · Hard 50 · Very Hard 60. Hết map +40 (GDD). Memory item: 1 postcard mỗi level, đủ 10 mở "Weekend album".

## 4. Level động: generator theo template + seed
`mode: "generated"` dùng khi muốn level tự sinh (hoặc để editor gợi ý):
```jsonc
"generate": {
  "seed": 8241,
  "pool": ["hoodie","tshirt","jeans","socksL","socksR","camera","ball","towel","book","sunscreen"],
  "count": [8, 9],
  "density": [0.80, 0.85],
  "sizeDist": {"L": 2, "M": 3, "S": "rest"},
  "mechanics": {"rolling": 1, "linked": 1, "locked": 0}
}
```
Flow đúng GDD: chọn shape từ pool → tính usable area (polygon thật) → random item theo density → gán mechanic → tính Difficulty Point → solver thử xếp (greedy + xoay 4 hướng, 200 lần) → loại candidate quá giống level trước → trả candidate. Restart giữ seed → cùng bộ đồ. Editor có nút **Bake**: đông cứng kết quả generate thành `mode: fixed` để GD chỉnh tay tiếp.

## 5. Level Editor (chạy trong game, chỉ ở dev)
Mở bằng `?editor=1` hoặc nút ẩn (giữ logo 2s). Overlay panel bên phải, canvas game ở giữa vẫn chạy physics thật.

**Tab Level**: danh sách level trong map (kéo đổi thứ tự) · New / Duplicate / Delete · tên, timer, background, reward coin, memory.

**Tab Container**: chọn skin · chọn shape preset hoặc **Edit Shape**: kéo control point, click cạnh để Add Point, double-click để Delete Point · vẽ Forbidden area · vẽ Block (kéo hình chữ nhật) · thêm Area (ngăn) · hiện **Usable area** và **Density** hiện tại theo diện tích thật.

**Tab Items**: palette 24 món (thumbnail) → click để thả vào khay · kéo item trên canvas để đặt vị trí spawn, xoay bằng bánh xe · chọn item để gắn mechanic: Link với món khác (click 2 món), Locked (thành hộp ?), In bag (đặt sẵn trong túi) · xoá item.

**Tab Generate**: pool (tick), count, density, sizeDist, mechanics, seed · **Generate** → xem kết quả + bảng Difficulty Point cộng từng dòng · **Reroll** · **Bake**.

**Thanh trên**: Difficulty Point live · Solver check (Solvable / Impossible) · **Playtest** (chơi ngay, ESC về editor) · **Save**.

**Lưu**: dev server có endpoint `POST /__level/save` (Vite plugin nhỏ) ghi thẳng `src/data/levels/<id>.json` và `map.json` (thứ tự level). Kèm Export/Import JSON để gửi cho nhau. Bản nháp tự lưu localStorage.

## 6. Thay đổi kỹ thuật cần làm trong game
1. `container.shape` polygon → thành túi vật lý sinh từ các cạnh polygon (chuỗi hình chữ nhật mỏng), lòng túi vẽ theo polygon, vỏ túi là skin vẽ quanh bounding box.
2. `bagZone / fullyInside` chuyển từ hình chữ nhật sang **point-in-polygon** cho toàn bộ đỉnh item (trừ forbidden).
3. Level loader đọc JSON, `map.json` quyết định thứ tự; `LEVELS` trong `levels.js` chỉ còn là fallback.
4. Item metadata thêm vào `items.js`; `area` tính từ vertices Matter.
5. Generator + Difficulty + Solver trong `src/gen/`.
6. Editor trong `src/editor/` (chỉ nạp khi `?editor=1`, không vào build production).

## 7. Thứ tự làm
1. Level JSON + loader + polygon container (game đọc được level do editor tạo) — 1 đợt.
2. Editor Tab Container + Tab Items + Save qua Vite plugin + Playtest — 1 đợt.
3. Generator + Difficulty + Solver + Tab Generate — 1 đợt.
4. Đặt tay 10 level Map 1 bằng chính editor, art 3 skin + nền phòng ngủ — 1 đợt.
