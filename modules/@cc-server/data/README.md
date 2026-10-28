# @cc-server/data

Module quản lý tầng dữ liệu (Database Persistence Layer) cho Creature Chess, xây dựng trên nền tảng **PostgreSQL** và **Prisma ORM**.

---

## Nội dung module

- **Prisma Schema (`prisma/schema.prisma`)**:
  - `User`: Quản lý tài khoản, mật khẩu, hồ sơ người chơi.
  - `Session`: Quản lý phiên đăng nhập hợp lệ.
  - `MatchHistory`: Lưu trữ diễn biến ván đấu, vị trí xếp hạng, synergy đã build.
  - `Leaderboard`: Thống kê điểm elo và tỷ lệ thắng.
- **Prisma Client**: Cung cấp client Typescript strongly-typed cho toàn bộ các server microservices (`server-game`, `server-info`, `server-admin`).

---

## Các lệnh quản trị cơ sở dữ liệu

Thực thi từ thư mục gốc của Monorepo:

```bash
# 1. Sinh Prisma Client sau khi thay đổi schema
yarn workspace @cc-server/data run prisma-generate

# 2. Tạo migration mới trong quá trình phát triển
yarn workspace @cc-server/data prisma migrate dev --name init_db

# 3. Áp dụng migration lên môi trường Production
yarn workspace @cc-server/data prisma migrate deploy

# 4. Kéo cấu trúc hiện tại từ database vào schema
yarn workspace @cc-server/data run prisma-db-pull
```
