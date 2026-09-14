# Phân tích bảng Level Design SNUG Mobile (Google Sheet)

Nguồn: sheet "Level Design SNUG Mobile", tab `Journey`, đọc ngày 2026-09-14.
Dữ liệu thô đã lưu ở `docs/data/journey-items.json` và `docs/data/containers.json`.

## 1. Bảng có gì

**Bảng trái — Item theo Journey**: 240 dòng = 8 Journey × 30 món.
Cột: `Journey · Item ID · Item · Category · Size (draft) · Shape (draft)`.
151 item id duy nhất, nghĩa là **nhiều món dùng lại ở nhiều journey** (ví dụ `ITM_015 Water Bottle` có ở 6 journey).

**Bảng phải — Container**: 10 chiếc.
Cột: `Container ID · Container · Usable Shape (draft) · Journey Pool`.

| ID | Túi | Hình lòng túi | Dùng ở journey |
|---|---|---|---|
| CTR_01 | Backpack | Rounded top | School Day, Weekend Trip, Camping Trip |
| CTR_02 | Suitcase | Rounded rectangle | Weekend Trip, Beach Vacation |
| CTR_03 | Cardboard Box | Rectangle | Moving Day, Grocery Shopping |
| CTR_04 | Tote Bag | Trapezoid | School Day, Beach Vacation, Grocery Shopping |
| CTR_05 | Lunch Box | Rounded rectangle | School Day, Picnic Day |
| CTR_06 | Duffel Bag | Wide rounded rectangle | Weekend Trip, Gym Session, Camping Trip |
| CTR_07 | Picnic Basket | Oval | Picnic Day |
| CTR_08 | Storage Box | Wide rectangle | Moving Day |
| CTR_09 | Travel Pouch | Small rounded rectangle | Weekend Trip, Beach Vacation, Camping Trip, Gym Session |
| CTR_10 | Shopping Bag | Tall rectangle | Grocery Shopping |

**Phân loại**: 6 Category (Clothing, Personal Care, Electronics, Food & Drink, Accessories, Context Gear),
3 Size (Small/Medium/Large), 10 Shape (Rectangle, Rounded rect, Long, Oval, Circle, Triangle, Curved, L-shape, U-shape, Irregular).

## 2. Thống kê từng journey

| Journey | Túi dùng được | S / M / L | Shape đáng chú ý |
|---|---|---|---|
| School Day | Backpack, Tote Bag, Lunch Box | 18 / 10 / 2 | 15 Rectangle, 6 Long |
| Weekend Trip | Backpack, Suitcase, Duffel, Travel Pouch | 18 / 10 / 2 | 4 Irregular, 1 U-shape (Neck Pillow) |
| Beach Vacation | Suitcase, Tote Bag, Travel Pouch | 13 / 14 / 3 | 6 Irregular, 3 Circle |
| Moving Day | Cardboard Box, Storage Box | 13 / 12 / **5** | 5 Irregular, 2 L-shape |
| Picnic Day | Lunch Box, Picnic Basket | 16 / 11 / 3 | 4 Circle, 7 Long, 2 Triangle |
| Camping Trip | Backpack, Duffel, Travel Pouch | 18 / 8 / 4 | **9 Long** (lều, túi ngủ, đèn pin) |
| Gym Session | Duffel, Travel Pouch | **20** / 8 / 2 | 4 Circle, 3 Curved |
| Grocery Shopping | Cardboard Box, Tote Bag, Shopping Bag | 18 / 11 / 1 | **12 món Food & Drink**, 6 Rounded rect |

Nhận xét dùng được ngay:
- **Moving Day khó nhất về size** (5 Large), **Gym Session dễ nhất** (20 Small).
- **Camping Trip lệch shape**: 9 món Long, xếp sẽ nhiều thao tác xoay → hợp với cơ chế giữ 1,5 giây.
- **Grocery Shopping đậm chủ đề** (12 món đồ ăn), dễ làm level "đi chợ" nhận ra ngay.
- Số container mỗi journey từ 2 đến 4, đủ để chia 10 level thành 3 giai đoạn.

