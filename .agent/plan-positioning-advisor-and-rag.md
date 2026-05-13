# Plan: Positioning Advisor + Real RAG Integration

## Phần 1: Positioning Advisor (Dùng RL Bot)

### 1.1. Mục tiêu
- Dùng model RL hiện có (`PPOAgent`) để generate nhiều phương án xếp quân.
- Mỗi phương án battle thử với **N kịch bản đối thủ** từ `fixedBattleBenchmark`.
- Tính **tỷ lệ thắng trung bình** và **survivor margin** cho từng phương án.
- Không chọn phương án "tốt nhất" (tránh bot quá mạnh làm mất cân bằng game).
- Chọn phương án **"cân bằng nhất"** (ví dụ: 60-70% win rate + margin vừa phải).
- Hiển thị cho client: `tỷ lệ thắng` + `nước đi` + `mã agent 1-click` để apply ngay.

### 1.2. Kiến trúc module
```
modules/@creature-chess/positioning-advisor/
├── src/
│   ├── index.ts
│   ├── advisor.ts              # Entry point: nhận board, trả về gợi ý
│   ├── simulation/
│   │   ├── scenario-generator.ts # Generate kịch bản đối thủ từ preset
│   │   ├── battle-runner.ts      # Wrap @creature-chess/battle để chạy nhanh
│   │   └── win-rate-calculator.ts # Tính tỷ lệ thắng + margin
│   ├── strategy-picker.ts      # Chọn nước đi cân bằng (không phải tối ưu)
│   └── types.ts                # Types cho advisor
├── tests/
│   └── advisor.test.ts
└── package.json
```

### 1.3. Flow chi tiết

```
Player Board (PieceModel[])
  → RL Agent.act(state) multiple times với temperature cao
    → Generate K phương án xếp quân (formation + adjustment)
  → Với mỗi phương án:
    → Battle thử với N kịch bản đối thủ (preset từ fixedBattleBenchmark)
    → Mỗi kịch bản chạy X lần (Monte Carlo)
    → Tính: avgWinRate, avgSurvivorMargin, avgHpMargin
  → Strategy Picker:
    → Loại bỏ phương án win rate > 85% (quá mạnh, mất cân bằng)
    → Loại bỏ phương án win rate < 40% (quá yếu, không hữu ích)
    → Chọn phương án có win rate trong khoảng 55-70% **và** survivor margin dương nhưng không quá cao
    → Nếu có nhiều phương án, chọn phương án có variance thấp nhất (ổn định)
  → Output cho client:
    {
      recommendedFormation: string,
      recommendedAdjustment: string,
      winRate: number,           // Tỷ lệ thắng trung bình
      avgSurvivorMargin: number,
      confidence: "low" | "medium" | "high",
      moves: { pieceId, from, to }[],  // Mã agent 1-click
      alternatives: [...]        // 2-3 phương án khác để player tự chọn
    }
```

### 1.4. API / WebSocket cho Client
```typescript
// Server -> Client
interface PositioningAdvice {
  formation: string;
  adjustment: string;
  winRate: number;
  margin: number;
  confidence: string;
  moves: DropPieceAction[];     // Có thể dispatch trực tiếp
  explanation: string;         // Ngắn gọn: "Xếp tank front giúp bảo vệ carry, tỷ lệ thắng 62%"
  alternatives: Array<{
    formation: string;
    winRate: number;
  }>;
}

// Client gửi request khi vào Preparing Phase
socket.emit('REQUEST_POSITIONING_ADVICE', {
  boardState: currentBoard,
  enemyBoardPreview: lastEnemyBoard  // Nếu có
});

// Server trả về
socket.emit('POSITIONING_ADVICE', advice);

// Client 1-click apply
socket.emit('APPLY_POSITIONING_ADVICE', { adviceId });
```

### 1.5. Tích hợp vào game server
- Thêm handler vào `apps/server-game/src/server.ts` hoặc tạo plugin riêng.
- Chỉ kích hoạt ở phase `PREPARING`.
- Có thể là feature **tùy chọn** (player bật/tắt trong settings).

---

## Phần 2: RAG Thực Sự (Dùng lại llm-rag)

### 2.1. Mục tiêu
- Tận dụng Haystack + LangChain hiện có thay vì viết lại.
- Chuyển domain từ "bán quần áo" → "Creature Chess game assistant".
- Thêm **luật AI** để tránh trả lời ngoài lề/vi phạm.
- Thêm **tài liệu nhà phát hành** (thông tin công ty, chính sách, liên hệ).

### 2.2. Cấu trúc RAG mới
```
llm-rag/
├── haystack-service/           # Giữ nguyên, đổi data source
│   ├── data/
│   │   ├── game-guides/        # Markdown guides (builds, synergies, items...)
│   │   ├── ai-rules.md        # Luật AI: chỉ trả lời về game
│   │   └── publisher-info.md  # Thông tin nhà phát hành
│   ├── app.py                 # Đổi system prompt
│   └── services/
│       └── rag_service.py     # Đổi prompt template
│
├── langchain-service/         # Giữ nguyên, đổi system prompt
│   └── main.py
│
└── rag/                       # Core (có thể tái sử dụng)
    ├── prompts/               # Đổi template sang game domain
    └── llm/
        └── chat_model.py      # Có thể dùng lại
```

### 2.3. Dữ liệu RAG

