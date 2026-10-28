# Thuật Toán PPO & Flow Chat RAG — Creature Chess

---

## Phần 1: Sơ Đồ Khối Thuật Toán PPO (Proximal Policy Optimization)

### 1.1 Tổng Quan PPO

PPO là thuật toán Reinforcement Learning thuộc họ Policy Gradient, được dùng trong Creature Chess để huấn luyện bot **tự động chọn đội hình (formation) và điều chỉnh vị trí (adjustment)** tối ưu cho mỗi trận đấu.

### 1.2 Flowchart Thuật Toán PPO
```mermaid
flowchart TD
    %% Định nghĩa Style màu sắc
    classDef init fill:#e1bee7,stroke:#8e24aa,stroke-width:2px,color:#4a148c
    classDef loop fill:#bbdefb,stroke:#1976d2,stroke-width:2px,color:#0d47a1
    classDef check fill:#ffecb3,stroke:#fbc02d,stroke-width:2px,color:#f57f17
    classDef action fill:#c8e6c9,stroke:#388e3c,stroke-width:2px,color:#1b5e20
    classDef wait fill:#ffccbc,stroke:#e64a19,stroke-width:2px,color:#bf360c

    START(["Bắt đầu Autoplay<br/>(Nhận Kế hoạch, Level, Preset)"]):::init
    Tick["Vòng lặp Controller (Tick)<br/>Định kỳ quét Game State"]:::loop

    START --> Tick

    Tick --> CheckPhase{"Đang ở Giai đoạn nào?<br/>(Còn máu không?)"}:::check

    CheckPhase -- "Đang Combat hoặc Đã thua" --> WaitPhase["Tạm dừng (Waiting)<br/>Chờ đến giai đoạn Chuẩn bị (Preparing)"]:::wait
    WaitPhase -. "Chờ n giây" .-> Tick

    CheckPhase -- "Đang Chuẩn bị (Preparing)" --> CheckReady{"Đã bấm Ready chưa?"}:::check

    CheckReady -- "Đã Ready" --> WaitNextRound["Khóa hành động<br/>Chờ Round tiếp theo"]:::wait
    WaitNextRound -. "Chờ n giây" .-> Tick

    CheckReady -- "Chưa Ready" --> CheckTacticalMoves{"Có danh sách bước<br/>xếp quân đang đợi?"}:::check

    %% Nhánh 1: Thực hiện kéo thả xếp quân (Từng bước một)
    CheckTacticalMoves -- "Có (Đang xếp dở)" --> ApplyMove["Thực thi 1 bước Xếp quân<br/>(Giả lập kéo thả cờ)"]:::action
    ApplyMove -. "Delay ngắn" .-> Tick

    %% Nhánh 2: Kiểm tra bế tắc chiến thuật và gọi LLM RAG
    CheckTacticalMoves -- "Trống (Chưa có gì đợi)" --> CheckBuildStuck{"Phân tích Tiến độ Build<br/>(Có bế tắc sau nhiều vòng?)"}:::check

    CheckBuildStuck -- "Bế tắc (Thiếu tướng / Thua nhiều)" --> CallLLM["Gọi RAG LLM<br/>Đánh giá & Đổi Kế hoạch Build (Pivot)"]:::action
    CallLLM -. "Cập nhật Plan mới" .-> Tick

    %% Nhánh 3: Mua bán, lên cấp, ép đồ
    CheckBuildStuck -- "Tiến độ bình thường" --> PolicyCheck{"Phân tích Policy<br/>(Cửa hàng, Hàng chờ, Vàng)"}:::check

    PolicyCheck -- "Ra quyết định<br/>(Mua, Bán, Lên cấp, Roll, Ép đồ)" --> ExecuteAction["Thực thi 1 Hành động Quản lý"]:::action
    ExecuteAction -. "Delay theo loại (Shop/Board)" .-> Tick

    %% Nhánh 4: Đã tiêu xong tiền, tiến hành phân tích chiến thuật xếp quân
    PolicyCheck -- "Không còn hành động nào hợp lệ" --> CheckPositioned{"Đã Phân tích Xếp quân<br/>cho Round này chưa?"}:::check

    CheckPositioned -- "Chưa phân tích" --> AnalyzePositioning["Gọi Tactical AI Advisor<br/>(Phân tích Địch & Tìm vị trí)"]:::action
    AnalyzePositioning -- "Trả về danh sách các Bước thả cờ" --> Tick

    %% Nhánh 4: Đã xong hết
    CheckPositioned -- "Đã Xếp quân xong" --> Finalize["Hoàn tất chuỗi hành động<br/>Tự động bấm Ready"]:::action
    Finalize -. "Chờ Combat" .-> Tick
```

