# Plan: Tận dụng RAG cho Creature Chess

## 1. Ý kiến về phân tích hiện tại

Phân tích `analysis-llm-rag-and-game-structure.md` đã đúng hướng:
- **Đúng**: Không viết lại battle simulator, dùng `@creature-chess/battle` có sẵn.
- **Đúng**: Không cần vector search phức tạp cho game guides — static markdown + keyword matching là đủ.
- **Đúng**: Module nên đặt tên `tactical-ai` thay vì `llm-rag` cho rõ domain.
- **Cần bổ sung**: Phân tích chưa đề cập cụ thể **các chức năng RAG thực tế** cho người chơi. Cần liệt kê feature-by-feature thay vì chỉ architecture.

## 2. Kiến trúc RAG cho Game (Dùng Kreuzberg)

Kreuzberg là thư viện Python xử lý document (extract + chunk + embed) trong 1 call. Giữ RAG là Python service, game server TypeScript gọi qua HTTP.

```
# === TypeScript: Game Logic + Positioning Advisor ===
modules/@creature-chess/tactical-ai/src/
├── positioning-advisor/         # Gợi ý xếp quân dùng RL bot + simulation
│   ├── advisor.ts
│   ├── simulation/
│   │   ├── scenario-generator.ts  # Kịch bản đối thủ từ preset
│   │   ├── battle-runner.ts       # Wrap @creature-chess/battle
│   │   └── win-rate-calculator.ts # Tính win rate + margin
│   ├── strategy-picker.ts       # Chọn nước đi cân bằng
│   └── types.ts
│
├── integration/
│   ├── game-server-plugin.ts    # WebSocket plugin
│   └── websocket-handlers.ts
│
└── types/                       # Shared types
    └── tactical.ts

# === Python: RAG Service (dùng Kreuzberg) ===
llm-rag/
├── data/
│   └── game-guides/             # Static markdown guides
│       ├── builds.md
│       ├── counters.md
│       ├── economy.md
│       ├── items.md
│       ├── formations.md
│       ├── ai-rules.md
│       └── publisher-info.md
│
├── kreuzberg_rag/               # NEW: RAG engine dùng Kreuzberg
│   ├── __init__.py
│   ├── document_processor.py    # extract_file() + ChunkingConfig
│   ├── embedder.py              # sentence-transformers (e5-base-v2)
│   ├── retriever.py             # rank_bm25 + cosine similarity
│   ├── coach_engine.py          # Build context + gọi LLM
│   └── api.py                   # FastAPI endpoints
│
├── rag/                         # Có sẵn, tái sử dụng prompts/ + llm/
│   ├── prompts/
│   └── llm/
│
└── requirements.txt             # Thêm kreuzberg
```

## 3. Các chức năng RAG cụ thể

### 3.1. Build Advisor
**Mô tả**: Gợi ý build team dựa trên quân hiện có và meta.
**Input**: `PieceModel[]` đang sở hữu.
**RAG Flow**:
1. Extract `traits` từ pieces → xác định synergies đang có.
2. Query `builds.md` + `counters.md` theo synergy tag.
3. LLM generate: "Bạn đang có 3 Fire + 2 Water, hướng tới 6 Fire với carry X..."

### 3.2. Counter Formation Advisor *(RAG-based)*
**Mô tả**: Gợi ý xếp quân để counter đội hình đối thủ **dựa trên tài liệu guides**.
**Input**: `enemyBoard: PieceModel[]`.
**RAG Flow**:
1. Detect enemy archetype (assassin-heavy, tank front, ranged backline).
2. Query `formations.md` theo enemy archetype tag.
3. LLM generate: "Đối thủ có 4 assassin → dùng anti-jump formation, đặt carry vào góc..."

> **Lưu ý**: Khác với 3.6 — đây là **gợi ý từ tài liệu** (kiểu "theo guide thì nên làm gì"), không chạy simulation.

### 3.3. Item Recommendation
**Mô tả**: Gợi ý item cho từng quân cụ thể.
**Input**: `PieceModel` (có definitionId, current items).
**RAG Flow**:
1. Query `items.md` theo `definitionId` hoặc role (tank/carry/assassin).
2. LLM generate: "Quân X là carry melee → Bloodthirster + GA là tối ưu..."

### 3.4. Economy Coach
**Mô tả**: Gợi ý quản lý gold, reroll, level up.
**Input**: round number, current gold, health, board state.
**RAG Flow**:
1. Query `economy.md` theo game phase (early/mid/late).
2. LLM generate: "Round 3-2, 50 gold, HP > 70 → econ chậm, reroll ở level 7..."

### 3.5. Post-Battle Analysis
**Mô tả**: Giải thích tại sao thua và đề xuất cải thiện.
**Input**: battle replay data (damage dealt/taken, positioning, item diff).
**RAG Flow**:
1. Extract key issues (carry died first, no frontline, item wasted).
2. Query `guides/*.md` theo issue tag.
3. LLM generate: "Carry bị assassin dive → cần reposition hoặc thêm tank item..."

### 3.6. Positioning Advisor (Dùng RL Bot + Simulation)
**Mô tả**: Gợi ý xếp quân tối ưu bằng cách **chạy battle simulation thực tế** với đối thủ hiện tại, hiển thị tỷ lệ thắng và nước đi 1-click.
**Input**: `myBoard: PieceModel[]` + `enemyBoard: PieceModel[]` (đối thủ sắp đấu, game biết trước).

