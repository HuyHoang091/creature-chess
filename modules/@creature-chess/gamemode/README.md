// ============================================================================
// @creature-chess/gamemode — LOGIC GAME CHÍNH (GAME LOOP, PLAYER, SHOP...)
// ============================================================================
//
// Module trung tâm quản lý TOÀN BỘ luồng game:
//   Preparing → Ready → Playing → lặp lại cho đến khi có người thắng.
//
// ┌─────────────────────────────────────────────────────────────────────┐
// │ CẤU TRÚC THƯ MỤC:                                                │
// │                                                                    │
// │ src/                                                               │
// │ ├── game/                                                          │
// │ │   ├── gamemode.ts       ← ★ CLASS CHÍNH: Gamemode               │
// │ │   │     Khởi tạo game, quản lý players, deck, opponent          │
// │ │   ├── match.ts          ← ★ CLASS Match: 1 trận đấu giữa 2 người│
// │ │   │     Merge board, chạy battleSaga, tính điểm                 │
// │ │   ├── cardDeck.ts       ← ★ HỆ THỐNG SHOP/GACHA                │
// │ │   │     Bảng tỷ lệ, roll, pool dùng chung                      │
// │ │   ├── opponentProvider.ts ← ★ THUẬT TOÁN GHÉP ĐÔI              │
// │ │   │     Round-robin rotation, xử lý chẵn/lẻ                    │
// │ │   ├── evolution.ts      ← Tính số quân để tiến hóa (3→1)       │
// │ │   ├── playerList.ts     ← Quản lý danh sách player online       │
// │ │   ├── events.ts         ← Game events (phase started, finish...) │
// │ │   ├── sagas.ts          ← Root saga cho game                     │
// │ │   ├── store.ts          ← Game Redux store                       │
// │ │   ├── publicEvents.ts   ← Events gửi cho client                 │
// │ │   ├── playerPropertyUpdates.ts ← Cập nhật tiền, XP, level       │
// │ │   ├── gameLoop/                                                  │
// │ │   │   ├── index.ts      ← ★ GAME LOOP chính (vòng lặp vô hạn)  │
// │ │   │   └── phases/                                                │
// │ │   │       ├── preparing.ts ← Pha chuẩn bị (mua tướng, sắp xếp) │
// │ │   │       ├── ready.ts     ← Pha sẵn sàng (ghép đôi, tạo match)│
// │ │   │       └── playing.ts   ← Pha chiến đấu (chạy battle)        │
// │ │   ├── roundInfo/        ← State round hiện tại                   │
// │ │   ├── readyNotifier/    ← Chờ tất cả player ready               │
// │ │   └── player/                                                    │
// │ │       └── playerGameDeckSaga.ts ← Saga quản lý deck cho player  │
// │ │                                                                  │
// │ ├── entities/                                                      │
// │ │   └── player/                                                    │
// │ │       ├── entity.ts     ← ★ PlayerEntity (Redux store riêng)     │
// │ │       ├── events.ts     ← Player events (death, finishMatch...)  │
// │ │       ├── selectors.ts  ← Đọc: board, level, health...          │
// │ │       ├── variables.ts  ← Player variables (name, position...)   │
// │ │       ├── dependencies.ts ← Inject settings, logger              │
// │ │       ├── state/                                                 │
// │ │       │   ├── selectors.ts ← getPlayerLevel, getMoney, isAlive  │
// │ │       │   └── playerInfo/  ← PlayerInfoState (health,money,xp)  │
// │ │       └── sagas/                                                 │
// │ │           ├── battle.ts    ← Player's battle processing          │
// │ │           └── phases/      ← Player logic per phase              │
// │ │                                                                  │
// │ ├── definitions/                                                   │
// │ │   └── index.ts          ← ★ DANH SÁCH TƯỚNG (47 con)            │
// │ │       Mỗi tướng: id, name, traits, cost                        │
// │ │       Sửa ở đây để thêm/đổi tướng                              │
// │ │                                                                  │
// │ ├── playerActions/        ← Các action người chơi gửi lên         │
// │ │   ├── buyCard.ts        ← Mua tướng từ shop                     │
// │ │   ├── buyXp.ts          ← Mua kinh nghiệm                      │
// │ │   ├── rerollCards.ts    ← Xoay shop                             │
// │ │   ├── sellPiece.ts      ← Bán tướng                             │
// │ │   ├── dropPiece.ts      ← Kéo thả tướng (bench↔board)           │
// │ │   ├── swapPiece.ts      ← Hoán đổi vị trí 2 tướng              │
// │ │   ├── readyUp.ts        ← Sẵn sàng (kết thúc preparing sớm)    │
// │ │   ├── quitGame.ts       ← Thoát game                            │
// │ │   ├── spectate.ts       ← Xem game người khác                   │
// │ │   ├── toggleShopLock.ts ← Khóa/mở khóa shop                    │
// │ │   └── quickChat.ts      ← Gửi emote                             │
// │ │                                                                  │
// │ ├── features/             ← Feature modules                       │
// │ │   └── match/            ← Quản lý match cho player               │
// │ │                                                                  │
// │ └── player/               ← Thêm helper selectors, xp logic       │
// └─────────────────────────────────────────────────────────────────────┘
//
// HƯỚNG DẪN SỬA:
//   Thêm/sửa tướng mới              → src/definitions/index.ts
//   Đổi tỷ lệ shop, pool            → src/game/cardDeck.ts (CARD_COST_CHANCES, CARD_LEVEL_QUANTITIES)
//   Đổi cách ghép đôi               → src/game/opponentProvider.ts
//   Đổi thời gian mỗi pha           → @creature-chess/models/config.ts (GAME_PHASE_LENGTHS)
//   Thêm player action mới          → src/playerActions/ (tạo file, đăng ký trong index.ts)
//   Đổi logic trừ HP khi thua       → src/entities/player/state/playerInfo/
//   Đổi XP/level lên                → src/player/xp.ts + src/game/playerPropertyUpdates.ts
//   Đổi số quân tiến hóa (3→2)      → src/game/evolution.ts + @creature-chess/models/config.ts
// ============================================================================

