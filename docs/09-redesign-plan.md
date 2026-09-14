# Kế hoạch thiết kế lại prototype theo GDD (2026-09-14)

Đối chiếu code hiện tại (`src/`) với GDD trên Notion. ✅ đã đúng · 🔧 cần sửa · ➕ chưa có · ❓ cần GD chốt.

## 1. Core Game

| GDD | Hiện tại | Việc cần làm |
|---|---|---|
| Túi nhìn thẳng, xuyên thấu, viền rõ trong/ngoài | ✅ | Giữ |
| Túi có thể méo, góc khuyết, ngăn nhỏ | 🔧 lòng túi luôn là chữ nhật | Lòng túi theo **polygon** + forbidden area + nhiều vùng; thành túi vật lý sinh từ polygon |
| Vào level túi trống, đồ rải bên dưới | ✅ | Giữ |
| Chạm giữ = nhấc lên, nổi trên đồ khác, có bóng | ✅ | Giữ |
| Thả = rơi đúng vị trí ngón tay | ✅ | Giữ |
| **Giữ yên 1,5s → item tự xoay dần đều; kéo là dừng xoay** | ➕ hiện dùng nút xoay + 2 ngón | Thêm auto-rotate khi giữ yên. ❓ Có giữ nút xoay làm tuỳ chọn phụ không? |
| Vừa chỗ → viền item **sáng xanh** | 🔧 hiện vừa = đặc, không vừa = mờ | Vừa: viền xanh phát sáng. |
| Không vừa → **đỏ + rung nhẹ**, thả ra thì **bật ngược ra ngoài túi** | 🔧 hiện mờ hồng, thả về chỗ trống cuối | Đổi màu đỏ, rung nhẹ item, thả thì bắn ra khay với lực bật |
| Item đã xếp → gạch Packing List | ✅ | Giữ |
| Physics trong túi: nhét thêm đẩy đồ cũ | ✅ | Giữ |
| **Win trước khi hết giờ**, món cuối vào là kết thúc ngay | 🔧 chưa có giờ | Thêm timer đếm ngược theo level (60/90/120s) |
| **Lose khi hết giờ → trừ 1 tim** | ➕ | Màn "So close!" với Extra Time / Retry / Home |
| **Heart** tối đa 5, hồi 1 tim / 20–30 phút, hết tim → chờ hoặc xem ads | ➕ | Hệ thống tim lưu localStorage, màn hết tim theo wireframe |
| Block chặn đặt sẵn trên túi | ➕ | Thêm `blocks: [{x,y,w,h}]` trong level template, vật lý tĩnh trong lòng túi |
| Link item ≥ 2 món nối dây | ✅ 2 món | Mở rộng chuỗi > 2 |
| Mystery: **chìa đặt sẵn trong túi**, kéo hộp chạm chìa | 🔧 hiện chìa nằm ngoài, mở khi cả hai ở trong túi | Chìa spawn trong túi, mở khi hộp đang cầm chạm chìa (đúng GDD) |

## 2. Booster

| GDD | Hiện tại | Việc cần làm |
|---|---|---|
| Jiggle là booster **chọn trước khi vào level**, mở ở level 3, dùng qua Ads | 🔧 luôn có nút | Bỏ khỏi dock. Màn Level intro có "Play with Jiggle"; trong game chỉ hiện khi đã chọn |
| Resize thu nhỏ **20%**, unlock level 6 | 🔧 đang 25% | Đổi 20%, khóa theo level |
| Throw Out unlock level 13 (bảng: 9) | 🔧 | Khóa theo level. ❓ 9 hay 13 |
| **Extra Time** +60s khi hết giờ lần 1, 100 coin | ➕ | Nút trên màn Lose |
| Số lượng booster có kho, mua bằng coin | ➕ | Inventory + coin lưu localStorage, shop "Travel essentials" |
| Badge số lượng trên nút (ảnh art) | 🔧 | Nút booster to dạng viên thuốc, badge góc |

## 3. Level & Generation

