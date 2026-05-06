// ============================================================================
// @shoki/engine — ENGINE QUẢN LÝ ENTITY (THỰC THỂ GAME)
// ============================================================================
//
// Module cung cấp pattern Entity+Variables+Saga cho mỗi người chơi.
// Mỗi PlayerEntity = 1 Redux Store riêng + Saga middleware riêng.
//
// ┌─────────────────────────────────────────────────────────────────┐
// │ CẤU TRÚC:                                                     │
// │ src/                                                           │
// │ ├── entity/                                                    │
// │ │   ├── entity.ts         ← Tạo entity (Redux store + saga)   │
// │ │   ├── variablesStore.ts ← Đọc/ghi biến ngoài Redux          │
// │ │   └── dependency.ts     ← Inject dependencies vào saga      │
// │ └── utility/                                                   │
// │     └── index.ts          ← Utility functions cho bot AI       │
// │         (scoring, createUtilityValue)                          │
// └─────────────────────────────────────────────────────────────────┘
//
// HƯỚNG DẪN SỬA:
//   Thêm biến mới cho player    → dùng updateVariables<PlayerVariables>(...)
//   Inject dependency mới       → dùng getDependency(...)
//   Tạo hàm đánh giá mới cho bot → dùng createUtilityValue(...)
// ============================================================================

/** Đọc/ghi biến entity (ví dụ: name, finishPosition...) — File: src/entity/variablesStore.ts */
export { getVariable, updateVariables } from "./src/entity/variablesStore";

/** Tạo entity (wrapper Redux store + saga) — File: src/entity/entity.ts */
export { type Entity, entity, entityFactory } from "./src/entity/entity";

/** Inject dependency vào saga context — File: src/entity/dependency.ts */
export { getDependency } from "./src/entity/dependency";

/** Utility scoring cho bot AI — File: src/utility/index.ts */
export {
  createUtilityValue,
  type UtilityNumberValue,
  ScoringDirection,
} from "./src/utility";
