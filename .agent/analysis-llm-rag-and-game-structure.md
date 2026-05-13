# Phân tích chi tiết: llm-rag hiện tại & Cấu trúc Game Creature Chess

## 📊 PHÂN TÍCH LLM-RAG HIỆN TẠI

### 🎯 Chức năng của llm-rag (Web bán hàng quần áo)

#### 1. **Haystack Service** (Port 8002)
**Chức năng chính:**
- ✅ **Document Retrieval** - Tìm kiếm sản phẩm từ vector database
- ✅ **Hybrid Search** - Kết hợp BM25 (keyword) + Semantic Search (embedding)
- ✅ **Reranking** - Sắp xếp lại kết quả với Cross-Encoder (BAAI/bge-reranker-base)
- ✅ **Indexing** - Index dữ liệu từ MySQL hoặc JSON vào vector store

**Components:**
```python
# Pipeline flow:
Query → Chat Summary (reformulate)
     → Query Embedder (e5-base-v2)
     → Parallel Retrieval:
         ├─ Semantic Retriever (InMemory + Embeddings)
         └─ BM25 Retriever (rank_bm25)
     → Document Joiner
     → Cross-Encoder Reranker
     → QA Prompt Builder
```

**Endpoints:**
- `POST /retrieve` - Tìm kiếm documents
- `POST /index/mysql` - Index từ MySQL
- `POST /index/json` - Index từ JSON
- `DELETE /index/clear` - Xóa index
- `GET /index/count` - Đếm documents

**Models sử dụng:**
- Embedding: `intfloat/e5-base-v2` (SentenceTransformers)
- Reranker: `BAAI/bge-reranker-base` (CrossEncoder)
- LLM: `openai/gpt-3.5-turbo` (via OpenRouter)

#### 2. **LangChain Service** (Port 8001)
**Chức năng chính:**
- ✅ **Streaming Chat** - Trả lời streaming với LLM
- ✅ **Context Integration** - Lấy documents từ Haystack rồi feed vào LLM
- ✅ **Chat History** - Xử lý lịch sử chat để reformulate query

**Flow:**
```
User Question
  → Call Haystack /retrieve (get documents)
  → Format documents as context
  → LLM (GPT-3.5-turbo) với system prompt (nhân viên tư vấn)
  → Stream response về client
```

**Endpoints:**
- `POST /chat` - Chat với streaming
- `POST /chat/simple` - Chat đơn giản
- `GET /health` - Health check (bao gồm Haystack)

**System Prompt:**
```
"Bạn là nhân viên tư vấn bán quần áo chuyên nghiệp...
Trả lời dựa HOÀN TOÀN vào thông tin được cung cấp..."
```

#### 3. **RAG Core** (llm-rag/rag/)
**Chức năng:**
- ✅ **Document Processing** - Parse nhiều loại file (PDF, DOCX, PPTX, Excel)
- ✅ **Embeddings** - Generate embeddings cho documents
- ✅ **NLP Utils** - Tokenization, search, query processing
- ✅ **Prompts** - Template system cho prompts
- ✅ **Storage** - Kết nối nhiều storage backends (MinIO, S3, Azure, OSS)
- ✅ **Vector Store** - Elasticsearch, OpenSearch, Infinity

**Modules:**
```
rag/
├── app/          # Applications (audio, book, email, laws, manual, etc.)
├── flow/         # Document processing pipeline
│   ├── extractor/
│   ├── parser/
│   ├── splitter/
│   └── tokenizer/
├── llm/          # LLM integrations
│   ├── chat_model.py
│   ├── embedding_model.py
│   ├── rerank_model.py
│   └── cv_model.py (computer vision)
├── nlp/          # NLP utilities
│   ├── query.py
│   ├── search.py
│   ├── synonym.py
│   └── term_weight.py
├── prompts/      # Prompt templates (30+ templates)
├── svr/          # Services (cache, discord, jina, task executor)
└── utils/        # Storage connectors (ES, Redis, MinIO, S3, Azure, OSS)
```

**Prompt Templates có sẵn:**
- `analyze_task_system.md` / `analyze_task_user.md`
- `ask_summary.md`
- `citation_prompt.md`
- `content_tagging_prompt.md`
- `cross_languages_sys_prompt.md`
- `full_question_prompt.md`
- `keyword_prompt.md`
- `question_prompt.md`
- `related_question.md`
- `summary4memory.md`
- `toc_extraction.md` (table of contents)
- `vision_llm_describe_prompt.md`

---

## 🎮 PHÂN TÍCH CẤU TRÚC GAME CREATURE CHESS

