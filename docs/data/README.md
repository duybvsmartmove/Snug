# Dữ liệu gốc từ Google Sheet

Nguồn: [Level Design SNUG Mobile](https://docs.google.com/spreadsheets/d/1UvvWQ6wDRH5r11R_lv0eejk7R-WbVyz4K-QqYbd6gjI/edit), tab `Journey`.
Đọc ngày 2026-09-14.

| File | Nội dung |
|---|---|
| `containers.json` | 10 container: id, tên, hình lòng túi, journey dùng được |
| `items.json` | 151 món duy nhất: id, tên, category, size, shape, và danh sách journey món đó xuất hiện |

240 dòng trong sheet = 8 journey × 30 món, nhưng chỉ 151 món duy nhất vì nhiều món
dùng lại ở nhiều journey (ví dụ `ITM_015 Water Bottle` có mặt ở 6 journey).

Phân tích và kế hoạch dựng level: xem `../13-level-design-sheet.md`.

Khi sheet thay đổi, chạy lại script đọc (chưa viết) hoặc cập nhật tay hai file này.