```mermaid
flowchart TD
    %% Định nghĩa Style (Màu sắc theo chức năng)
    classDef client fill:#e1bee7,stroke:#8e24aa,stroke-width:2px,color:#4a148c
    classDef server fill:#bbdefb,stroke:#1976d2,stroke-width:2px,color:#0d47a1
    classDef ai_service fill:#c8e6c9,stroke:#388e3c,stroke-width:2px,color:#1b5e20
    classDef database fill:#ffecb3,stroke:#fbc02d,stroke-width:2px,color:#f57f17
    classDef engine fill:#ffccbc,stroke:#e64a19,stroke-width:2px,color:#bf360c

    %% Các Node chính
    Client(["🎮 Client (Người chơi)"]):::client
    GameServer["⚙️ Máy chủ Game<br/>(Bộ xử lý sự kiện)"]:::server

    subgraph RAG_System ["🧠 Dịch vụ AI Xếp Quân (Luồng xử lý RAG)"]
        direction TB
        Masking["Trích xuất Mặt nạ Đội hình<br/>(Ma trận lưới)"]:::ai_service
        LLM["🤖 Mô hình AI (LLM)<br/>(Tạo Chiến Thuật & Bước đi)"]:::ai_service
        Verify["⚔️ Đấu thử nội bộ<br/>(Kiểm chứng tỷ lệ thắng)"]:::ai_service
    end

    Pinecone[(🗄️ CSDL Vector<br/>Pinecone)]:::database
    ShokiEngine["⚙️ Lõi Game mô phỏng<br/>(Shoki Board)"]:::engine

    %% Luồng dữ liệu (Edges)
    Client -- "1. Gửi Yêu cầu Xếp quân<br/>(Bàn cờ phe ta & địch)" --> GameServer
    GameServer -- "2. Gọi Dịch vụ AI" --> Masking

    Masking -- "3. Truy vấn Ma trận" --> Pinecone
    Pinecone -- "4. Trả về: Tên đội hình,<br/>Hiệu ứng, Điểm yếu" --> Masking

    Masking -- "5. Gửi Câu lệnh + Ngữ cảnh" --> LLM
    LLM -- "6. Phản hồi JSON<br/>(Chiến thuật, Bước đi)" --> Verify

    Verify -- "7. Tạo 4 Kịch bản địch<br/>x 25 Trận giả lập" --> ShokiEngine
    ShokiEngine -- "8. Trả về Tỷ lệ thắng<br/>& Nhật ký trận đấu" --> Verify

    Verify -- "9. Tổng hợp Lời khuyên" --> GameServer
    GameServer -- "10. Trả kết quả cho Giao diện" --> Client
```