| GDD | Hiện tại | Việc cần làm |
|---|---|---|
| Level Template: container, timer, item pool, count, density, size dist, mechanics | 🔧 level hard-code | Chuyển `levels.js` sang template + **generator theo seed** |
| Item Metadata: size, area, shape, physics, difficulty cost, canLink, canLock | 🔧 mới có box/kind | Bổ sung metadata cho từng món |
| Density theo diện tích thực của polygon | ➕ | Tính area polygon (shoelace) và area item từ vertices Matter |
| Difficulty Point + Solver + chống lặp | ➕ | Difficulty tính được ngay; solver dạng greedy packing thử N lần |
| Seed: restart giữ nguyên bộ đồ | ➕ | PRNG seeded (mulberry32) |
| Container Shape Editor cho GD | ➕ | Tool debug trong game: kéo điểm polygon, lưu preset JSON |
| ~10 level đầu tăng dần độ khó (Phase 1) | 🔧 2 level | Tạo 10 level: 3 Easy → 4 Medium → 3 Hard, theo bảng điểm |

## 4. Meta & Economy (Phase 1: chỉ cần hook)
- Coin: base 350, +40 khi hết chapter, mỗi level theo bảng (chưa có) → tạm 20–50 theo difficulty. ➕
- Map chapter đơn giản: School Day → Weekend Trip → Camping → Beach Vacation → Moving Day. ➕
- Memory item / scrapbook: placeholder thumbnail sau level. ➕

## 5. Art Style: "màu sắc nổi bật, hybrid casual thiên stylized cozy"
Ảnh tham chiếu: vali đỏ hồng bão hòa, outline đậm, shading 2 tone, nút booster to bo tròn nhiều màu. Hiện tại pastel nhẹ → phải đẩy lên.
- Bảng màu mới: nền phòng ấm (#F7E6C8 vàng kem + cây xanh), container **đỏ san hô #E8434F / magenta #D9306B**, đồ màu no (xanh lá #4CC46B, hồng #FF6FA5, vàng #FFC53D, xanh dương #3D8BFF, tím #9B5CFF), outline **#2B1B3D**.
- Item: giữ vector nhưng tăng bão hòa, outline dày hơn (3–3.5px), thêm highlight cứng 2 tone thay gloss mờ.
- UI: nút to bo tròn viên thuốc, bóng đổ phẳng 4px, badge số lượng; timer trong khung tròn có icon; pause tròn phải trên.
- Feedback team: BG mờ opacity bớt, button đồng nhất, "Game Casual" hơn "hyper casual".

## 6. Kỹ thuật (Phase 1)
- SFX + rung (Vibration API) khi vừa / không vừa / win / lose. ➕
- Analytics event cơ bản: level_start, level_win, level_fail, booster_use, ad_watch (stub console + dataLayer). ➕
- Performance: giữ 60fps trên mid-range, cap dt. ✅

## Thứ tự làm đề xuất
1. **Luồng game đầy đủ**: Level intro → Gameplay (timer, pause) → Win / Lose → Hearts → Shop. Coin, tim, booster inventory lưu localStorage.
2. **Cơ chế theo GDD**: auto-rotate giữ 1,5s, viền xanh/đỏ + rung, bật ngược, chìa trong túi, block, Extra Time.
3. **Container polygon** + density thực + block.
4. **Level template + generator seed + difficulty**, 10 level Phase 1.
5. **Art pass**: bảng màu nổi, outline đậm, UI viên thuốc theo ảnh tham chiếu.
6. SFX, rung, analytics stub.

## Câu hỏi cần GD chốt
1. Timer từng level Phase 1 (gợi ý: Easy 90s, Medium 75s, Hard 60s)?
2. Auto-rotate khi giữ 1,5s: tốc độ xoay (gợi ý 90°/s) và có giữ nút xoay không?
3. Unlock level của Throw Out: 9 hay 13? Free ban đầu của Jiggle: 1 hay 2?
4. Coin thưởng mỗi level theo difficulty?
5. Hết tim: chờ bao lâu (20 hay 30 phút)?
