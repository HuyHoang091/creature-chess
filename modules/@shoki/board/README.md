// ============================================================================
// @shoki/board — HỆ THỐNG BÀN CỜ (BOARD / GRID)
// ============================================================================
//
// Module lõi quản lý bàn cờ dạng lưới 2D.
// Board dùng 2 Map riêng biệt:
//   - pieces:          { pieceId → PieceData }    → "quân nào tồn tại"
//   - piecePositions:  { "x,y"  → pieceId }       → "quân nào ở đâu"
//
// ┌─────────────────────────────────────────────────────────────────┐
// │ CẤU TRÚC THƯ MỤC:                                             │
// │ src/                                                           │
// │ ├── types.ts          ← BoardState, PiecePosition, HasId      │
// │ ├── state.ts          ← ★ TẤT CẢ reducers/commands cho board  │
// │ │     (add, move, remove, update, swap, lock, setBoardSize)    │
// │ ├── selectors.ts      ← Các hàm đọc: getPiece, getPosition,  │
// │ │     getAllPieces, getFirstEmptySlot                          │
// │ ├── positionSort.ts   ← Hàm sắp xếp vị trí (top→bottom,      │
// │ │     middle first)                                           │
// │ └── utils/                                                     │
// │     ├── mergeBoards.ts    ← Gộp 2 board thành 1 (cho battle)  │
// │     ├── cloneBoard.ts     ← Deep copy board                   │
// │     ├── rotateGridPosition.ts ← Xoay vị trí quân (cho away)  │
// │     └── filter.ts         ← Lọc pieces/positions theo ID      │
// └─────────────────────────────────────────────────────────────────┘
//
// HƯỚNG DẪN SỬA:
//   Thay đổi kích thước mặc định  → src/state.ts (createInitialBoardState)
//   Thêm command mới cho board     → src/state.ts (createBoardSlice → reducers)
//   Thêm selector mới              → src/selectors.ts
//   Đổi logic merge 2 board        → src/utils/mergeBoards.ts
// ============================================================================

/** Kiểu dữ liệu board — File: src/types.ts */
export type {
  BoardState,
  PiecesState as BoardPiecesState,
  HasId,
  PiecePosition,
} from "./src/types";

/** Tạo board mới + tất cả commands (add/move/remove...) — File: src/state.ts */
export {
  type BoardSlice,
  createInitialBoardState,
  createBoardSlice,
} from "./src/state";

/** Selectors đọc dữ liệu board — File: src/selectors.ts */
export * as BoardSelectors from "./src/selectors";

/** Gộp 2 board thành 1 (dùng trước khi battle) — File: src/utils/mergeBoards.ts */
export { mergeBoards } from "./src/utils/mergeBoards";

/** Xoay vị trí quân 180° (cho player away) — File: src/utils/rotateGridPosition.ts */
export { rotatePiecesAboutCenter } from "./src/utils/rotateGridPosition";

/** Hàm sắp xếp ô trống — File: src/positionSort.ts */
export {
  topToBottomMiddleSortPositions,
  topLeftToBottomRightSortPositions,
} from "./src/positionSort";

/** Clone board (deep copy) — File: src/utils/cloneBoard.ts */
export { cloneBoard } from "./src/utils/cloneBoard";