```mermaid
flowchart TD
    START(["🟢 START: Khởi tạo PPO Agent"])

    INIT["Khởi tạo Policy Weights π_θ<br/>Khởi tạo Value Weights V_θ<br/>Config: lr=0.0003, γ=0.99, λ=0.95, ε=0.2"]

    subgraph COLLECT["📦 Thu Thập Trajectory"]
        OBS["Quan sát State s_t<br/>(Board, UnitClasses, Synergies)"]
        ENCODE["StateEncoder.encode()<br/>Chuyển board → Float32Array"]
        POLICY["Policy Network π_θ(s_t)<br/>Tính logits cho từng formation<br/>& adjustment"]
        SOFTMAX["Softmax với Temperature<br/>P(a) = exp(logit/T) / Σexp(logit/T)"]
        SAMPLE["Lấy mẫu Action<br/>formation: tank_front, spread_backline...<br/>adjustment: protect_carry, flank_assassin..."]
        EXEC["Thực thi Action trong Game<br/>ActionDecoder.decodeAction()"]
        REWARD["Nhận Reward r_t<br/>(Win/Loss/Draw + Survival margin)"]
        STORE["Lưu Experience<br/>{s_t, a_t, r_t, log π_θ(a_t|s_t)}"]
    end

    BATCH{"Đủ batch_size?<br/>(≥ 32 experiences)"}

    subgraph UPDATE["🔄 PPO Update"]
        RETURNS["Tính Returns G_t<br/>G_t = r_t + γ·r_(t+1) + γ²·r_(t+2) + ..."]
        GAE["Tính Advantages A_t (GAE-λ)<br/>δ_t = r_t + γ·V(s_(t+1)) − V(s_t)<br/>A_t = Σ (γλ)^l · δ_(t+l)"]

        subgraph CLIP_OBJ["🎯 PPO Clipped Objective"]
            RATIO["Tính Ratio: r_θ = π_new(a/s) / π_old(a/s)<br/>= exp(log_prob_new − log_prob_old)"]
            CLIP["Clip Ratio:<br/>r_clip = clamp(r_θ, 1−ε, 1+ε)<br/>ε = 0.2"]
            LOSS["Policy Loss:<br/>L = −min(r_θ·A_t, r_clip·A_t)"]
        end

        GRAD["Gradient Descent<br/>w ← w − lr × ∂L/∂w<br/>lr = 0.0003"]
        CLEAR["Xóa Experience Buffer"]
    end

    SAVE{"Đủ 50 experiences<br/>kể từ lần save?"}
    SAVE_MODEL["💾 Lưu Model<br/>saveModel(policyWeights, valueWeights)"]

    CONTINUE{"Game kết thúc?"}
    DONE(["🔴 END"])

    START --> INIT
    INIT --> OBS
    OBS --> ENCODE
    ENCODE --> POLICY
    POLICY --> SOFTMAX
    SOFTMAX --> SAMPLE
    SAMPLE --> EXEC
    EXEC --> REWARD
    REWARD --> STORE
    STORE --> BATCH

    BATCH -- "Chưa đủ" --> OBS
    BATCH -- "Đủ ≥ 32" --> RETURNS

    RETURNS --> GAE
    GAE --> RATIO
    RATIO --> CLIP
    CLIP --> LOSS
    LOSS --> GRAD
    GRAD --> CLEAR

    CLEAR --> SAVE
    SAVE -- "Chưa đủ" --> CONTINUE
    SAVE -- "Đủ 50" --> SAVE_MODEL
    SAVE_MODEL --> CONTINUE

    CONTINUE -- "Chưa" --> OBS
    CONTINUE -- "Rồi" --> DONE

    style START fill:#00c853,color:#fff
    style DONE fill:#ff1744,color:#fff
    style CLIP_OBJ fill:#fff3e0,stroke:#ff9800
    style COLLECT fill:#e3f2fd,stroke:#2196f3
    style UPDATE fill:#fce4ec,stroke:#e91e63
```

### 1.3 Giải Thích Chi Tiết Từng Bước

| Bước | Component | Mô tả |
|------|-----------|-------|
| **State Encoding** | `StateEncoder.encode()` | Chuyển trạng thái bàn cờ (vị trí quân, đối thủ) thành `Float32Array` |
| **Policy Forward** | `PPOAgent.act()` | Tính xác suất cho 7 formations × 5 adjustments qua softmax |
| **Action Sampling** | `sampleAction()` | Lấy mẫu ngẫu nhiên theo phân phối xác suất (exploration) |
| **Execution** | `ActionDecoder.decodeAction()` | Giải mã action thành danh sách moves `{pieceId, targetX, targetY}` |
| **Returns** | `calculateReturns()` | Tính discounted cumulative return: `G_t = Σ γ^k · r_(t+k)` |
| **GAE** | `calculateAdvantages()` | Generalized Advantage Estimation giảm variance |
| **Clipped Loss** | `update()` | Core PPO: clip ratio để tránh policy thay đổi quá lớn |
| **Weight Update** | `updatePolicyWeights()` | Gradient descent đơn giản: `w -= lr × loss` |

### 1.4 Các Hyperparameters Trong Project

| Parameter | Giá trị | Ý nghĩa |
|-----------|---------|---------|
| `learningRate` | 0.0003 | Tốc độ học |
| `gamma (γ)` | 0.99 | Discount factor — trọng số phần thưởng tương lai |
| `lambda (λ)` | 0.95 | GAE lambda — cân bằng bias vs variance |
| `epsilon (ε)` | 0.2 | Clip range cho PPO objective |
| `batchSize` | 32 | Số experience tối thiểu trước khi update |
| `temperature` | 1.0 | Softmax temperature — điều chỉnh exploration |
| `entropyCoef` | 0.01 | Hệ số entropy bonus — khuyến khích khám phá |

