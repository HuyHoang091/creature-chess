// ============================================================================
// @cc-server/bot — TRÍ TUỆ NHÂN TẠO BOT (AI)
// ============================================================================
//
// Module điều khiển bot chơi tự động trong pha chuẩn bị.
// THUẬT TOÁN: Utility-Based AI — chấm điểm mọi action → chọn cao nhất.
//
// ┌─────────────────────────────────────────────────────────────────────┐
// │ CẤU TRÚC THƯ MỤC:                                                │
// │                                                                    │
// │ src/                                                               │
// │ ├── saga.ts               ← ★ ENTRY POINT: botLogicSaga           │
// │ │     Lắng nghe gamePhaseStartedEvent → gọi preparingPhase        │
// │ ├── actions.ts            ← ★ THUẬT TOÁN CHỌN HÀNH ĐỘNG           │
// │ │     getActions(): tạo tất cả actions → chấm điểm → sort → chọn │
// │ ├── putBenchOnBoard.ts    ← ★ ĐƯA TƯỚNG TỪ BENCH LÊN BOARD      │
// │ │     Dùng PREFERRED_LOCATIONS để chọn vị trí tối ưu             │
// │ ├── preferredLocations.ts ← ★ VỊ TRÍ ƯU TIÊN cho từng class      │
// │ │     valiant: hàng đầu, giữa board                              │
// │ │     cunning: hàng đầu, rìa board                               │
// │ │     arcane:  hàng giữa/sau                                     │
// │ ├── constants.ts          ← BOT_ACTION_TIME_MS (delay giữa action)│
// │ │                                                                  │
// │ ├── brain/                                                         │
// │ │   └── action.ts         ← BrainAction type + BrainActionValue   │
// │ │       USELESS=-∞, MEDIUM=0, HIGH=1K, VERY_HIGH=1M, PRICELESS=+∞│
// │ │                                                                  │
// │ └── preparingPhase/                                                │
// │     ├── index.ts          ← Luồng preparing: loop lấy action →    │
// │     │                       thực thi → putBenchOnBoard → lặp lại  │
// │     ├── shouldBuyXp.ts    ← ★ Quyết định mua XP hay không         │
// │     │     Giữ >= 10 vàng, nếu gần lên lv thì >= 5 vàng          │
// │     └── actions/                                                   │
// │         ├── buyCard.ts    ← Chấm điểm action mua tướng            │
// │         ├── buyXp.ts      ← Chấm điểm action mua XP              │
// │         ├── rerollCards.ts ← Chấm điểm action reroll shop         │
// │         ├── sellPiece.ts  ← Chấm điểm action bán tướng bench     │
// │         └── sellBoardPiece.ts ← Chấm điểm action bán tướng board │
// └─────────────────────────────────────────────────────────────────────┘
//
// HƯỚNG DẪN SỬA:
//   Bot thông minh hơn (mua/bán) → src/preparingPhase/actions/*.ts (đổi hàm chấm điểm)
//   Đổi vị trí đặt tướng         → src/preferredLocations.ts
//   Đổi ngưỡng giữ tiền          → src/preparingPhase/shouldBuyXp.ts (MINIMUM_MONEY)
//   Thêm action mới cho bot      → tạo file trong src/preparingPhase/actions/, đăng ký trong src/actions.ts
//   Đổi delay giữa action        → src/constants.ts (BOT_ACTION_TIME_MS)
//   Thêm personality mới         → @cc-server/data (BotPersonality type)
// ============================================================================

/** ★ Saga chính của bot — File: src/saga.ts */
export { botLogicSaga } from "./src/saga";