### Game Architecture

```
modules/@creature-chess/
├── battle/           ← ★ BATTLE SYSTEM (Auto-battle logic)
├── gamemode/         ← Game mode definitions & rules
├── models/           ← ★ DATA MODELS (Piece, Card, Item)
├── networking/       ← Client-Server communication
├── rl-bot/           ← ★ RL Bot (Reinforcement Learning)
└── user/             ← User profile & management
```

### 1. **Battle System** (`@creature-chess/battle`)

**Core Components:**

#### A. Battle Loop (`battleSaga.ts`)
- Vòng lặp trận đấu chính (game loop)
- Xử lý từng turn theo tốc độ units
- Phát events: turnEvent, battleFinish

#### B. Pathfinding (`pathfinding.ts`)
- ★ **Thuật toán A*** tìm đường
- Units di chuyển đến target

#### C. Targeting System (`targeting/`)
```typescript
// StandardTargetProvider.ts - Thuật toán chọn mục tiêu
- Tìm enemies còn sống
- Tính khoảng cách
- Chọn target gần nhất
```

#### D. Turn Simulator (`simulator/turnSimulator.ts`)
```
1. Sắp xếp units theo speed
2. Duyệt từng unit:
   - Kiểm tra state (wander/attack/dying)
   - Generate actions (move/hit/delete)
   - Execute actions
3. Check win condition
```

#### E. Piece State Machine (`simulator/piece/state/`)
```typescript
States:
- wander.ts    → Lang thang, tìm mục tiêu
- attack.ts    → Tấn công: kiểm tra tầm, A*, đổi target
- dying.ts     → Hấp hối (chờ rồi xóa)
- findBestState.ts → Chuyển state dựa vào tình huống
```

#### F. Actions (`simulator/piece/actions/`)
```typescript
- hit.ts       → ★ Đánh: tính damage, trừ HP, set cooldown
- move.ts      → Di chuyển: đổi vị trí
- delete.ts    → Xóa quân chết
```

#### G. Combat Formulas (`utils/`)
```typescript
// getHitDamage.ts - CÔNG THỨC SÁT THƯƠNG
damage = ceil((ATK / DEF) * typeBonus * 8)

// typeRelations.ts - HỆ THỐNG KHẮC CHẾ ngũ hành
overcomeBy = 1.7x    // Khắc chế
generatedBy = 0.3x   // Bị khắc

// getCooldownForSpeed.ts - COOLDOWN
cooldown = ceil((180 - speed) / 24)

// inAttackRange.ts - TẦM ĐÁNH
- Chỉ ngang/dọc (không chéo)
- Distance = 1 (melee)
```

### 2. **Data Models** (`@creature-chess/models`)

#### A. Piece Model (`src/piece.ts`)
```typescript
interface PieceModel {
  id: string;
  ownerId: string;
  definitionId: number;
  definition: CreatureDefinition;
  traits: TraitId[];           // Synergies
  items: ItemInstance[];       // Max 3 items
  stage: number;               // Level/star

  // Stats
  maxHealth: number;
  currentHealth: number;
  maxMana: number;
  currentMana: number;

  // Combat state
  attacking?: AttackDetails;
  hit?: HitDetails;
  skillCast?: SkillCast;       // Skill animation
  visualEffects?: Effect[];    // Floating text

  // Battle stats
  lastBattleStats: {
    damageDealt: number;
    damageTaken: number;
    turnsSurvived: number;
  };
}
```

#### B. Card Model (`src/card.ts`)
```typescript
interface Card {
  id: string;
  definitionId: number;
  cost: number;
  name: string;
  traits: TraitId[];
}
```

#### C. Item Model (`src/item.ts`)
```typescript
interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  tier: 1 | 2 | 3;
  icon: string;
  stats: Partial<ItemStats>;   // attack, hp, defense, speed, mana
  passive?: ItemPassive;        // onAttackHit, onTakeDamage, etc.
}

interface ItemStats {
  attack: number;
  hp: number;
  defense: number;
  speed: number;
  mana: number;
}
```

### 3. **RL Bot** (`@creature-chess/rl-bot`)

**Chức năng:**
- Reinforcement Learning bot
- Training với PPO algorithm
- Dashboard để monitor training
- Benchmark scripts

**Structure:**
```
rl-bot/
├── src/
│   ├── agent/         # RL agent implementation
│   ├── environment/   # Game environment wrapper
│   ├── integration/   # Integration với game
│   ├── monitoring/    # Metrics & logging
│   └── training/      # Training scripts
├── training/models/   # Trained models
└── dashboard/         # Web dashboard
```

