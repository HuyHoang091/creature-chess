# 🐉 Creature Chess: Game AI & Real-Time Multiplayer Platform

<p align="center">
  <img src="images\ui\logo.png" alt="Creature Chess Banner" width="500" onerror="this.style.display='none'"/>
</p>

<p align="center">
  <strong>Hệ sinh thái game Multiplayer Auto-Battler thời gian thực tích hợp Reinforcement Learning Agent (PPO) và RAG-based Player Support Chatbot.</strong>
</p>

<p align="center">
  <a href="https://github.com"><img src="https://img.shields.io/badge/Node.js-v18%20|%20v20-339933?logo=node.js&logoColor=white" alt="Node Version" /></a>
  <a href="https://yarnpkg.com"><img src="https://img.shields.io/badge/Yarn-v4.0.2%20Berry-2C8EBB?logo=yarn&logoColor=white" alt="Yarn Version" /></a>
  <a href="https://www.python.org"><img src="https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white" alt="Python Version" /></a>
  <a href="https://www.docker.com"><img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" alt="Docker" /></a>
  <a href="https://fastapi.tiangolo.com"><img src="https://img.shields.io/badge/FastAPI-RAG%20Service-009688?logo=fastapi&logoColor=white" alt="FastAPI" /></a>
  <a href="https://github.com"><img src="https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white" alt="GitHub CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-ISC-yellow.svg" alt="License" /></a>
</p>

---

## 📑 Mục lục (Table of Contents)