---

## Phần 2: Flow Thực Tế Của Hệ Thống Chat RAG (Agentic RAG)

### 2.1 Tổng Quan Kiến Trúc

Hệ thống chat sử dụng kiến trúc **Agentic RAG** (Retrieval-Augmented Generation có Agent routing), gồm:
- **Client** (React web-game): UI chat panel, thu thập game context
- **RAG Server** (FastAPI Python): Agent routing, retrieval, LLM streaming
- **Game Server** (Node.js Socket.IO): Cung cấp game state cho build/positioning

### 2.2 Flowchart Tổng Thể — Từ Tin Nhắn Đến Trả Lời

```mermaid
flowchart TD
    USER(["👤 Người Chơi<br/>Nhập tin nhắn trong ChatPanel"])

    subgraph CLIENT["🖥️ Client — TacticalAIPanel.tsx"]
        INPUT["handleCoachSend()<br/>Lấy text + game context<br/>(pieces, selectedPiece, phase, opponent)"]

        SLASH{"Là slash command?<br/>/build /item /pos<br/>/counter /scout /help"}

        FAST_EXEC["⚡ Chạy trực tiếp<br/>runBuild() / runItem()<br/>runPositioning() / runScout()"]

        THINKING["showThinking()<br/>'Coach đang suy nghĩ...'"]

        AGENT_REQ["📤 POST /agent<br/>requestAgentPlan()<br/>{query, context, session_id}"]
    end

    subgraph SERVER_ROUTE["🧠 RAG Server — Agent Router"]
        MEMORY_LOAD["ConversationMemory.get()<br/>Lấy summary + recent turns"]

        CONTEXT_BUILD["Xây dựng Router Prompt<br/>+ Tools catalog<br/>+ Creature roster<br/>+ Game state<br/>+ Conversation context"]

        LLM_ROUTE["🤖 LLM Call (Router)<br/>temperature=0.0<br/>→ JSON tool, args, reason, smalltalk"]

        NAME_RESOLVE["resolve_creature_name()<br/>Chuẩn hóa tên quân<br/>'Twees' → 'Tweesher'<br/>'agni' → ambiguous?"]

        ROUTE_RESULT["AgentPlanResponse<br/>tool, clientAction, args, needs, smalltalk"]
    end

    subgraph CLIENT_DISPATCH["🖥️ Client — dispatchAgentPlan()"]
        CHECK_ACTION{"clientAction?"}

        RUN_POS["🎯 positioning<br/>requestPositioningAdvice()<br/>→ Socket.IO → Game Server<br/>→ Battle Simulator"]

        RUN_BUILD["🏗️ build<br/>requestBuildAdviceStream()<br/>→ Socket.IO → Game Server<br/>→ Build State + RAG"]

        RUN_ITEM["⚔️ item<br/>requestAgentStream()<br/>→ HTTP Stream"]

        RUN_COUNTER["🛡️ counter<br/>requestAgentStream()<br/>→ HTTP Stream"]

        RUN_SCOUT["📋 scout<br/>Đọc local game state<br/>(Board, PlayerList)"]

        RUN_GENERAL["💬 general_advice<br/>requestAgentStream()<br/>→ HTTP Stream"]

        RECORD["recordAgentAction()<br/>POST /agent-action-memory<br/>Ghi tool đã chạy vào memory"]
    end

    subgraph RAG_STREAM["🔍 RAG Server — Agentic RAG Stream"]
        VI_CHECK{"Câu hỏi<br/>tiếng Việt?"}
        TRANSLATE["Dịch sang English<br/>LLM: VI_SEARCH_TRANSLATE_PROMPT"]

        RETRIEVE["Hybrid Search<br/>BM25 (0.4) + Semantic (0.6)<br/>intfloat/e5-base-v2"]

        RELEVANCE{"Relevance ≥ 0.78?"}

        REQUERY["LLM Reformulate Query<br/>SUFFICIENCY_PROMPT<br/>→ searchQuery mới"]

        REQUERY_COUNT{"Đã re-query<br/>≥ 2 lần?"}

        COMPOSE["Compose Messages<br/>ANSWER_SYSTEM_PROMPT<br/>+ Game guide context<br/>+ Conversation context<br/>+ Game state"]

        LLM_STREAM["🤖 LLM Stream<br/>temperature=0.7<br/>max_tokens=10000<br/>→ SSE tokens"]

        MEMORY_SAVE["record_turn()<br/>Lưu user + ai vào memory<br/>fold_if_needed() → summary"]
    end

    subgraph CLIENT_RENDER["🖥️ Client — Render"]
        APPEND["appendChunk()<br/>Hiển thị từng token"]
        MARKDOWN["CoachMessageRenderer<br/>Parse markdown + tags<br/>piece:Name, item:ID"]
        PLAN_SHOW["Hiển thị Build Plan<br/>+ Nút Auto-Play"]
    end

    USER --> INPUT
    INPUT --> SLASH

    SLASH -- "Có /build etc." --> FAST_EXEC
    FAST_EXEC --> RUN_BUILD

    SLASH -- "Không, free-form" --> THINKING
    THINKING --> AGENT_REQ

    AGENT_REQ --> MEMORY_LOAD
    MEMORY_LOAD --> CONTEXT_BUILD
    CONTEXT_BUILD --> LLM_ROUTE
    LLM_ROUTE --> NAME_RESOLVE
    NAME_RESOLVE --> ROUTE_RESULT

    ROUTE_RESULT --> CHECK_ACTION

    CHECK_ACTION -- "positioning" --> RUN_POS
    CHECK_ACTION -- "build" --> RUN_BUILD
    CHECK_ACTION -- "item" --> RUN_ITEM
    CHECK_ACTION -- "counter" --> RUN_COUNTER
    CHECK_ACTION -- "scout" --> RUN_SCOUT
    CHECK_ACTION -- "null = general" --> RUN_GENERAL

    RUN_POS --> RECORD
    RUN_BUILD --> RECORD
    RUN_ITEM --> RECORD
    RUN_COUNTER --> RECORD

    RUN_GENERAL --> VI_CHECK
    RUN_ITEM --> VI_CHECK
    RUN_COUNTER --> VI_CHECK

    VI_CHECK -- "Có dấu VN" --> TRANSLATE
    VI_CHECK -- "ASCII/English" --> RETRIEVE
    TRANSLATE --> RETRIEVE

    RETRIEVE --> RELEVANCE
    RELEVANCE -- "≥ 0.78 ✅" --> COMPOSE
    RELEVANCE -- "< 0.78 ❌" --> REQUERY_COUNT

    REQUERY_COUNT -- "< 2" --> REQUERY
    REQUERY --> RETRIEVE
    REQUERY_COUNT -- "≥ 2, dừng" --> COMPOSE

    COMPOSE --> LLM_STREAM
    LLM_STREAM --> APPEND
    LLM_STREAM --> MEMORY_SAVE

    APPEND --> MARKDOWN
    RUN_BUILD --> PLAN_SHOW
    RUN_SCOUT --> MARKDOWN

    style USER fill:#7c4dff,color:#fff
    style CLIENT fill:#e8eaf6,stroke:#3f51b5
    style SERVER_ROUTE fill:#fff8e1,stroke:#ff8f00
    style CLIENT_DISPATCH fill:#e8f5e9,stroke:#4caf50
    style RAG_STREAM fill:#fce4ec,stroke:#e91e63
    style CLIENT_RENDER fill:#e0f7fa,stroke:#00bcd4
```