// --- Game Controller ---
/** ★ Class Gamemode chính — File: src/game/gamemode.ts */
export { Gamemode } from "./src/game";

/** Class Match (1 trận đấu) — File: src/game/match.ts */
export { Match } from "./src/game/match";

// --- Player Entity & State ---
/** PlayerEntity (mỗi player = 1 Redux store riêng) — File: src/entities/player/entity.ts */
export {
  type PlayerEntity,
  playerEntity,
  PlayerEntitySelectors,
  type PlayerState,
  PlayerStateSelectors,
  playerReducers,
  PlayerCommands,
  getPlayerEntityDependencies,
  type PlayerEntityDependencies,
  PlayerEvents,
  type PlayerVariables,
} from "./src/entities/player";

/** PlayerInfo state (health, money, level, xp) — File: src/entities/player/state/playerInfo/ */
export {
  type PlayerInfoState,
  playerInfoReducer,
  type PlayerMatchRewards,
} from "./src/entities/player/state/playerInfo";

// --- Player Actions (gửi từ client) ---
/** Tất cả actions: buy, sell, drop, reroll, ready... — File: src/playerActions/ */
export { type PlayerAction, PlayerActionTypesArray } from "./src/playerActions";
export * as PlayerActions from "./src/playerActions";

// --- Selectors ---
/** Đọc quân cờ từ state — File: src/player/pieceSelectors.ts */
export { getPiece, getAllPieces } from "./src/player/pieceSelectors";
/** Đọc level, money, xp, alive — File: src/entities/player/state/selectors.ts */
export {
  getPlayerLevel,
  getPlayerMoney,
  getPlayerXp,
  isPlayerAlive,
} from "./src/entities/player/state/selectors";

// --- Round Info ---
/** State và commands cho thông tin round — File: src/game/roundInfo/ */
export { roundInfoReducer, RoundInfoCommands } from "./src/game/roundInfo";

// --- Events ---
/** Game-level events (phase changed, game finished...) — File: src/game/events.ts */
export * as GameEvents from "./src/game/events";

// --- Definitions (Danh sách tướng) ---
/** ★ Danh sách 47 tướng — File: src/definitions/index.ts — SỬA ĐÂY để thêm tướng */
export { getDefinitionById, getAllDefinitions } from "./src/definitions";