---

## 🔍 SO SÁNH: LLM-RAG vs TACTICAL AI CẦN XÂY

### ✅ Có thể tái sử dụng từ llm-rag:

#### 1. **LLM Integration Layer**
```python
# rag/llm/chat_model.py
# rag/llm/embedding_model.py
```
→ Migrate sang TypeScript: `src/llm/client.ts`

#### 2. **Prompt Template System**
```python
# rag/prompts/template.py
# rag/prompts/generator.py
```
→ Migrate sang: `src/prompts/explanation-templates.ts`

#### 3. **Storage & Caching**
```python
# rag/utils/redis_conn.py
# rag/utils/minio_conn.py
```
→ Có thể dùng cho cache tactical snapshots

#### 4. **Document Processing Pipeline**
```python
# rag/flow/pipeline.py
```
→ Concept tương tự cho tactical analysis pipeline

### ❌ KHÔNG tái sử dụng (domain khác):

#### 1. **Haystack Service** - Toàn bộ
- BM25 + Semantic search cho sản phẩm
- MySQL indexing
- Product metadata

→ **Thay bằng:** Board Normalizer + Feature Extractor

#### 2. **LangChain Service** - System prompt
- "Nhân viên tư vấn bán quần áo"
- Format sản phẩm (SKU, size, color, price)

→ **Thay bằng:** Tactical explanation prompts

#### 3. **RAG Applications** - Toàn bộ
```python
# rag/app/audio.py, book.py, email.py, laws.py, etc.
```
→ Domain hoàn toàn khác

---

## 🎯 ĐÁNH GIÁ PLAN ĐÃ TẠO

### ✅ Những gì ĐÚNG trong plan:

#### 1. **Kiến trúc tổng thể** ✅
```
Board → Parser → Simulator → Rule Engine → Decision
                                              ↓
                                            LLM (giải thích)
```
→ **ĐÚNG:** Phù hợp với triết lý "AI giải thích, không quyết định"

#### 2. **Module structure** ✅
```
modules/@creature-chess/llm-rag/
├── parser/           ✅ Cần thiết
├── simulator/        ✅ Cần thiết
├── tactical/         ✅ Cần thiết
├── threat-analysis/  ✅ Cần thiết
├── llm/              ✅ Cần thiết
├── prompts/          ✅ Cần thiết
├── memory/           ✅ Cần thiết
└── api/              ✅ Cần thiết
```

#### 3. **Priority đúng** ✅
1. Board Normalization ← Foundation
2. Fast Simulator ← Core
3. Threat Detector ← Rule-based
4. Action Packages ← Tactical
5. LLM Layer ← Explanation
6. RAG ← Knowledge

#### 4. **Tactical Features** ✅
```typescript
{
  frontLinePower: number,
  burstDamage: number,
  sustain: number,
  ccScore: number,
  synergies: Synergy[],
  positioning: PositionMetrics
}
```
→ **ĐÚNG:** Phù hợp với game mechanics

### ⚠️ Những gì CẦN ĐIỀU CHỈNH:

#### 1. **Simulator - KHÔNG cần viết lại** ⚠️

**Vấn đề:**
Plan đề xuất viết lại battle simulator từ đầu:
```typescript
// simulator/battle-simulator.ts
// simulator/combat-engine.ts
// simulator/damage-calculator.ts
```

**Thực tế:**
Game ĐÃ CÓ battle system hoàn chỉnh:
```
modules/@creature-chess/battle/
├── src/battleSaga.ts          ← Game loop
├── src/simulator/             ← Turn simulator
│   └── piece/
│       ├── actions/hit.ts     ← Damage calculation
│       └── state/attack.ts    ← Combat logic
└── src/utils/
    ├── getHitDamage.ts        ← Damage formula
    ├── typeRelations.ts       ← Type advantages
    └── getCooldownForSpeed.ts ← Cooldown formula
```

**Giải pháp:**
```typescript
// ✅ ĐÚNG: Wrap existing battle system
import { battleSaga } from '@creature-chess/battle';

export class BattleSimulator {
  async simulate(myBoard, enemyBoard, count = 500) {
    // Sử dụng battleSaga có sẵn
    // Chạy nhiều lần để tính win rate
  }
}
```

#### 2. **Board Normalizer - Cần align với models có sẵn** ⚠️

**Plan hiện tại:**
```typescript
interface Unit {
  id: string;
  type: UnitType;  // "MAGE" | "TANK" | ...
  level: number;
  hp: number;
  // ...
}
```