### 2.3 Flow Chi Tiết — Ví Dụ Cụ Thể

#### Ví dụ 1: Câu hỏi tự nhiên — "Đội hình lửa mạnh không?"

```mermaid
sequenceDiagram
    actor Player as 👤 Người chơi
    participant UI as 🖥️ TacticalAIPanel
    participant Agent as 🧠 /agent Router
    participant Memory as 💾 ConversationMemory
    participant RAG as 🔍 Agentic RAG
    participant LLM as 🤖 LLM OpenRouter
    participant Embed as 📐 E5 Embedder
    participant BM25 as 📚 BM25 + Guides

    Player->>UI: "Đội hình lửa mạnh không?"
    UI->>UI: Collect context pieces, phase, opponent
    UI->>UI: showThinking Coach đang suy nghĩ

    rect rgb(255, 248, 225)
        Note over UI,Agent: Bước 1: Intent Routing
        UI->>Agent: POST /agent query, context, session_id
        Agent->>Memory: get session_id → summary + turns
        Agent->>LLM: Router Prompt + tools catalog
        LLM-->>Agent: tool=general_advice, smalltalk=false
        Agent-->>UI: AgentPlan clientAction=null, tool=general_advice
    end

    UI->>UI: clearThinking

    rect rgb(252, 228, 236)
        Note over UI,BM25: Bước 2: Agentic RAG Stream
        UI->>RAG: POST /agent-stream query, context, session_id, smalltalk=false

        RAG->>RAG: has_vietnamese Đội hình lửa → true
        RAG->>LLM: Dịch → fire team composition strong?
        LLM-->>RAG: fire team composition strength

        RAG->>Embed: encode_query fire team composition
        RAG->>BM25: get_scores fire team composition
        RAG->>RAG: Hybrid 0.4xBM25 + 0.6xSemantic
        RAG->>RAG: Best relevance = 0.84 ≥ 0.78 OK

        RAG->>LLM: ANSWER_SYSTEM_PROMPT + context chunks + question

        loop Streaming tokens
            LLM-->>RAG: 🏆 Khuyến Nghị...
            RAG-->>UI: SSE token
            UI->>UI: appendChunk → render
        end

        RAG->>Memory: record_turn session_id, user, ai_answer
        RAG->>RAG: fold_if_needed → summarize old turns
    end

    UI->>UI: CoachMessageRenderer parse piece/item tags
```

