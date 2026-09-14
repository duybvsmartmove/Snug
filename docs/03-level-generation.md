# Level Generation System

Mỗi level được tạo từ một **Level Template**, hệ thống random item theo rule thay vì random hoàn toàn.

## Level Template
- Level ID, Difficulty, Container, **Timer**, Item Pool, Item Count
- Packing Density: 75% Easy | 80% Medium | 90% Hard | 98% Super Hard
- Size Distribution: Small / Medium / Large
- Mechanics: Rolling / Bouncy / Linked / Locked / …
- Variation

Ví dụ Medium level: Suitcase M, 8–10 item, Density 80–85%, 2 Large / 3 Medium / còn lại Small, 1 Rolling + 1 Linked Pair.

## Item Metadata
Size, Area (diện tích chiếm chỗ), Shape, Physics, Difficulty Cost, Can Link, Can Lock.
Ví dụ: Ball → Small / Round / Rolling / Difficulty 2. Jacket → Large / Irregular / Normal / Difficulty 3.

## Generation Flow
Chọn Container → Random item trong Item Pool → Check số lượng + Size Distribution → Check Packing Density → Gán mechanic → Tính Difficulty → Solver kiểm tra có giải được → Check level có quá giống level gần nhất → Save.
Không đạt rule nào thì generate lại candidate khác.

## Difficulty Point
| Yếu tố | Điều kiện | Điểm |
|---|---|---|
| Packing Density | < 65% | 0 |
| | 65–74% | +1 |
| | 75–82% | +2 |
| | 83–88% | +3 |
| | > 88% | +4 |
| Item Count | 1–5 | 0 |
| | 6–7 | +1 |
| | 8–10 | +2 |
| | 11+ | +3 |
| Size / Shape | Chủ yếu Small/Medium, shape đơn giản | 0 |
| | Có 1–2 Large hoặc shape dài | +1 |
| | Nhiều Large / Irregular | +2 |
| | Nhiều Large + Irregular khó xếp | +3 |
| Rolling / Bouncy | 0 / 1 / 2 / 3+ item | 0 / +1 / +2 / +3 |
| Linked | 0 / 1 pair / 2+ pair | 0 / +2 / +3 |
| Locked | 0 / 1 / 2+ item | 0 / +2 / +3 |
| Container Complexity | Đơn giản / hơi irregular / irregular nhiều góc / nhiều vùng | 0 / +1 / +2 / +3 |

| Tổng điểm | Difficulty |
|---|---|
| 1–6 | Easy |
| 7–10 | Medium |
| 11–14 | Hard |
| 15–17 | Very Hard |
| 18+ | Challenge |

Generator chỉ giữ candidate nằm đúng range.

## Solver
Kiểm tra level impossible / quá dễ / quá khó. Mỗi level generate 50–100 candidate, GD chọn candidate tốt nhất.

## Chống lặp
So level mới với các level gần nhất theo: Container, Size mix, Mechanic mix, Item Pool, Density, Shape mix. Quá giống → generate lại.

## Seed
Mỗi level lưu bằng một Seed để tái tạo chính xác bộ item. Restart → giữ nguyên Seed → giữ nguyên bộ item.

## Container Shape Editor
GD tự chỉnh polygon usable area của container thay vì chữ nhật cố định, lưu thành Shape Preset. Generator chọn preset và dùng diện tích thực để tính Density và Difficulty.
Tool cần: Edit Shape, Add Point, Move Point, Delete Point, Preset Shape (Rectangle / Rounded / L-shape / Irregular), Multiple Area (compartment), Forbidden Area, Preview Capacity, Packing Density tính theo shape thực (không dùng bounding box).
Ví dụ: Suitcase_M có Shape Pool S01–S04; khi generate: chọn Container → chọn 1 Shape → tính usable area → random item theo Density. Generator không tự random polygon.