**Game thực tế:**
```typescript
interface PieceModel {
  id: string;
  definitionId: number;
  definition: CreatureDefinition;  // ← Có sẵn
  traits: TraitId[];               // ← Synergies
  items: ItemInstance[];           // ← Equipment
  stage: number;                   // ← Level
  maxHealth: number;
  currentHealth: number;
  // ...
}
```

**Giải pháp:**
```typescript
// ✅ ĐÚNG: Sử dụng PieceModel có sẵn
import { PieceModel } from '@creature-chess/models';

export class BoardNormalizer {
  normalize(pieces: PieceModel[]): NormalizedBoard {
    // Convert PieceModel → TacticalFeatures
  }
}
```

#### 3. **Threat Detection - Cần dựa vào combat formulas có sẵn** ⚠️

**Plan hiện tại:**
```typescript
// Tự tính damage
const damage = calculateDamage(attacker, defender);
```

**Game thực tế:**
```typescript
// modules/@creature-chess/battle/src/utils/getHitDamage.ts
export function getHitDamage(
  attacker: PieceModel,
  defender: PieceModel
): number {
  const damage = Math.ceil((ATK / DEF) * typeBonus * 8);
  return damage;
}
```

**Giải pháp:**
```typescript
// ✅ ĐÚNG: Import từ battle system
import { getHitDamage } from '@creature-chess/battle/src/utils/getHitDamage';

export class ThreatDetector {
  calculateCarryDeathRisk(carry, assassins) {
    const totalDamage = assassins.reduce((sum, assassin) => {
      return sum + getHitDamage(assassin, carry);
    }, 0);

    const risk = (totalDamage / carry.maxHealth) * 100;
    return risk;
  }
}
```

#### 4. **RAG Module - Có thể đơn giản hơn** ⚠️

**Plan hiện tại:**
```
rag/
├── knowledge-base.ts
├── embeddings-generator.ts
├── retriever.ts
└── coach-engine.ts
```

**Thực tế:**
- Game guides có thể là static markdown files
- Không cần vector search phức tạp
- Có thể dùng simple keyword matching

**Giải pháp:**
```typescript
// ✅ ĐƠN GIẢN HƠN:
rag/
├── guides/           # Static markdown files
│   ├── builds.md
│   ├── synergies.md
│   └── economy.md
└── coach-engine.ts   # Simple retrieval by topic
```

#### 5. **API - Cần integrate với game server** ⚠️

**Plan hiện tại:**
- Standalone service (port 3000)
- REST + WebSocket riêng

**Game thực tại:**
```
apps/server-game/     ← Game server đã có
├── src/server.ts     ← WebSocket server
└── src/game.ts       ← Game logic
```

**Giải pháp:**
```typescript
// ✅ ĐÚNG: Integrate vào game server
// apps/server-game/src/tactical-ai.ts

import { TacticalAnalyzer } from '@creature-chess/llm-rag';

export function setupTacticalAI(io: SocketIO.Server) {
  io.on('connection', (socket) => {
    socket.on('REQUEST_TACTICAL_ADVICE', async (data) => {
      const advice = await analyzer.analyze(data.board);
      socket.emit('TACTICAL_ADVICE', advice);
    });
  });
}
```

---

## 📝 ĐIỀU CHỈNH PLAN

### 1. **Cấu trúc thư mục mới (Adjusted)**

