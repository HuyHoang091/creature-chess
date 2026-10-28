# @creature-chess-app/server-game

Real-time Game Server cho Creature Chess, xây dựng trên nền tảng **Node.js**, **Socket.io Cluster**, **Redux-Saga** và tích hợp trực tiếp **Reinforcement Learning Bot**.

---

## Chức năng chính

- **Socket.io Cluster**: Đồng bộ trạng thái thời gian thực giữa hàng trăm người chơi thông qua Redis Adapter (`@socket.io/redis-adapter`).
- **Nén nhị phân MessagePack**: Sử dụng `socket.io-msgpack-parser` để nén dữ liệu mạng, giảm thiểu băng thông và tối ưu ping thi đấu.
- **Vòng lặp trận đấu (Deterministic Game Loop)**:
  - Quản lý trạng thái thông qua Redux-Saga: `PREPARING` ➔ `READY` ➔ `PLAYING / COMBAT` ➔ `RESULT RESOLUTION`.
  - Authoritative Combat Simulator: Kết quả giao tranh được tính toán hoàn toàn phía server để chống gian lận.
- **Tích hợp AI Bot (Reinforcement Learning)**:
  - Hỗ trợ bot tự chơi qua 3 chế độ: `rule_based`, `rl` và `hybrid`.
  - Tự động thu thập kinh nghiệm trận đấu và cập nhật Policy Network trong quá trình thi đấu thực tế.
- **Giám sát Prometheus**: Tích hợp `prom-client` thu thập chỉ số kết nối, thời gian phân giải vòng đấu và độ trễ sự kiện.

---

## Biến môi trường cốt lõi

```ini
PORT_SERVER_GAME=3001
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/creature_chess
RAG_SERVICE_URL=http://localhost:8000

# Chế độ Bot
BOT_MODE=hybrid               # rule_based | rl | hybrid
RL_MODEL_PATH=./modules/@creature-chess/rl-bot/training/models/final
TRAINING_MODE=false           # true: tự động học và lưu checkpoint
```

---

## Khởi chạy độc lập

Từ thư mục gốc của Monorepo:

```bash
# 1. Chạy ở chế độ phát triển (Hot reload với ts-node-dev)
yarn start-server-game

# 2. Chạy với RL Bot tự động học
BOT_MODE=rl yarn start-server-game

# 3. Chạy với Hybrid Bot (RL định vị + Rule-based kinh tế)
BOT_MODE=hybrid yarn start-server-game

# 4. Build TypeScript sang JavaScript
yarn workspace @creature-chess-app/server-game build
```
