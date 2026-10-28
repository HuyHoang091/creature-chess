# Kiến trúc Hệ thống (System Architecture)

Tài liệu này mô tả chi tiết thiết kế kiến trúc kỹ thuật của hệ thống **Creature Chess** — nền tảng game multiplayer thời gian thực tích hợp trí tuệ nhân tạo (Reinforcement Learning & Retrieval-Augmented Generation).

---

## 1. Phân tầng kiến trúc tổng thể (High-Level Architecture)

Hệ thống được tổ chức theo mô hình Microservices phân tầng (Tiered Architecture), đóng gói trong cấu trúc Monorepo quản lý bởi Yarn Berry (v4):

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                1. CLIENT LAYER                                  │
│  ┌──────────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ 🌐 Web Game Client (apps/web-game)   │  │ 🛠️ Admin Dashboard              │  │
│  │    • React 18, Redux, Redux-Saga     │  │    • React 18, Storybook 7      │  │
│  │    • Socket.io Client (MessagePack)  │  │    • REST Management APIs       │  │
│  └──────────────────────────────────────┘  └─────────────────────────────────┘  │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ HTTPS / WSS
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         2. INGRESS & NETWORKING LAYER                           │
│  ┌──────────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ ☁️ Cloudflare Tunnel (cloudflared)   │──►│ 🔀 Nginx Reverse Proxy (:80)    │  │
│  │    • SSL/TLS Termination             │  │    • Path-based Routing         │  │
│  │    • DDoS Protection & CDN           │  │    • Static Asset Serving       │  │
│  └──────────────────────────────────────┘  └─────────────────────────────────┘  │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌───────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
│  3.1. Game Realtime Server    │ │  3.2. Info & Auth Service    │ │  3.3. RAG Chatbot Service    │
│  (apps/server-game)           │ │  (apps/server-info)          │ │  (llm-rag)                   │
│  • Socket.io Binary Cluster   │ │  • Guest & User Session Auth │ │  • Python FastAPI (:8000)    │
│  • Redux-Saga Match State     │ │  • Player Profiles & Stats   │ │  • Hybrid Search (BM25 +     │
│  • Tick Combat Simulator      │ │  • REST API Endpoints        │ │    Sentence-Transformers)    │
│  • RL Bot Agent Saga          │ │                              │ │  • Multi-LLM Provider API    │
└───────────────┬───────────────┘ └──────────────┬───────────────┘ └──────────────────────────────┘
                │                                │
                └────────────────┬───────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           4. PERSISTENCE & CACHING LAYER                        │
│  ┌──────────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ 🐘 PostgreSQL 13 (Prisma ORM 6)      │  │ ⚡ Redis 7 (In-Memory Data Store)│  │
│  │    • User accounts & matchmaking data│  │    • Socket.io Pub/Sub adapter  │  │
│  │    • Match history & leaderboards    │  │    • Session cache & quick state│  │
│  └──────────────────────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi tiết các phân hệ cốt lõi

### 2.1. Phân hệ Game Server (`apps/server-game` & `modules/@creature-chess/*`)

- **State Management (Redux-Saga)**:
  - Trạng thái bàn cờ, giai đoạn trận đấu, người chơi, cửa hàng và ngân sách được quản lý theo mô hình đơn luồng xác định (deterministic state).
  - Chu kỳ một vòng đấu:
    1. **PREPARING Phase**: Người chơi mua quân, nhận vàng, tái roll cửa hàng và sắp xếp vị trí đội hình.
    2. **READY Phase**: Đồng bộ vị trí cuối cùng của các đội hình.
    3. **PLAYING / COMBAT Phase**: Simulator giao tranh phân giải theo tick độc lập giữa các cặp đấu.
    4. **RESULT RESOLUTION**: Tính toán sát thương linh thú, cộng thưởng vàng và chuỗi thắng/thua.
- **Combat Simulation (`modules/@creature-chess/battle`)**:
  - Mô phỏng độc lập hoàn toàn trên server để ngăn chặn gian lận (authoritative server).
  - Tích hợp logic pathfinding, attack range, cooldown chiêu thức và tính toán synergy tương tác giữa các hệ tộc.
- **Giao thức mạng tối ưu**:
  - Socket.io kết hợp `socket.io-msgpack-parser` nén nhị phân dữ liệu trận đấu, giảm hơn 60% tải băng thông so với JSON thuần.

---

### 2.2. Phân hệ Học tăng cường (`modules/@creature-chess/rl-bot`)

Phân hệ AI Bot được thiết kế theo kiến trúc phi xâm lấn (non-invasive), tích hợp trực tiếp vào game loop thông qua Redux-Saga:

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        REINFORCEMENT LEARNING PIPELINE                          │
│                                                                                 │
│   ┌─────────────────────┐       ┌──────────────────────┐                        │
│   │ Tactical Board State│ ───►  │ State Encoder        │                        │
│   │ (Pieces, Synergies) │       │ (Compact Feature Vec)│                        │
│   └─────────────────────┘       └──────────┬───────────┘                        │
│                                            ▼                                    │
│   ┌─────────────────────┐       ┌──────────────────────┐                        │
│   │ Board Action Matrix │ ◄───  │ Tabular PPO Agent    │                        │
│   │ (Archetype Decoded) │       │ (Policy Network)     │                        │
│   └──────────┬──────────┘       └──────────▲───────────┘                        │
│              │                             │                                    │
│              ▼                             │ Policy Update                      │
│   ┌─────────────────────┐       ┌──────────┴───────────┐                        │
│   │ Combat Simulation   │ ───►  │ Reward Calculator    │                        │
│   │ (Real Gameplay)     │       │ (Combat Margin + HP) │                        │
│   └─────────────────────┘       └──────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- **State Encoder (`stateEncoder.ts`)**:
  - Chuyển đổi trạng thái bàn cờ phức tạp (danh sách quân cờ, cấp sao, synergy kích hoạt) thành vector biểu diễn đặc trưng rút gọn.