#### a) Game Guides (static markdown)
```markdown
# builds.md
## Fire Synergy Build
- Core: Fire Demon (id:42), Phoenix (id:47)
- Frontline: Lava Golem (id:39)
- Item: Sunfire Cape, Inferno Blade
- Counter: Water synergy

## Economy Guide
- Early: Save gold đến 50, không reroll trước round 3-2
- Mid: Level up tại 3-2 hoặc 4-1 tùy HP
- Late: Roll down ở level 8-9 tìm legendary
```

#### b) AI Rules (`ai-rules.md`)
```markdown
# AI Assistant Rules
1. CHỈ trả lời về Creature Chess game.
2. Nếu câu hỏi không liên quan đến game (chính trị, tôn giáo, y tế...), lịch sự từ chối.
3. Không đưa ra lời khuyên cá nhân ngoài phạm vi game.
4. Không chia sẻ thông tin nội bộ/dev.
5. Khuyến khích fair play, không hỗ trợ hack/cheat.
6. Trả lời bằng tiếng Việt hoặc tiếng Anh tùy ngôn ngữ người dùng.
```

#### c) Publisher Info (`publisher-info.md`)
```markdown
# Thông tin nhà phát hành
- Tên: [Tên công ty]
- Website: [URL]
- Email hỗ trợ: [email]
- Chính sách bảo mật: [URL]
- Điều khoản sử dụng: [URL]
- Fanpage: [URL]
```

### 2.4. Indexing dữ liệu
- Chạy 1 lần: convert markdown → JSON → index vào Haystack.
- Hoặc để đơn giản: đọc file trực tiếp, không cần vector DB (vì data ít).

```python
# Simplified: Không cần MySQL
from pathlib import Path

def load_game_guides():
    guides_dir = Path("data/game-guides")
    documents = []
    for md_file in guides_dir.glob("*.md"):
        content = md_file.read_text()
        documents.append({
            "content": content,
            "meta": {
                "source": str(md_file),
                "category": md_file.stem,
                "type": "game_guide"
            }
        })
    return documents
```

### 2.5. System Prompt mới (LangChain)
```python
SYSTEM_PROMPT = """Bạn là trợ lý AI của game Creature Chess - game auto-battle chiến thuật.
Nhiệm vụ: giúp người chơi hiểu game mechanics, build team, xếp quân, và economy.

QUY TẮC:
1. Chỉ trả lời về Creature Chess. Nếu câu hỏi ngoài lề, lịch sự từ chối.
2. Dựa HOÀN TOÀN vào tài liệu được cung cấp (game guides).
3. Trả lời ngắn gọn, súc tích, dễ hiểu.
4. Khuyến khích người chơi tự khám phá, không spoil quá nhiều.
5. Nếu không biết, thành thật nói không biết.

Ngôn ngữ: Trả lời bằng ngôn ngữ người dùng đang dùng."""
```

### 2.6. Endpoints cho Game
```
POST /rag/chat           # Chat với AI assistant
POST /rag/positioning    # (Tùy chọn) Gộp positioning advisor vào RAG
GET  /rag/guides/{topic} # Lấy guide cụ thể (builds, items, economy)
GET  /rag/publisher      # Thông tin nhà phát hành
```

### 2.7. Tích hợp vào Client
- Thêm "AI Assistant" button trong game UI.
- Chat panel hiển thị streaming response.
- Có thể hỏi: "Build gì với 3 Fire 2 Water?", "Item nào cho carry?", "Tại sao tôi thua?"

---

## Phần 3: Implementation Priority

| Priority | Task | Module | Effort |
|----------|------|--------|--------|
| P0 | Tạo `positioning-advisor` module với RL simulation | `@creature-chess/positioning-advisor` | 3-4 ngày |
| P0 | Tích hợp advisor vào game server WebSocket | `apps/server-game` | 1-2 ngày |
| P1 | Chuyển đổi RAG system prompt sang game domain | `llm-rag/langchain-service` | 1 ngày |
| P1 | Viết game guides (markdown) | `llm-rag/haystack-service/data/` | 2-3 ngày |
| P1 | Thêm `ai-rules.md` và `publisher-info.md` | `llm-rag/haystack-service/data/` | 0.5 ngày |
| P2 | Tích hợp RAG endpoints vào game client UI | Frontend | 2-3 ngày |
| P2 | Test end-to-end: advisor + RAG | - | 1-2 ngày |

---

## Phần 4: Lưu ý kỹ thuật

### Positioning Advisor
- **Performance**: Mỗi lần tính advice cần K×N×X battles. Nên:
  - Chạy async/parallel.
  - Giới hạn K=5 phương án, N=3 kịch bản, X=10 lần = 150 battles.
  - Hoặc pre-compute common scenarios, chỉ tính real-time khi board lạ.
- **Caching**: Cache kết quả theo board hash (LRU cache).
- **Balancing**: Tham số `targetWinRate` (mặc định 60-65%) có thể điều chỉnh để không làm game quá dễ.

### RAG
- **Dùng lại**: `chat_model.py`, `prompts/`, haystack pipeline (chỉ đổi prompt).
- **Không dùng**: BM25 cho product SKUs, MySQL indexing → thay bằng markdown loader.
- **Luật AI**: Thực hiện ở 2 lớp:
  1. Pre-filter: Keyword blacklist để từ chối nhanh.
  2. LLM: System prompt nhắc nhở chỉ trả lời về game.

---

**Created**: 2026-05-13  
**Status**: Plan Draft  
**Next Step**: Approve → Implement P0 (positioning advisor module).
