// ============================================================================
// @creature-chess/models — KIỂU DỮ LIỆU & CONSTANTS CỦA GAME
// ============================================================================
//
// Module chứa TẤT CẢ type/interface/enum dùng chung trong toàn project.
//
// ┌─────────────────────────────────────────────────────────────────┐
// │ CẤU TRÚC:                                                     │
// │ src/                                                           │
// │ ├── card.ts               ← Kiểu Card (thẻ bài trong shop)    │
// │ ├── piece.ts              ← ★ PieceModel (quân cờ trên board)  │
// │ ├── playerPieceLocation.ts ← Vị trí quân: "board" hoặc "bench"│
// │ ├── game-phase.ts         ← Enum GamePhase (PREPARING, READY,  │
// │ │                           PLAYING)                          │
// │ ├── roundInfoState.ts     ← Trạng thái round hiện tại          │
// │ ├── position.ts           ← ★ TileCoordinates, khoảng cách,   │
// │ │                           hướng tương đối                   │
// │ ├── creatureDefinition.ts ← ★ CreatureDefinition, CreatureStats│
// │ │                           AttackType, attackTypes            │
// │ ├── quickChat.ts          ← Chat nhanh (emote) options          │
// │ └── builders/             ← Builder functions tạo piece/card    │
// └─────────────────────────────────────────────────────────────────┘
//
// ⚠ CÁC FILE QUAN TRỌNG TRONG THƯ MỤC CON (không export ở đây):
//   gamemode/traits.ts   ← Danh sách TraitId ("fire", "water"...)
//   config.ts            ← Hằng số: MAX_LEVEL, PIECES_TO_EVOLVE,
//                          GAME_PHASE_LENGTHS...
//   settings.ts          ← GamemodeSettings interface
//   game/playerList.ts   ← PlayerStatus enum
//
// HƯỚNG DẪN SỬA:
//   Thêm thuộc tính quân cờ  → src/piece.ts (PieceModel)
//   Thêm stat mới            → src/creatureDefinition.ts (CreatureStats)
//   Thêm hệ nguyên tố       → gamemode/traits.ts + battle/utils/typeRelations.ts
//   Đổi max level, giờ phase → config.ts
// ============================================================================

/** Thẻ bài (shop) — File: src/card.ts */
export type { Card } from "./src/card";

/** ★ Quân cờ trên bàn (data model chính) — File: src/piece.ts */
export type { PieceModel, IndexedPieces, AttackDetails } from "./src/piece";

/** Vị trí quân: { type: "board"|"bench", location: {x,y} } — File: src/playerPieceLocation.ts */
export type { PlayerPieceLocation } from "./src/playerPieceLocation";

/** Enum pha game: PREPARING=0, READY=1, PLAYING=2 — File: src/game-phase.ts */
export { GamePhase } from "./src/game-phase";

/** Thông tin round hiện tại — File: src/roundInfoState.ts */
export type { RoundInfoState } from "./src/roundInfoState";

/** Tọa độ, khoảng cách, hướng — File: src/position.ts */
export {
  TileType,
  type TileCoordinates,
  Directions,
  type SlotLocation,
  createTileCoordinates,
  getDistance,       // Khoảng cách Manhattan giữa 2 ô
  getDelta,          // Delta (dx, dy) giữa 2 ô
  getRelativeDirection, // Hướng tương đối (UP/DOWN/LEFT/RIGHT)
} from "./src/position";

/** ★ Định nghĩa loại quân + stats + kiểu tấn công — File: src/creatureDefinition.ts */
export {
  type CreatureDefinition,
  type CreatureStats,
  type AttackType,
  attackTypes,      // Các kiểu tấn công có sẵn (melee range=1, ranged range=2,3...)
} from "./src/creatureDefinition";

/** Chat nhanh (emote) — File: src/quickChat.ts */
export {
  QuickChatOption,
  type QuickChatValue,
  ReadyQuickChatOptions,
  FinishedQuickChatOptions,
} from "./src/quickChat";

/** Builder utilities tạo piece/card — File: src/builders/ */
export * as Builders from "./src/builders";