#### Ví dụ 2: Yêu cầu hành động — "Build 8 lửa cho tôi"

```mermaid
sequenceDiagram
    actor Player as 👤 Người chơi
    participant UI as 🖥️ TacticalAIPanel
    participant Agent as 🧠 /agent Router
    participant Socket as 🔌 Socket.IO
    participant GameSrv as 🎮 Game Server
    participant RAG as 🔍 RAG Service
    participant LLM as 🤖 LLM

    Player->>UI: Build 8 lửa cho tôi
    UI->>UI: showThinking Coach đang suy nghĩ

    rect rgb(255, 248, 225)
        Note over UI,Agent: Bước 1: Router → build_advice
        UI->>Agent: POST /agent query=Build 8 lửa cho tôi
        Agent->>LLM: Router classify intent
        LLM-->>Agent: tool=build_advice, args note=8 fire
        Agent-->>UI: clientAction=build, args note=8 fire
    end

    UI->>UI: clearThinking

    rect rgb(232, 245, 233)
        Note over UI,GameSrv: Bước 2: Client dispatches build_advice
        UI->>UI: recordAgentAction session_id, query, build_advice
        UI->>Socket: emit requestBuildAdviceStream note=8 fire

        Note over Socket,GameSrv: Game Server thu thập Build State
        GameSrv->>GameSrv: Gather gold, level, bench, board, shop, items, unitPool, levelOdds
        GameSrv->>RAG: POST /build-advice-stream query, context=fullBuildState

        RAG->>LLM: SYSTEM_PROMPT + BUILD_REQUEST_PROMPT + Game guide context + Build state JSON

        loop Stream chunks
            LLM-->>RAG: Text chunk
            RAG-->>GameSrv: NDJSON type=chunk
            GameSrv-->>Socket: emit buildAdviceStreamChunk
            Socket-->>UI: onChunk → appendChunk
        end

        LLM-->>RAG: JSON planName, coreUnits, itemPlan
        RAG-->>GameSrv: type=done, plan=...
        GameSrv-->>Socket: emit buildAdviceStreamDone with plan
        Socket-->>UI: resolve → show Build Plan + Auto-Play button
    end

    opt Người chơi bật Auto-Play
        Player->>UI: Click Triển khai Lv.3
        UI->>Socket: emit startBuildAutoPlay plan, level=3
        GameSrv->>GameSrv: BuildAutoPlayer chạy plan - Mua/bán quân, ghép đồ, xếp bàn
        loop Mỗi round
            GameSrv-->>Socket: emit buildAutoPlayStatus
            Socket-->>UI: Hiển thị trạng thái auto
        end
    end
```

