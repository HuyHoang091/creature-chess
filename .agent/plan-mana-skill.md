# KẾ HOẠCH TRIỂN KHAI HỆ THỐNG MANA & KỸ NĂNG (PHASE 1)

## 1. Mở rộng Model (`@creature-chess/models`)
*   **File `piece.ts` & `creatureDefinition.ts`**:
    *   Bổ sung `maxMana` vào cấu hình gốc của từng `CreatureStats`.
    *   Bổ sung `currentMana` vào trạng thái `PieceModel` hiện tại.
    *   Định nghĩa Interface `SkillDefinition` gồm: `type` (Damage, Buff, Support), `target` (Đơn/AoE/Bounce/Line), `manaCost`, `values` (Lượng sát thương/hồi máu).

## 2. Nâng cấp Battle Simulator (`@creature-chess/battle/src/simulator`)
*   **Tăng Mana**:
    *   Viết logic khi tấn công (`attack.ts`/`simulatePiece`): Tăng `+X` mana mỗi đòn đánh.
    *   Viết logic khi nhận sát thương (`Hit` resolver): Tăng `+Y` mana tương ứng với lượng máu đã mất.
*   **Kích hoạt Kỹ năng (Spell Cast)**:
    *   Trước vòng lặp `takePieceTurn`, kiểm tra: Nếu `currentMana >= maxMana` => Ngắt đòn đánh thường, chuyển sang `castSkill()`.
    *   `castSkill()` sẽ đọc `SkillDefinition` và tạo ra mảng `HitDetails/BuffDetails` tác động lên tất cả mục tiêu hợp lệ trong lưới cờ, sau đó trừ `currentMana` về 0.

## 3. Hiển thị UI / Combat (`apps/web-game`)
*   **Thanh Mana (Mana Bar)**:
    *   Bổ sung thanh năng lượng màu xanh biển ngay phía dưới hoặc rải qua thanh chéo của `.healthbar` trong phần UI `MatchPiece`.
    *   Animation chạy mềm khi Mana tăng lên.
*   **Canvas Kỹ năng (`src/effects/skills/`)**:
    *   Tạo thư mục `src/effects/skills/`.
    *   Xây dựng một Component Canvas `SkillOverlay.tsx` layer nằm cao hơn bàn cờ nhưng nằm dưới hiệu ứng Overlay Rewards. Khi một quân tung kỹ năng, vẽ vòng tròn hoặc Line (Flash) lên Screen X, Y. Phục vụ tạm thời cho việc dễ hình dung.

## 4. Các Loại Logic Skill Cần Xử Lý
1.  **Đơn mục tiêu (Single)**: Y hệt Basic Attack / Shoot, mang Damage to hơn.
2.  **AOE (Vùng/Lân cận)**: Lấy lưới vị trí gốc, lan `radius = X` ô (Hexagon/Grid distance).
3.  **Bounce (Nảy)**: Chạy Chain Lightning, tìm Piece hợp lệ gần nhất trong phạm vi.
4.  **Hồi máu/Buff (Support)**: Tránh chém vào phe mình, đổi mảng mục tiêu thành Friendly thay vì Enemy.