```
modules/@creature-chess/tactical-ai/    ← Đổi tên từ llm-rag
├── package.json
├── tsconfig.json
├── README.md
│
├── src/
│   ├── index.ts
│   │
│   ├── parser/                         # Board parsing
│   │   ├── board-normalizer.ts         # PieceModel[] → NormalizedBoard
│   │   ├── feature-extractor.ts        # Extract tactical features
│   │   └── synergy-calculator.ts       # Calculate synergies
│   │
│   ├── simulator/                      # ★ WRAPPER cho battle system
│   │   ├── battle-wrapper.ts           # Wrap @creature-chess/battle
│   │   ├── scenario-generator.ts       # Generate enemy scenarios
│   │   ├── weighted-evaluator.ts       # Calculate win rates
│   │   └── ghost-battle.ts             # Compare formations
│   │
│   ├── tactical/                       # Tactical analysis
│   │   ├── recommendation-engine.ts
│   │   ├── action-packages.ts
│   │   ├── reasoning-engine.ts
│   │   └── delta-analyzer.ts
│   │
│   ├── threat-analysis/                # Threat detection
│   │   ├── threat-detector.ts
│   │   └── rules/
│   │       ├── assassin-threat.ts      # ← Dùng getHitDamage()
│   │       ├── frontline-weak.ts
│   │       └── power-spike.ts
│   │
│   ├── llm/                            # LLM integration
│   │   ├── client.ts                   # OpenAI/OpenRouter client
│   │   ├── explainer.ts                # Generate explanations
│   │   └── response-formatter.ts
│   │
│   ├── prompts/                        # Prompt templates
│   │   ├── explanation-templates.ts
│   │   └── tactical-templates.ts
│   │
│   ├── rag/                            # ★ SIMPLIFIED
│   │   ├── guides/                     # Static markdown
│   │   │   ├── builds.md
│   │   │   ├── synergies.md
│   │   │   └── economy.md
│   │   └── coach-engine.ts             # Simple retrieval
│   │
│   ├── memory/                         # Memory & tracking
│   │   ├── snapshot-manager.ts
│   │   └── player-profiler.ts
│   │
│   ├── integration/                    # ★ GAME INTEGRATION
│   │   ├── game-server-plugin.ts       # Plugin cho server-game
│   │   └── websocket-handlers.ts       # WebSocket handlers
│   │
│   └── types/                          # Shared types
│       ├── tactical.ts
│       ├── threat.ts
│       └── action.ts
│
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/
```

### 2. **Priority mới (Adjusted)**

#### PRIORITY 1: Board Normalizer ⭐⭐⭐⭐⭐
```typescript
// Sử dụng PieceModel có sẵn
import { PieceModel } from '@creature-chess/models';

export class BoardNormalizer {
  normalize(pieces: PieceModel[]): TacticalFeatures {
    // Extract features từ PieceModel
  }
}
```

#### PRIORITY 2: Battle Wrapper ⭐⭐⭐⭐⭐
```typescript
// Wrap battle system có sẵn
import { battleSaga } from '@creature-chess/battle';

export class BattleWrapper {
  async runSimulation(myPieces, enemyPieces) {
    // Sử dụng battleSaga
  }
}
```

#### PRIORITY 3: Threat Detector ⭐⭐⭐⭐
```typescript
// Sử dụng combat formulas có sẵn
import { getHitDamage } from '@creature-chess/battle/src/utils/getHitDamage';

export class ThreatDetector {
  detect(myBoard, enemyBoard) {
    // Dùng getHitDamage để tính risk
  }
}
```

#### PRIORITY 4: Action Packages ⭐⭐⭐⭐
```typescript
// Tactical presets
export const ACTION_PACKAGES = {
  ANTI_ASSASSIN_SETUP: { ... },
  SPLIT_FORMATION: { ... }
};
```

#### PRIORITY 5: LLM Explanation ⭐⭐⭐
```typescript
// Natural language explanations
export class LLMExplainer {
  async explain(tacticalData) {
    // Generate explanation
  }
}
```

#### PRIORITY 6: Game Integration ⭐⭐⭐
```typescript
// Integrate vào server-game
export function setupTacticalAI(io) {
  // WebSocket handlers
}
```

#### PRIORITY 7: RAG Coach (Optional) ⭐⭐
```typescript
// Simple guide retrieval
export class CoachEngine {
  getGuide(topic: string) {
    // Return markdown content
  }
}
```

---

## ✅ KẾT LUẬN

### Plan ban đầu:
- ✅ **Kiến trúc tổng thể:** ĐÚNG
- ✅ **Module structure:** ĐÚNG
- ✅ **Priority order:** ĐÚNG
- ⚠️ **Implementation details:** CẦN ĐIỀU CHỈNH

### Điều chỉnh chính:

1. **KHÔNG viết lại battle simulator**
   → Wrap `@creature-chess/battle` có sẵn

2. **Sử dụng models có sẵn**
   → Import `PieceModel`, `ItemInstance`, `TraitId`

3. **Sử dụng combat formulas có sẵn**
   → Import `getHitDamage`, `typeRelations`, `getCooldownForSpeed`

4. **Đơn giản hóa RAG**
   → Static markdown files thay vì vector search

5. **Integrate vào game server**
   → Plugin cho `apps/server-game` thay vì standalone service

### Tên module đề xuất:
```
modules/@creature-chess/tactical-ai    ← Thay vì llm-rag
```

### Next Steps:
1. ✅ Review phân tích này
2. ✅ Approve adjusted plan
3. ✅ Bắt đầu implement với priority mới
4. ✅ Tận dụng tối đa code có sẵn

---

**Created:** 2026-05-11
**Status:** Analysis Complete
**Recommendation:** Proceed with adjusted plan