**Flow**:
1. `PPOAgent.act(state)` nhiều lần với temperature cao → generate K phương án xếp quân cho **team mình**.
2. **Generate kịch bản đối thủ** — vì đối thủ có thể thay đổi trong thời gian chờ:
   - Đổi vị trí 1-2 quân cờ ngẫu nhiên trên bàn đối thủ.
   - Thay 1 quân cờ (swap definitionId giữa 2 vị trí).
   - Gắn thêm 1 item vào 1 quân cờ (giả định đối thủ vừa craft item).
   - Giữ nguyên bàn đối thủ (trường hợp không đổi gì).
3. Mỗi phương án của team mình battle thử với tất cả kịch bản đối thủ (dùng `@creature-chess/battle`).
4. Mỗi cặp chạy X lần (Monte Carlo, vì battle có RNG) → tính `avgWinRate`, `avgSurvivorMargin`.
5. **Strategy Picker** chọn nước đi cân bằng:
   - Loại win rate > 85% (quá mạnh, phá cân bằng game).
   - Loại win rate < 40% (quá yếu, không hữu ích).
   - Chọn phương án **55-70% win rate** + margin dương vừa phải.
   - Ưu tiên phương án ổn định (variance thấp nhất giữa các kịch bản đối thủ).
6. **Output cho client**:
```typescript
interface PositioningAdvice {
  formation: string;
  adjustment: string;
  winRate: number;           // Tỷ lệ thắng TB qua tất cả kịch bản đối thủ
  avgSurvivorMargin: number;
  confidence: "low" | "medium" | "high";
  moves: DropPieceAction[];  // Mã agent 1-click apply ngay
  explanation: string;       // VD: "Xếp tank front giúp bảo vệ carry vs địch assassin, tỷ lệ thắng 62%"
  alternatives: Array<{ formation: string; winRate: number }>;
  testedScenarios: number;    // Số kịch bản đối thủ đã test
}
```

## 4. Tận dụng từ llm-rag hiện tại

| Thành phần llm-rag | Tận dụng cho Game |
|---|---|
| `rag/llm/chat_model.py` | Client gọi OpenAI/OpenRouter → migrate sang `src/llm/client.ts` |
| `rag/prompts/` | Template system → dùng cho tactical/system/ai-rules prompts |
| `rag/nlp/query.py` | Query reformulation → dùng cho user intent parsing |
| `rag/utils/redis_conn.py` | Cache coach responses theo board hash |
| **`Kreuzberg`** | Extract + chunk + parse markdown/PDF/... trong 1 call. Thay toàn bộ `rag/flow/` |
| `rank_bm25` | BM25 retriever cho game guides (nhẹ, không cần Haystack) |
| `sentence-transformers` (e5-base-v2) | Generate embeddings cho semantic search |

## 5. Không tận dụng (domain khác hoặc thay thế)

- **Haystack service** (InMemoryDocumentStore, full pipeline) → **Không dùng**. Thay bằng Kreuzberg + `rank_bm25` + embeddings đơn giản.
- **LangChain service** (streaming chat nhân viên bán quần áo) → **Không dùng**. Thay bằng tactical coach với system prompt mới.
- **OpenSearch/Elasticsearch** (vector store) → **Không dùng**. Data ít, dùng in-memory array + embeddings.
- **MySQL indexing** → **Không dùng**. Guides là static markdown, đọc file trực tiếp.
- **All `rag/app/*`** (audio, book, email, laws) → không liên quan.

## 6. Implementation Priority

| Priority | Feature | Effort | Impact |
|---|---|---|---|
| P0 | Positioning Advisor (RL bot + simulation) | 3-4 ngày | Giúp player xếp quân + cân bằng game |
| P0 | Static guides (`guides/*.md`) + Kreuzberg processor | 1 ngày | Cung cấp knowledge base |
| P1 | RAG retriever (BM25 + semantic từ Kreuzberg chunks) | 1-2 ngày | Core retrieval engine |
| P1 | Build Advisor + Counter Formation | 2-3 ngày | Giúp người chơi improve nhanh |
| P2 | Item Recommendation | 1-2 ngày | Tăng depth gameplay |
| P2 | AI Rules + Publisher Info (`ai-rules.md`, `publisher-info.md`) | 0.5 ngày | Kiểm soát phạm vi AI |
| P3 | Economy Coach | 1-2 ngày | Giảm barrier to entry |
| P4 | Post-Battle Analysis | 2-3 ngày | Educational, retain players |

## 7. Tech Stack đề xuất

- **Language**: TypeScript (align với monorepo).
- **LLM**: OpenRouter (`gpt-3.5-turbo` hoặc `claude-3-haiku` cho low latency).
- **Document Processing**: [Kreuzberg](https://pypi.org/project/kreuzberg/) (Python) — `extract_file()` + `ChunkingConfig(chunker_type="markdown")` xử lý extract → parse → split trong 1 call.
- **Retrieval**: `rank_bm25` + sentence-transformers embeddings. Không cần Haystack/OpenSearch.
- **RAG Service**: Python FastAPI microservice (`llm-rag/kreuzberg_rag/`), game server gọi qua HTTP.
- **Cache**: Redis hoặc in-memory LRU cho repeated board states.
- **Integration**: WebSocket plugin trong `apps/server-game`.

---

**Created**: 2026-05-13
**Status**: Plan Draft
**Next Step**: Approve plan → implement P0 (guides + retriever).
