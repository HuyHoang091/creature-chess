// ============================================================================
// CREATURE CHESS - ARCHITECTURE REFERENCE (Tài liệu tham khảo kiến trúc)
// ============================================================================
// File này KHÔNG phải code chạy được.
// Nó là bản tập hợp, đơn giản hóa & comment lại TOÀN BỘ logic cốt lõi
// của project Creature Chess để dễ đọc, dễ tìm, dễ sửa.
//
// Cấu trúc file:
//   PHẦN 1: Các kiểu dữ liệu cơ bản (Types / Models)
//   PHẦN 2: Hệ thống Board (Bàn cờ)
//   PHẦN 3: Hệ thống Card Deck (Bộ bài / Shop)
//   PHẦN 4: Hệ thống Battle (Chiến đấu) ← CỐT LÕI NHẤT
//     4.1: Pathfinding (Tìm đường A*)
//     4.2: Targeting (Chọn mục tiêu)
//     4.3: Damage & Type Relations (Sát thương & Khắc chế)
//     4.4: Cooldown (Hồi chiêu)
//     4.5: State Machine (Máy trạng thái quân cờ)
//     4.6: Actions (Hành động: Move, Hit, Delete)
//     4.7: Turn Simulator (Mô phỏng lượt)
//     4.8: Battle Saga (Vòng lặp trận đấu)
//   PHẦN 5: Hệ thống Match (Trận đấu giữa 2 người chơi)
//   PHẦN 6: Hệ thống Ghép đôi (Opponent Provider)
//   PHẦN 7: Hệ thống Game Loop (Vòng lặp game chính)
//   PHẦN 8: Bot AI (Trí tuệ nhân tạo)
//   PHẦN 9: Evolution (Tiến hóa / Nâng cấp sao)
// ============================================================================