## 3. Thiếu gì để dựng được level thật

Bảng mới ở mức draft, còn ba khoảng trống phải lấp trước khi generator chạy được:

**a. Kích thước thật bằng pixel.** Sheet chỉ ghi Small/Medium/Large. Game cần chiều rộng và cao cụ thể để tính
Packing Density. Đề xuất bảng quy đổi theo cặp (Size × Shape), đơn vị pixel logic, màn 420×760:

| Shape | Small | Medium | Large |
|---|---|---|---|
| Rectangle | 46 × 34 | 72 × 52 | 108 × 76 |
| Rounded rect | 42 × 36 | 66 × 54 | 100 × 78 |
| Long | 18 × 56 | 24 × 88 | 30 × 124 |
| Oval | 44 × 32 | 68 × 48 | 100 × 70 |
| Circle | ⌀ 38 | ⌀ 58 | ⌀ 84 |
| Triangle | 44 × 38 | 68 × 58 | 100 × 84 |
| Curved | 48 × 26 | 74 × 38 | 108 × 54 |
| L-shape | 46 × 44 | 70 × 66 | 104 × 96 |
| U-shape | 48 × 44 | 72 × 66 | 106 × 96 |
| Irregular | 44 × 40 | 68 × 60 | 100 × 88 |

Diện tích thực tế nhỏ hơn khung vì hình lồi lõm: Circle ≈ 79%, Triangle ≈ 50%, L-shape ≈ 65%,
U-shape ≈ 60%, Irregular ≈ 75%, Curved ≈ 65% diện tích khung.

**b. Kích thước lòng túi.** Cần số cụ thể cho 10 container. Đề xuất:

| Túi | Lòng túi | Diện tích | Ghi chú hình |
|---|---|---|---|
| Lunch Box | 210 × 150 | 31.500 | bo góc nhẹ |
| Travel Pouch | 200 × 140 | 28.000 | nhỏ nhất |
| Shopping Bag | 190 × 280 | 53.200 | cao hẹp |
| Tote Bag | 250 × 230 | ~54.000 | hình thang, đáy hẹp hơn miệng 15% |
| Picnic Basket | 260 × 200 | ~41.000 | oval, mất góc |
| Backpack | 250 × 250 | ~60.000 | bo tròn phần trên |
| Suitcase | 280 × 230 | 64.400 | chữ nhật bo |
| Duffel Bag | 300 × 190 | ~55.000 | rộng, bo hai đầu |
| Cardboard Box | 280 × 250 | 70.000 | chữ nhật thẳng |
| Storage Box | 320 × 200 | 64.000 | rộng nhất |

**c. Thuộc tính cơ chế.** Sheet chưa có cột cho physics và mechanic. Cần thêm hoặc suy ra:
- `physics`: rolling cho Circle và Oval, bouncy cho bóng, vibrating cho điện thoại, còn lại normal.
- `canLink`: đồ đi theo cặp (Sneaker, Sandals, Sports Gloves, Swim Fin).
- `canLock`: món có thể giấu trong hộp bí ẩn, nên là món vừa và không phải chìa khóa.
- `difficultyCost`: suy từ size và shape theo bảng GDD.

Tôi đề xuất **thêm 4 cột này vào sheet** để designer nắm quyền, thay vì hardcode trong game.

## 4. Cách chia 10 level cho một journey

Công thức chung, áp cho mọi journey:

**Chia 3 giai đoạn theo túi**, từ nhỏ tới lớn:
- Level 1–3: túi nhỏ nhất trong pool, 4–7 món, hầu hết Small, density 60–72%.
- Level 4–7: túi trung bình, 7–10 món, thêm Large và shape khó, density 74–84%.
- Level 8–10: túi lớn nhất, 10–14 món, density 85–90%, gộp nhiều cơ chế.

