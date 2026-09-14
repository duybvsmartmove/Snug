# Core Game

## Mechanics túi đựng đồ
- Túi được vẽ như một cái khung/hộp chứa đồ nhìn thẳng vào (straight view), giống như đang nhìn xuyên thấu.
- Bên trong túi có ranh giới rõ ràng (viền túi) để người chơi biết đâu là "trong túi" (hợp lệ) và đâu là "ngoài túi" (chưa xếp).
- Hình dạng túi không nhất thiết là hình vuông/chữ nhật, có thể méo, có góc khuyết, có ngăn nhỏ... để tạo độ khó.
- Khi mới vào level, túi trống trơn (chỉ có viền), còn đồ đạc thì nằm rải rác bên ngoài túi (thường ở dưới màn hình hoặc xung quanh túi).

## Mechanics cầm nắm
- Chạm và giữ (touch & hold) vào 1 món đồ → món đồ được "nhấc lên" (nổi lên trên các item khác, kèm đổ bóng để báo hiệu "đang cầm cái này").
- Kéo ngón tay đi đâu, món đồ di chuyển theo đó (drag).
- Thả tay ra → item rơi xuống đúng vị trí ngón tay đang ở, giống như đặt đồ xuống.
- Chạm và giữ ngón tay trên 1 item mà KHÔNG di chuyển trong **1,5 giây** liên tục → item tự động xoay (xoay dần đều).
- Ngay khi bắt đầu kéo ngón tay → việc xoay dừng lại ngay lập tức, item chuyển sang trạng thái "đang được kéo đi" bình thường.

## Tương tác giữa túi và item
- Khi kéo item lại gần/vào trong viền túi, hệ thống kiểm tra: item có vừa vào chỗ trống đó không (không đè lên item khác, không lọt ra ngoài viền túi).
- Nếu vừa → hiệu ứng gợi ý: **viền item sáng lên xanh**.
- Nếu không vừa (đè lên đồ khác, hoặc lấn ra ngoài viền túi) → báo hiệu bằng **màu đỏ / rung nhẹ**, và khi thả tay ra item sẽ **bật ngược ra ngoài túi**.
- Khi item đã nằm gọn trong túi và không đè lên ai → item được coi là "đã xếp", cập nhật vào Packing List (gạch tên món đó).
- Túi có physics: những item đã đặt trong túi vẫn có thể bị xô đẩy, lăn, xê dịch nếu bạn nhét thêm 1 món to vào gần đó.

## Cơ chế Win/Lose
### Win
- Xếp được tất cả các món đồ vào túi (không món nào còn nằm ngoài) **trước khi hết thời gian**.
- Khi món cuối cùng vừa khít vào túi → level kết thúc ngay, hiện màn ăn mừng + phần thưởng.
### Lose
- Mỗi level có 1 mốc thời gian giới hạn (ví dụ: 60 giây, 90 giây... tuỳ độ khó level).
- Hết thời gian mà vẫn còn ít nhất 1 món đồ chưa xếp vào túi → thua level.
- Ngay khi thua, hệ thống trừ 1 heart (tim).

## Hệ thống Heart
- Kho tim tối đa **5 tim**.
- Thua 1 level → mất 1 tim.
- Hết sạch tim (0 tim) → không thể vào chơi level mới, phải chờ hoặc xem Ads.
- Tim tự hồi dần theo thời gian (ví dụ: 1 tim hồi lại sau mỗi 20-30 phút, tinh chỉnh sau khi test).

## Các Mechanics phụ
- **Block**: Ở trên túi có thể đặt sẵn các block chặn (có thể kéo thả trong tool).
- **Link item**: ≥2 item được nối với nhau bằng sợi dây.
- **Mystery Item (Locked Item)**:
  - Ban đầu: item hiện ra là 1 hộp đen có dấu "?".
  - **Chìa khoá được đặt sẵn trong túi** (không nằm ngoài cùng đống đồ).
  - Cách mở khoá: kéo hộp đen chạm vào chìa khoá trong túi → hộp đen biến thành hình dạng thật của món đồ, chìa khoá biến mất.
  - Sau khi mở khoá, item đó vẫn phải xếp gọn vào túi như các món khác.
