# Hoàn Thiện Auto-Play Theo Hành Vi Bot Thật

## Tóm Tắt
Auto-play sẽ dùng action utility của bot thật, thêm ưu tiên theo build và luật an toàn. Không dùng gold reserve hoặc ngưỡng economy tự đặt. Sau khi bot hoàn tất action thường, Tactical AI phân tích đối thủ PvP chính, áp dụng hết move rồi level 4 mới ready.

## Runtime Auto-Play

### Chu Trình Mỗi Round
- Chỉ chạy trong `PREPARING`; combat và ready không dispatch action.
- Thứ tự bắt buộc: action bot thường → ổn định roster → Tactical AI → áp dụng tuần tự toàn bộ move → ready.
- Đọc lại state trước mỗi action và mỗi tactical move để hỗ trợ thao tác tay xen kẽ.
- Chỉ level 4 tự ready; reset marker mỗi round để ready lại ở mọi round.
- Nếu Tactical AI lỗi, phase kết thúc hoặc không áp dụng hết move: không ready. Sang round sau controller thử lại theo state mới.

### Hành Vi Bot Và Preset
- Dùng `getActions(state, personality, settings)` của bot thật làm nguồn utility cho buy, XP, reroll, sell, craft và equip.
- Không thêm gold reserve cứng, không ép roll liên tục theo `rollStrategy`.
- Giữ nguyên guard bot thật: mua XP dùng ngưỡng nội bộ `10/5`; reroll chỉ khi shop rỗng và tiền lớn hơn `13 + rerollCost`; mua quân dựa trên capacity, unit đã sở hữu, synergy, cost và health.
- `rollStrategy` và build chỉ cộng bias vào utility, không thay thế logic bot.
- Hiển thị ba preset, chỉ chọn lúc bật auto:

| Preset | `ambition` | `composure` | `vision` | Ý nghĩa |
|---|---:|---:|---:|---|
| `balanced` | 100 | 100 | 100 | Bot tiêu chuẩn |
| `stabilize` | 120 | 40 | 80 | Ưu tiên giữ máu, mua và triển khai tempo |
| `economy` | 60 | 160 | 120 | Ít phản ứng nóng vội, giữ nhịp economy |

- `vision` điều chỉnh mức ưu tiên build trong scorer auto; không tạo ngưỡng tiền mới.

### Roster, Item Và Bán Rác
- Build là ưu tiên, không phải whitelist. Bot được mua và đưa unit ngoài build xuống sân nếu utility tốt.
- Khi board thiếu quân, chọn unit bench mạnh nhất; khi board đầy, thay unit yếu hơn. Scoring ưu tiên 3 sao, 2 sao, core/build, synergy và cost.
- Cho phép đưa core 1 sao lên bench để nhường sân cho unit mạnh hơn; không bao giờ bán core.
- Level 4 dùng generic craft/equip của bot: ghép mọi recipe hợp lệ, gắn item ngay lên unit phù hợp nhất, ưu tiên unit đang trên board. `itemPlan` chỉ cộng bonus.
- Level 4 chủ động bán rác bench khi đầy hoặc cần chỗ mua unit tốt. Không bán core, unit 2-3 sao hoặc unit đang cầm đồ. Level 1-3 không bán.

## Tactical Positioning
- Thay RL decoder trực tiếp bằng `PositioningAdvisor`: RL sinh candidate, simulator đánh giá candidate.
- Thêm selector `balanced | max`; Coach thủ công giữ `balanced`, auto dùng `max`.
- Auto chỉ dùng đối thủ PvP chính đã reveal và chọn candidate có `preservationScore` cao nhất; không lọc vùng win-rate 55-70%.
- Chỉ gọi advisor sau khi không còn action bot hoặc roster cần làm.
- Đợi advisor hoàn tất, sau đó apply từng move với khoảng nghỉ action hiện có. Chỉ ready sau move cuối cùng thành công.
- Nếu board bị người chơi thay đổi trong lúc advisor chạy, bỏ kết quả cũ và phân tích lại.

## Socket Và UI
- Mở rộng `startBuildAutoPlay` thành `{ plan, level, preset }`; server validate preset và lưu cùng controller để reconnect giữ trạng thái.
- `buildAutoPlayStatus` thêm `preset`; giữ activity và recent steps để hydrate sau reconnect.
- Chuyển Coach chat sang một message stream duy nhất theo thứ tự thời gian:
  - Lời chào và quick actions là assistant message đầu tiên.
  - Câu hỏi quyền + preset là assistant message tiếp theo sau khi bấm `Thực thi build`.
  - Mỗi activity mới của agent được append xuống cuối stream; trạng thái trùng lặp không append lại.
  - Không còn welcome card, permission card hoặc live card cố định nằm riêng phía trên.
- Khi auto bật, khóa input, nút gửi, Enter submit, quick actions và `Thực thi build`; chỉ giữ nút `Tắt auto`.
- Đồng bộ màu chat với game: nền xanh đen/nâu tối, viền và tiêu đề vàng `#c8aa6e`; teal chỉ dùng cho spinner, glow và trạng thái auto đang chạy.

## Kiểm Thử
- Policy tests: preset truyền đúng personality; không có gold reserve tùy chỉnh; off-build unit vẫn được mua và triển khai; unit nâng sao được ưu tiên.
- Item/sell tests: generic craft, equip lên unit phù hợp, dọn bench level 4, giữ luật không bán core/nâng sao/cầm đồ.
- Tactical tests: chỉ chạy sau action thường, dùng primary opponent và mode `max`, apply hết move trước ready, board đổi thì phân tích lại, lỗi tactical không ready.
- Controller tests: combat không action; preparing round mới tiếp tục; level 4 ready mọi round sau tactical; reconnect giữ plan, level và preset.
- UI tests và smoke test: `/build` → thực thi → chọn preset + quyền → activity tuần tự trong stream → khóa gửi chat → stop → mở khóa.
- Chạy Jest tactical-ai, `tsc --noEmit` tactical-ai và server-game, webpack web-game; giữ nguyên staged `RAG_SERVICE_URL` và xem lỗi duplicate CSS module identifier hiện có là baseline.
