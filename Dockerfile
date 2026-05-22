# ==========================================
# Dockerfile - Creature Chess Full Stack
# ==========================================

FROM node:18-alpine AS base

WORKDIR /app

# Cài đặt dependencies cần thiết cho Prisma và build
RUN apk add --no-cache openssl libc6-compat python3 make g++

# Copy toàn bộ project vào container
COPY . .

# Ghi đè .env.example bằng .env để env-cmd dùng đúng giá trị
RUN cp .env .env.example

# Install tất cả dependencies
RUN yarn install && yarn workspace @creature-chess/rl-bot build && yarn workspace @creature-chess/tactical-ai build

# Generate Prisma client
RUN cd modules/@cc-server/data && yarn prisma generate && cd ../../..

# Expose các port cần thiết
# 8080 = webpack dev server (web-game)
# 3000 = server-game & server-info (chung port nhưng khác process)
EXPOSE 8090 3002 3001

# Chạy dev-all (concurrently chạy cả 3 services)
CMD ["yarn", "dev-all"]