#### Ví dụ 3: Re-query khi Retrieval yếu

```mermaid
flowchart TD
    Q["Câu hỏi: 'Nudikill đánh thế nào?'"]

    TRANS["Dịch VN→EN:<br/>'Nudikill combat mechanics'"]

    S1["🔍 Search lần 1<br/>BM25 + Semantic"]
    R1{"Max cosine = 0.72<br/>< 0.78 ❌"}

    SUFF1["LLM Sufficiency Check:<br/>'Nudikill combat mechanics'<br/>→ 'Nudikill ability skill stats water'"]

    S2["🔍 Search lần 2<br/>query: 'Nudikill ability skill stats water'"]
    R2{"Max cosine = 0.81<br/>≥ 0.78 ✅"}

    USE["Sử dụng kết quả tốt nhất<br/>Compose messages → LLM stream"]

    Q --> TRANS --> S1 --> R1
    R1 -- "Yếu" --> SUFF1 --> S2 --> R2
    R2 -- "Đủ tốt" --> USE

    style R1 fill:#ffcdd2
    style R2 fill:#c8e6c9
```

### 2.4 Conversation Memory Flow

```mermaid
flowchart LR
    subgraph BUFFER["📝 Turn Buffer max 8 turns"]
        T1["Turn 1: User"]
        T2["Turn 2: AI"]
        T3["Turn 3: User"]
        T4["Turn 4: AI"]
        T5["..."]
        T8["Turn 8: AI"]
    end

    OVERFLOW{"Buffer > 8?"}

    subgraph FOLD["📦 Summary Fold"]
        OLD["Turns cũ nhất<br/>bị đẩy ra"]
        LLM_SUM["LLM tóm tắt<br/>SUMMARY_PROMPT<br/>≤ 8 bullets, ≤ 1200 chars"]
        SUMMARY["Running Summary<br/>'Player hỏi build fire,<br/>Coach đề xuất 8 fire carry Agnigon...'"]
    end

    NEW_TURN["Turn mới đến"]

    NEW_TURN --> BUFFER
    BUFFER --> OVERFLOW
    OVERFLOW -- "Có overflow" --> OLD
    OLD --> LLM_SUM
    LLM_SUM --> SUMMARY
    OVERFLOW -- "Chưa overflow" --> BUFFER

    style BUFFER fill:#e3f2fd,stroke:#1976d2
    style FOLD fill:#fff3e0,stroke:#f57c00
```

### 2.5 Bảng Tóm Tắt Các Endpoint

| Endpoint | Method | Mô tả | Caller |
|----------|--------|-------|--------|
| `/agent` | POST | Intent routing — quyết định tool | Client HTTP |
| `/agent-stream` | POST | Agentic RAG streaming answer | Client HTTP SSE |
| `/agent-action-memory` | POST | Ghi nhớ tool đã chạy | Client fire-and-forget |
| `/query` | POST | RAG query đơn giản non-stream | Game Server Socket |
| `/query-stream` | POST | RAG streaming legacy | Client HTTP SSE |
| `/build-advice-stream` | POST | Build advice + JSON plan NDJSON | Game Server Socket |
| `/counter-advice` | POST | Counter analysis | Game Server Socket |
| `/item-advice` | POST | Item recommendation | Game Server Socket |
| `/health` | GET | Health check | Docker/monitoring |

### 2.6 Bảng Tools Trong Agent Router

| Tool | Client Action | Chạy ở đâu | Cần gì |
|------|---------------|-------------|--------|
| `positioning_advice` | `positioning` | Game Server (battle sim) | myBoard, bothOpponents, preparing phase |
| `build_advice` | `build` | Game Server → RAG | Build state (gold, shop, units...) |
| `item_advice` | `item` | RAG direct (agent-stream) | Target piece name |
| `counter_advice` | `counter` | RAG direct (agent-stream) | Enemy board/archetype |
| `scout` | `scout` | Client local state | Opponent data from Redux |
| `general_advice` | `null` | RAG direct (agent-stream) | Không cần thêm |

> **Lưu ý quan trọng:**
> **Action tools** (positioning, build) chạy trên **Game Server** vì cần live game state (gold, shop, unit pool) mà client không có đủ. **Knowledge tools** (item, counter, general) gọi thẳng RAG server qua HTTP streaming.