- [1. Giới thiệu tổng quan](#1-giới-thiệu-tổng-quan)
- [2. Kiến trúc hệ thống (Architecture)](#2-kiến-trúc-hệ-thống-architecture)
- [3. Các trụ cột nghiên cứu & công nghệ (Core Pillars)](#3-các-trụ-cột-nghiên-cứu--công-nghệ-core-pillars)
  - [3.1. RL Bot Training System (PPO)](#31-rl-bot-training-system-ppo)
  - [3.2. Hybrid RAG Player Support Chatbot](#32-hybrid-rag-player-support-chatbot)
  - [3.3. Multiplayer Game Engine & Platform](#33-multiplayer-game-engine--platform)
- [4. Công nghệ sử dụng (Tech Stack)](#4-công-nghệ-sử-dụng-tech-stack)
- [5. Cấu trúc Monorepo (Project Structure)](#5-cấu-trúc-monorepo-project-structure)
- [6. Yêu cầu môi trường (Prerequisites)](#6-yêu-cầu-môi-trường-prerequisites)
- [7. Hướng dẫn cài đặt & Khởi chạy (Getting Started)](#7-hướng-dẫn-cài-đặt--khởi-chạy-getting-started)
  - [7.1. Chạy với Docker Compose](#71-chạy-với-docker-compose)
  - [7.2. Chạy Local Development (Monorepo)](#72-chạy-local-development-monorepo)
  - [7.3. Khởi chạy RAG Chatbot Service](#73-khởi-chạy-rag-chatbot-service)
  - [7.4. Huấn luyện và Đánh giá RL Bot](#74-huấn-luyện-và-đánh-giá-rl-bot)
- [8. Biến môi trường (.env)](#8-biến-môi-trường-env)
- [9. Giám sát & Đánh giá (Monitoring & Metrics)](#9-giám-sát--đánh-giá-monitoring--metrics)
- [10. CI/CD & Kiểm thử tự động](#10-cicd--kiểm-thử-tự-động)
- [11. Giấy phép (License)](#11-giấy-phép-license)

---

## 1. Giới thiệu tổng quan

**Creature Chess** là một nền tảng nghiên cứu và thực nghiệm kết hợp giữa **Game Multiplayer thời gian thực (Auto-Battler)** và **Trí tuệ nhân tạo (Học tăng cường - Reinforcement Learning & Trợ lý thông minh RAG)**.

Dự án tập trung giải quyết các bài toán trọng tâm:
1. **Intelligent Game AI**: Xây dựng bot tự chơi có khả năng thích nghi và tối ưu hóa thế trận bàn cờ chiến thuật thông qua thuật toán PPO (Proximal Policy Optimization).
2. **Context-Aware Player Support**: Cung cấp chatbot giải đáp thắc mắc về cơ chế, quân cờ, synergy và meta game theo thời gian thực sử dụng kỹ thuật RAG Hybrid Search (Dense + Sparse Retrieval).
3. **High-Performance Real-Time Engine**: Phát triển kiến trúc Game Server phân tán với giao tiếp Socket nhị phân độ trễ thấp, kết hợp quản lý trạng thái bằng Redux-Saga và lưu trữ đồng bộ qua Redis/PostgreSQL.

---

## 2. Kiến trúc hệ thống (Architecture)

Hệ thống được thiết kế theo mô hình Microservices, quản lý qua Monorepo Yarn Berry hiện đại:

```mermaid
flowchart TB
    subgraph Clients["Clients Layer"]
        WebPlayer["🌐 Web Game Client\n(React 18 + Redux)"]
        AdminUI["🛠️ Admin Dashboard\n(React + Storybook)"]
    end

    subgraph Ingress["Ingress & Networking"]
        CF["☁️ Cloudflare Tunnel\n(SSL Termination)"]
        Nginx["🔀 Nginx Reverse Proxy\n(Port 80)"]
    end

    subgraph CoreServices["Backend Core Services"]
        ServerGame["🎮 Game Server Instances\n(Socket.io + Redux-Saga)"]
        ServerInfo["ℹ️ Info & User Service\n(REST API)"]
        RLBot["🤖 RL Agent Engine\n(PPO Policy Network)"]
        RAG["💬 Kreuzberg RAG Service\n(FastAPI :8000)"]
    end

    subgraph Persistence["Persistence & State Layer"]
        PG[("🐘 PostgreSQL\n(Prisma ORM)")]
        Redis[("⚡ Redis Cluster\n(Socket Sync & Cache)")]
    end

    WebPlayer --> CF --> Nginx
    AdminUI --> CF --> Nginx
    Nginx --> ServerGame
    Nginx --> ServerInfo
    Nginx --> RAG

    ServerGame <--> Redis
    ServerGame --> PG
    ServerInfo --> PG
    ServerGame <--> RLBot
    ServerGame <--> RAG
```

---

## 3. Các trụ cột nghiên cứu & công nghệ (Core Pillars)

### 3.1. RL Bot Training System (PPO)
- **Vị trí**: [`modules/@creature-chess/rl-bot`](file:///c:/xampp/htdocs/hoanghuy/Backup/creature-chess/modules/@creature-chess/rl-bot)
- **Thuật toán cốt lõi**: **PPO (Proximal Policy Optimization)** kết hợp Tabular Policy và State Encoder chuyên dụng cho bàn cờ chiến thuật.
- **Chiến lược huấn luyện**:
  - **Combat Margin Rewards**: Hệ thống hàm thưởng phân tầng dày đặc (dense reward) dựa trên chênh lệch lượng máu, số quân cờ sống sót và kết quả giao tranh.
  - **Symmetry Augmentation**: Khai thác tính đối xứng hình học bàn cờ (Board Symmetries) giúp gia tăng hiệu quả sử dụng dữ liệu gấp **4 lần** (4x Data Efficiency).
  - **Self-Play Training**: Huấn luyện đối kháng liên tục với nhiều archetype chiến thuật khác nhau nhằm nâng cao độ bền vững của policy.
  - **Cơ chế Hybrid**: Tách biệt logic mua quân/kinh tế (rule-based) và định vị đội hình bàn cờ (RL positioning), tích hợp mượt mà qua Redux-Saga (`rlBotSaga.ts`) mà không làm gián đoạn game loop.

### 3.2. Hybrid RAG Player Support Chatbot
- **Vị trí**: [`llm-rag/`](file:///c:/xampp/htdocs/hoanghuy/Backup/creature-chess/llm-rag)
- **Công nghệ**: **FastAPI** + **Kreuzberg RAG Pipeline**.
- **Cơ chế tìm kiếm Hybrid (Hybrid Search)**:
  - **Dense Retrieval**: Sử dụng Sentence-Transformers (`sentence-transformers>=3.0.0`) tạo vector embedding ngữ nghĩa từ bộ tài liệu game.
  - **Sparse Retrieval**: Thuật toán xếp hạng từ khóa BM25 (`rank-bm25`).
  - **Context Synthesis**: Kết hợp kết quả từ Dense và Sparse retrieval để tái hiện ngữ cảnh chính xác nhất trước khi gửi tới LLM.
- **Đa dạng LLM Provider**: Tương thích linh hoạt với OpenAI (GPT-4o), DeepSeek (`deepseek-chat`), OpenRouter và Local LLMs.

### 3.3. Multiplayer Game Engine & Platform
- **Vị trí**: [`apps/`](file:///c:/xampp/htdocs/hoanghuy/Backup/creature-chess/apps), [`modules/`](file:///c:/xampp/htdocs/hoanghuy/Backup/creature-chess/modules)
- **Engine tự phát triển**: Quản lý combat simulator phân giải theo tick (`@creature-chess/battle`), hệ thống synergy tộc/hệ, xúc xắc, buff/debuff và tính toán sát thương thời gian thực.
- **Giao thức đồng bộ**: Socket.io với Binary MessagePack (`socket.io-msgpack-parser`) tối ưu băng thông mạng và độ trễ phản hồi trong các trận đấu nhiều người chơi.

---

## 4. Công nghệ sử dụng (Tech Stack)

| Lĩnh vực | Công nghệ / Thư viện | Mục đích sử dụng |
| :--- | :--- | :--- |
| **Monorepo & Build** | Yarn Berry (v4.0.2), TypeScript 5.3, Webpack 5 | Quản lý multi-workspace, build bundle |
| **Frontend Platform** | React 18, Redux, Redux-Saga, React-JSS, Storybook 7 | Giao diện bàn cờ, quản lý state bất đồng bộ |
| **Game Backend** | Node.js, Express, Socket.io, MessagePack | Real-time game server, session handling |
| **Database & Cache** | PostgreSQL 13, Prisma ORM 6, Redis 7 | Lưu trữ dữ liệu người chơi, session & pub/sub |
| **Reinforcement Learning** | PPO Algorithm, Redux-Saga Agent, Custom Gym Env | Tự động định vị đội hình chiến thuật và học tự chơi |
| **RAG & Chatbot** | Python 3.10+, FastAPI, Sentence-Transformers, BM25, Kreuzberg | Trợ lý tra cứu luật chơi và cẩm nang chiến thuật |
| **DevOps & Môi trường** | Docker Compose, Nginx Reverse Proxy, Cloudflare Tunnel | Containerization, cân bằng tải và bảo mật SSL |
| **CI/CD** | GitHub Actions, ESLint, Prettier, Jest | Kiểm thử tự động, lint mã nguồn và semantic PR |

---

## 5. Cấu trúc Monorepo (Project Structure)

```text
creature-chess/
├── .github/                      # CI/CD Workflows (Lint, Prettier, Test, Semantic PR)
│   └── workflows/
│       ├── nodejs-ci.yml
│       └── lint-pr.yml
├── apps/                         # Ứng dụng độc lập
│   ├── admin-web/                # Dashboard quản trị game
│   ├── server-admin/             # Backend service cho admin
│   ├── server-game/              # Server điều phối trận đấu thời gian thực
│   ├── server-info/              # Server thông tin người chơi & xác thực
│   └── web-game/                 # Client giao diện chơi game chính (React)
├── modules/                      # Thư viện dùng chung (Shared Packages)
│   ├── @cc-server/               # Auth & Data Layer (Prisma Database Client)
│   ├── @creature-chess/          # Battle simulator, models, networking, utils
│   │   └── rl-bot/               # Hệ thống Reinforcement Learning PPO Bot
│   ├── @shoki/                   # Core engine bàn cờ và utility
│   ├── @shoki-web/               # UI components hiển thị board bàn cờ
│   └── @tools/                   # Battle tester, bot analysis, simulator tools
├── llm-rag/                      # Kreuzberg RAG Player Support Service (Python FastAPI)
│   ├── data/                     # Knowledge base (markdown documents)
│   ├── kreuzberg_rag/            # Pipeline embeddings & BM25 retrieval
│   └── requirements.txt          # Python dependencies
├── nginx/                        # Cấu hình Nginx reverse proxy
├── docker-compose.yml            # Docker Compose điều phối dịch vụ
├── docker-compose.db.yml         # Docker Compose cho Database & Migration
├── package.json                  # Workspace package root
└── .yarnrc.yml                   # Cấu hình Yarn 4 Modern
```

---

## 6. Yêu cầu môi trường (Prerequisites)

- **Node.js**: Phiên bản `>= 18.0.0` (khuyến nghị `20.x LTS`)
- **Yarn**: Yarn Berry 4.x (đã tích hợp qua Corepack: `corepack enable`)
- **Python**: `>= 3.10` (cho phân hệ RAG Chatbot Service)
- **Docker & Docker Compose**: Phiên bản Docker Engine `>= 24.0`, Docker Compose v2
- **Hệ điều hành**: Linux (Ubuntu 20.04/22.04 khuyến nghị cho server) hoặc Windows/macOS (cho local development)

---

## 7. Hướng dẫn cài đặt & Khởi chạy (Getting Started)

### 7.1. Chạy với Docker Compose

Toàn bộ hệ thống (Postgres, Redis, Nginx, Server-Game, Server-Info, Frontend) có thể khởi chạy bằng **Docker Compose** trực tiếp hoặc qua file tự động hóa:

#### Cách 1: Sử dụng lệnh Docker Compose trực tiếp (Khuyến nghị cho mọi hệ điều hành)
```bash
# 1. Sao chép biến môi trường
cp .env.example .env

# 2. Khởi động cơ sở dữ liệu & Redis
docker compose up -d postgres redis

# 3. Chạy migration Prisma cho database
yarn workspace @cc-server/data prisma migrate deploy

# 4. Khởi chạy toàn bộ dịch vụ Game, Info, Web Frontend và Nginx
docker compose up -d postgres redis server-info server-game frontend nginx
```

#### Cách 2: Sử dụng Script tự động hóa (Makefile / PowerShell)
- **Trên Linux / macOS**:
  ```bash
  make db       # Khởi động database & migration
  make server   # Khởi chạy toàn bộ dịch vụ game
  make down     # Dừng toàn bộ hệ thống
  ```
- **Trên Windows (PowerShell)**:
  ```powershell
  .\make.ps1 db       # Khởi động database & migration
  .\make.ps1 server   # Khởi chạy toàn bộ dịch vụ game
  .\make.ps1 down     # Dừng toàn bộ hệ thống
  ```


Khi chạy thành công, các dịch vụ mặc định:
- **Game Web App**: `http://localhost:80` (hoặc thông qua Cloudflare Tunnel)
- **Database Management (pgAdmin)**: `http://localhost:5050` (`admin@admin.com` / `root`)

Để dừng hệ thống:
```bash
make down
```

---

### 7.2. Chạy Local Development (Monorepo)

Nếu bạn muốn debug trực tiếp mã nguồn Node.js/TypeScript:

```bash
# 1. Bật Corepack và cài đặt dependencies
corepack enable
yarn install

# 2. Khởi chạy cơ sở dữ liệu cục bộ qua Docker
docker compose -f docker-compose.db.yml up -d postgres

# 3. Chạy migration Prisma cho database
yarn workspace @cc-server/data prisma migrate dev
yarn workspace @cc-server/data run prisma-generate

# 4. Khởi chạy đồng thời Server Game, Server Info và Frontend Web
yarn dev-all
```

Các ứng dụng độc lập có thể chạy riêng:
- Game Server: `yarn start-server-game`
- Info Server: `yarn start-server-info`
- Web Game Client: `yarn dev-web-game`
- Admin Web: `yarn dev-admin-web`

---

### 7.3. Khởi chạy RAG Chatbot Service

Phân hệ RAG hoạt động độc lập qua REST API:

```bash
cd llm-rag

# 1. Tạo môi trường ảo Python
python -m venv venv
# Linux / macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# 2. Cài đặt thư viện
pip install -r requirements.txt

# 3. Cấu hình API key (OpenAI / DeepSeek / OpenRouter)
cp .env.example .env

# 4. Khởi chạy FastAPI server
uvicorn kreuzberg_rag.api:app --host 0.0.0.0 --port 8000 --reload
```

Tài liệu API Swagger tự động sẽ khả dụng tại: `http://localhost:8000/docs`.

---

### 7.4. Huấn luyện và Đánh giá RL Bot

#### A. Tự động thu thập kinh nghiệm qua Gameplay thực tế:
Bot có thể chạy song song với game server và tự động tích lũy kinh nghiệm, cập nhật model sau mỗi 10 ván đấu:

```bash
# Khởi chạy server ở chế độ RL Bot
BOT_MODE=rl yarn start-server-game

# Hoặc chế độ Hybrid (RL positioning + Rule-based economy)
BOT_MODE=hybrid yarn start-server-game
```

#### B. Chạy kịch bản giả lập Self-Play tốc độ cao:
```bash
# Kiểm tra thiết lập môi trường RL
node verify-rl-setup.js

# Chạy kịch bản tự động mô phỏng 1000 trận đấu
node train-bot.js 1000
```

#### C. Đánh giá chất lượng mô hình (Evaluation):
```bash
yarn workspace @creature-chess/rl-bot train --mode=eval --model=./training/models/final
```

---

## 8. Biến môi trường (.env)

Tham khảo file [`.env.example`](file:///c:/xampp/htdocs/hoanghuy/Backup/creature-chess/.env.example) để cấu hình các tham số cần thiết:

```ini
# Cơ sở dữ liệu & Caching
POSTGRES_DB=creature_chess
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/creature_chess
REDIS_URL=redis://localhost:6379

# Cấu hình Game Server
PORT_SERVER_INFO=3000
PORT_SERVER_GAME=3001
PORT_WEB_GAME=8080

# Tích hợp AI & RAG
BOT_MODE=hybrid                 # rl | hybrid | rule
RAG_SERVICE_URL=http://localhost:8000

# Cloudflare Tunnel (Cho Production)
CLOUDFLARE_TUNNEL_TOKEN=your_token_here
```

---

## 9. Giám sát & Đánh giá (Monitoring & Metrics)

Hệ thống cung cấp các chỉ số đo lường hiệu quả nghiên cứu:

| Hạng mục | Chỉ số đo lường (Metrics) | Cơ chế thu thập |
| :--- | :--- | :--- |
| **RL Bot** | • Win rate vs Rule-based baseline<br>• Combat margin reward convergence<br>• Average survival pieces | Logged qua `evaluate.ts` & Dashboard nội bộ |
| **RAG Chatbot** | • Top-K Retrieval precision & recall<br>• Mean Response Latency (ms)<br>• LLM Token usage efficiency | FastAPI Middleware & Benchmark logs |
| **Game Backend** | • Số lượng match đồng thời (Concurrent games)<br>• Socket event roundtrip latency<br>• Connection drops & error rate | Server game telemetry & Winston logs |

---

## 10. CI/CD & Kiểm thử tự động

Dự án áp dụng quy trình kiểm chuẩn nghiêm ngặt qua [GitHub Actions](file:///c:/xampp/htdocs/hoanghuy/Backup/creature-chess/.github/workflows):

```bash
# Kiểm tra định dạng code (Prettier)
yarn prettier-check

# Tự động format code
yarn prettier

# Kiểm tra tĩnh mã nguồn (ESLint)
yarn lint

# Chạy toàn bộ Unit & Integration Tests trên các workspace
yarn test
```

Mỗi Pull Request được kiểm tra tự động:
- **Lint PR**: Chuẩn hóa Conventional Commits / Semantic Pull Request.
- **Node.js CI**: Tự động test song song trên môi trường Node.js `18.x` và `20.x` với Yarn Berry immutable lockfile.

---

## 11. Giấy phép (License)

Dự án được phân phối dưới giấy phép **ISC License**. Xem thêm chi tiết tại file `LICENSE`.

<p align="center">
  <sub>Đồ án Nghiên cứu & Phát triển Hệ sinh thái Game AI & Real-Time Multiplayer Platform.</sub>
</p>