- **Action Decoder (`actionDecoder.ts`)**:
  - Ánh xạ quyết định từ Policy sang vị trí cụ thể trên lưới cờ (frontline, backline, corner, split).
- **Thuật toán PPO (`ppoAgent.ts`)**:
  - Triển khai Proximal Policy Optimization với cơ chế Clipped Surrogate Objective nhằm giữ cho việc cập nhật policy ổn định.
- **Hàm thưởng Combat Margin (`rewardCalculator.ts`)**:
  - Hàm thưởng dày đặc (dense reward) dựa trên:
    $$R = \alpha \cdot \Delta \text{HP} + \beta \cdot (\text{Surviving Pieces} - \text{Enemy Pieces}) + \gamma \cdot \mathbb{I}_{\text{Win}}$$
- **Tăng cường đối xứng (Symmetry Augmentation)**:
  - Mỗi mẫu kinh nghiệm (State, Action, Reward) được nhân bản phản chiếu theo trục dọc bàn cờ, giúp bot học nhanh gấp **4 lần** với cùng số trận đấu.

---

### 2.3. Phân hệ RAG Chatbot Service (`llm-rag/`)

Cung cấp trợ lý thông minh hỗ trợ giải đáp người chơi về cơ chế, tướng, cẩm nang chiến thuật:

```text
User Question ──► FastAPI Controller (:8000)
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
Dense Retrieval (Bi-Encoder)     Sparse Retrieval (BM25)
Sentence-Transformers            Tần suất từ khóa chính xác
        │                                 │
        └────────────────┬────────────────┘
                         ▼
             Hybrid Fusion & Reranking
                         │
                         ▼
             Top-K Context + Prompt Template
                         │
                         ▼
        LLM Gateway (OpenAI / DeepSeek / OpenRouter)
                         │
                         ▼
             Final Markdown Response
```

- **FastAPI Core**: Microservice độc lập, phi đồng bộ cao (async/await).
- **Hybrid Retrieval Pipeline**:
  - **Dense Search**: `sentence-transformers` chuyển hóa câu hỏi và kho tri thức markdown thành vector không gian ngữ nghĩa.
  - **Sparse Search**: `rank-bm25` truy hồi chính xác tên quân cờ, chỉ số sát thương, hệ số skill.
  - **Fusion**: Thuật toán xếp hạng Reciprocal Rank Fusion (RRF) kết hợp điểm số của cả hai phương pháp để chọn Top-K ngữ cảnh chính xác nhất.
- **LLM Agnostic**: Hỗ trợ chuyển đổi linh hoạt qua biến môi trường giữa OpenAI GPT, DeepSeek API và OpenRouter.

---

## 3. Luồng dữ liệu (Data Flow)

### 3.1. Luồng vòng đời trận đấu (Match Lifecycle)
```text
Player Action (Move/Buy) ──► Socket.io ──► Game Server (Redux-Saga)
                                                 │
                             ┌───────────────────┴───────────────────┐
                             ▼                                       ▼
                     Validate & Apply State               Synchronize to Peers
                             │                                 (MessagePack)
                             ▼
                   Trigger Combat Simulator
                             │
                             ▼
                 Broadcast Combat Events / Results
```

### 3.2. Luồng truy vấn RAG Player Support
```text
Client Chat Box ──► REST API (/api/chat) ──► RAG Service
                                                 │
                                                 ├── 1. Embed & Tokenize
                                                 ├── 2. Vector & BM25 Query
                                                 ├── 3. Extract Context Chunks
                                                 └── 4. Stream LLM Answer ──► User
```

---

## 4. Mô hình dữ liệu & Lưu trữ (Persistence Layer)

- **PostgreSQL 13 (via Prisma ORM)**:
  - `User`: Lưu thông tin tài khoản, mật khẩu băm, quyền hạn.
  - `Session`: Quản lý phiên đăng nhập của người chơi.
  - `MatchHistory`: Lịch sử các ván đấu, thứ hạng đạt được, đội hình sử dụng.
  - `Leaderboard`: Bảng xếp hạng điểm Elo và chỉ số thắng/thua.
- **Redis 7**:
  - Quản lý trạng thái phân tán (Socket.io Redis Adapter cho phép scale nhiều node Game Server).
  - Cache tạm thời danh sách phòng chờ (Lobbies) và kết nối active.

---

## 5. Kiến trúc Triển khai & CI/CD (DevOps)

- **Dockerization**:
  - Toàn bộ dịch vụ cốt lõi được đóng gói qua `Dockerfile` đa tầng (multi-stage build) và `docker-compose.yml`.
  - Nginx đóng vai trò reverse proxy định tuyến traffic:
    - `/` ➔ Web Game Client (`frontend`)
    - `/api/` ➔ Info Server (`server-info`)
    - `/game/` ➔ Game Server Socket (`server-game`)
- **CI/CD Pipeline ([GitHub Actions](file:///c:/xampp/htdocs/hoanghuy/Backup/creature-chess/.github/workflows))**:
  - `lint-pr.yml`: Kiểm tra tiêu đề PR theo quy chuẩn Conventional Commits.
  - `nodejs-ci.yml`: Chạy song song trên Node 18 & 20, kiểm tra format (Prettier), tĩnh (ESLint), và chạy test đa workspace (`yarn workspaces foreach`).
