// ============================================================================
// @creature-chess/battle — HỆ THỐNG CHIẾN ĐẤU TỰ ĐỘNG (AUTO-BATTLE)
// ============================================================================
//
// Module này chứa TOÀN BỘ logic chiến đấu tự động (auto-battle) giữa 2 đội.
//
// ┌─────────────────────────────────────────────────────────────────────┐
// │ CẤU TRÚC THƯ MỤC:                                                │
// │                                                                    │
// │ src/                                                               │
// │ ├── battleSaga.ts          ← Vòng lặp trận đấu chính (game loop) │
// │ ├── commands.ts            ← Redux actions: start/pause/resume     │
// │ ├── events.ts              ← Events phát ra: turnEvent, finish     │
// │ ├── pathfinding.ts         ← ★ THUẬT TOÁN A* tìm đường            │
// │ │                                                                  │
// │ ├── targeting/                                                     │
// │ │   ├── provider/                                                  │
// │ │   │   ├── TargetProvider.ts      ← Interface chọn mục tiêu      │
// │ │   │   └── StandardTargetProvider.ts ← ★ Thuật toán chọn mục tiêu│
// │ │   │         (Sửa ở đây để đổi cách quân cờ chọn kẻ thù)        │
// │ │   └── utils/                                                     │
// │ │       ├── getTargetAttackPositions.ts ← Tính các ô trong tầm    │
// │ │       └── getLivingEnemies.ts     ← Lọc quân địch còn sống      │
// │ │                                                                  │
// │ ├── simulator/                                                     │
// │ │   ├── turnSimulator.ts   ← Mô phỏng 1 turn (sắp xếp theo tốc  │
// │ │   │                        độ, duyệt từng quân)                 │
// │ │   └── piece/                                                     │
// │ │       ├── simulate.ts    ← Xử lý 1 quân cờ: state → actions     │
// │ │       ├── doActions.ts   ← Thực thi danh sách actions            │
// │ │       ├── state/         ← ★ MÁY TRẠNG THÁI quân cờ             │
// │ │       │   ├── wander.ts  ← Trạng thái lang thang, tìm mục tiêu │
// │ │       │   ├── attack.ts  ← Trạng thái tấn công: kiểm tra tầm,  │
// │ │       │   │                tìm đường A*, đổi mục tiêu           │
// │ │       │   ├── dying.ts   ← Trạng thái hấp hối (chờ rồi xóa)   │
// │ │       │   ├── findBestState.ts ← Chuyển sang attacking nếu có   │
// │ │       │   │                       kẻ thù                        │
// │ │       │   └── types.ts   ← Định nghĩa PieceState, StateResult   │
// │ │       └── actions/       ← ★ CÁC HÀNH ĐỘNG quân cờ             │
// │ │           ├── hit.ts     ← ★ Đánh: tính damage, trừ HP, set CD │
// │ │           ├── move.ts    ← Di chuyển: đổi vị trí trên board     │
// │ │           ├── delete.ts  ← Xóa quân chết khỏi board             │
// │ │           └── types.ts   ← Định nghĩa MoveAction, HitAction...  │
// │ │                                                                  │
// │ ├── utils/                                                         │
// │ │   ├── getHitDamage.ts    ← ★ CÔNG THỨC SÁT THƯƠNG              │
// │ │   │     damage = ceil((ATK/DEF) * typeBonus * 8)                │
// │ │   ├── typeRelations.ts   ← ★ HỆ THỐNG KHẮC CHẾ ngũ hành       │
// │ │   │     overcomeBy = 1.7x, generatedBy = 0.3x                  │
// │ │   ├── getCooldownForSpeed.ts ← ★ COOLDOWN = ceil((180-spd)/24) │
// │ │   ├── inAttackRange.ts   ← Kiểm tra tầm đánh (chỉ ngang/dọc)  │
// │ │   ├── isATeamDefeated.ts ← Kiểm tra 1 đội đã thua chưa         │
// │ │   ├── getStats.ts        ← Lấy stats theo stage hiện tại        │
// │ │   ├── getNewAttackerFacingAway.ts ← Xoay hướng quân tấn công   │
// │ │   └── duration.ts        ← Timer đo thời gian giữa các turn     │
// │ │                                                                  │
// │ └── state/                                                         │
// │     ├── state.ts           ← PieceCombatState (cooldown data)      │
// │     └── store.ts           ← PieceInfoStore (Map lưu trữ combat)  │
// └─────────────────────────────────────────────────────────────────────┘
//
// HƯỚNG DẪN SỬA:
//   Đổi công thức damage     → src/utils/getHitDamage.ts
//   Đổi hệ khắc chế         → src/utils/typeRelations.ts
//   Đổi cooldown             → src/utils/getCooldownForSpeed.ts
//   Cho đánh chéo            → src/utils/inAttackRange.ts
//   Thêm trạng thái mới (stun, heal...) → src/simulator/piece/state/ (tạo file mới, đăng ký trong simulate.ts)
//   Thêm hành động mới       → src/simulator/piece/actions/ (tạo file mới, đăng ký trong index.ts)
//   Đổi cách chọn mục tiêu   → src/targeting/provider/StandardTargetProvider.ts
//   Đổi pathfinding           → src/pathfinding.ts
//   Đổi tốc độ/giới hạn turn → settings (GamemodeSettings), đọc trong battleSaga.ts
// ============================================================================

/** Saga chính chạy vòng lặp trận đấu — File: src/battleSaga.ts */
export { battleSaga } from "./src/battleSaga";

/** Events phát ra trong trận (turn xong, trận kết thúc) — File: src/events.ts */
export * as BattleEvents from "./src/events";

/** Commands điều khiển trận (bắt đầu, tạm dừng, tiếp tục) — File: src/commands.ts */
export * as BattleCommands from "./src/commands";

/** Type lưu trạng thái chiến đấu của từng quân (cooldown, state) — File: src/state/ */
export type { PieceInfoStore, PieceCombatState } from "./src/state";
