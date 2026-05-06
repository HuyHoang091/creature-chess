# KẾ HOẠCH TRIỂN KHAI VÒNG ĐẤU & TRANG BỊ BAO LỒM (PHASE 2)

## 1. Hệ thống Vòng Đấu Bot (PvE Rounds)
*   **Match Manager**: Cải tổ lại vòng đời của Match (`game/state/matchSaga.ts` hoặc các logic tương đương).
*   Định nghĩa `RoundType`: `PvP`, `PvE_Creep`, `PvE_Boss`.
*   Tròn 3 vòng đầu game (1, 2, 3) hoặc các vòng (10, 15, 20...) sẽ tự động thay đối thủ sang Server Bot (chỉ sinh quái). Quái không có chủ, mang AI đơn giản, có máu cao và kỹ năng đặc thù.

## 2. Hệ thống Kho Đồ & Đánh Rớt Trang Bị (Drop System)
*   Tham chiếu `GameState` (Lưu Inventory của người chơi: `unassignedItems: string[]`).
*   **Drop Logic**: Khi `PieceCombatState` của một con creep về 0 -> Tạo ngẫu nhiên 1 tỉ lệ rơi đồ (`drop_chance`).
*   Nếu trúng, đẩy 1 `ItemEvent` (`ITEM_DROPPED`) thông báo tới Client hoặc Server trực tiếp nạp vào Inventory người chơi.
*   **UI Kho đồ (`InventoryPanel`)**: Một container nằm ở góc dưới bên trái màn hình. Vẽ Box / Túi nhặt, chứa các icon item nhỏ. Bổ sung tính năng Drag & Drop bằng HTML5 (Drag Event) để có thể kéo từ Inventory thả vào các ô `Piece` trên bàn cờ.

## 3. Hệ thống Trang Bị Kế Thừa (Item Logic)
*   **Data Models**:
    *   Tạo danh mục `ItemDefinition` gồm: `baseStats` (+ATK, +HP, +Mana...) và `uniquePassive/Active`.
*   **Piece Model Tích Hợp**:
    *   Bảng `PieceModel` / `MatchPiece` bổ sung `items: ItemDefinition[]` (Tối đa 3 slot).
    *   Trong `simulator`, khi tính toán Damage / Combat Loop, lấy `baseAttack + items.reduce(buff)`.
*   **Ghép Đồ (Crafting Recipe)**:
    *   Một Dictionary (JS Map) nối: `[Item_A.id, Item_B.id] = Item_C.id`.
    *   Khi kéo Item B vào con cờ đang giữ Item A, kích hoạt function kiểm tra Recipe -> Hợp thành Item C.
*   **Passive & Active Của Item**:
    *   Ví dụ Quả cầu lửa: `onAttackHit() -> applyBurn()`. (Xử lý thông qua chuỗi hook/middleware của Battle Simulator).