**Mỗi level mở đúng một thứ mới**, không dồn:

| Level | Thứ mới | Cơ chế | Booster mở |
|---|---|---|---|
| 1 | kéo thả | — | — |
| 2 | xoay bằng giữ 1,5 giây | 1 món Long | — |
| 3 | món lăn | 1 Circle/Oval | Jiggle |
| 4 | đổi túi, món Large đầu tiên | 1 Large | — |
| 5 | đồ buộc cặp | 1 linked pair | — |
| 6 | lòng túi khuyết góc | container shape biến thể | Resize |
| 7 | hộp bí ẩn | 1 locked + chìa trong túi | — |
| 8 | block chặn | 1 block + 2 rolling | — |
| 9 | đổi túi lớn nhất, hai ngăn | linked + locked cùng lúc | Extra Time |
| 10 | tổng hợp | locked + linked + 2 rolling + block | Throw Out |

**Chọn món theo Category để level có chủ đề**, không random đều:
lấy trọn một nhóm làm lõi rồi thêm món phụ. Ví dụ School Day:

| Level | Túi | Lõi chủ đề | Số món |
|---|---|---|---|
| 1 | Lunch Box | Food & Drink: Apple, Banana, Milk Carton, Granola Bar | 4 |
| 2 | Lunch Box | thêm Sandwich Pack, Water Bottle (Long → phải xoay) | 6 |
| 3 | Lunch Box | thêm Tissue Pack, Wet Wipes | 7 |
| 4 | Tote Bag | Context Gear: Notebook, Ruler, Pencil, Glue Stick, Watercolor Tin | 8 |
| 5 | Tote Bag | thêm Textbook (Large) + cặp Rolled Socks | 9 |
| 6 | Tote Bag | thêm Calculator, Student Card, Keyring | 10 |
| 7 | Backpack | Clothing + Electronics, hộp bí ẩn giấu Tablet | 11 |
| 8 | Backpack | thêm Sneaker (L-shape), Baseball Cap (Irregular) | 12 |
| 9 | Backpack | thêm Folded Umbrella, Hand Towel, Earbud Case | 13 |
| 10 | Backpack | gần trọn pool, 2 Large, đủ cơ chế | 14 |

Cùng công thức này áp cho 7 journey còn lại, chỉ đổi túi và lõi chủ đề.
Riêng Moving Day có 5 Large nên đẩy Large vào sớm hơn, từ level 3.

## 5. Đường đi để tự động hóa

Sau khi chốt mục 3, quy trình chạy được hoàn toàn trong Level Editor:

1. **Nhập sheet vào content pack**: script đọc Google Sheet, sinh `assets/items/<id>.json`
   cho 151 món (collider từ bảng quy đổi, meta từ sheet) và `containers/<id>.json` cho 10 túi.
2. **Mỗi journey thành một chương**: `content/maps/<journey>/map.json`.
3. **Dùng tab Sinh tự động**: nạp sẵn 10 template theo bảng ở mục 4, bấm sinh từng level,
   editor tự kiểm tra density, Difficulty Point và solver, rồi lưu.
4. **Chỉnh tay ở tab Sắp xếp** những level chưa ưng, đặc biệt vị trí block và chìa khóa.
5. **Art thay sau**: 151 món hiện dùng hình vector tạm, khi có PNG thì kéo vào tab Thêm art,
   trùng id là tự thay, không phải sửa level.

## 6. Việc cần bạn chốt

1. **Bảng kích thước pixel** ở mục 3a và 3b: dùng luôn đề xuất của tôi, hay bạn muốn tự đặt trong sheet?
2. **4 cột cơ chế** (physics, canLink, canLock, difficultyCost): thêm vào sheet hay để game tự suy?
3. **Journey làm trước**: School Day theo thứ tự GDD, hay Weekend Trip / Beach Vacation cho hợp ảnh Art Style?
4. **Timer mỗi level**: đề xuất Easy 120s giảm dần tới 70s ở level 10.
