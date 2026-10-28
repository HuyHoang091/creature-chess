# ==========================================
# Creature Chess - Automation Makefile
# ==========================================

.PHONY: all rebuild install build db server down add-migration prisma-generate test lint train-bot

all: install build db server
rebuild: build server

# Cài đặt dependencies (Yarn Berry Modern)
install:
	@echo "Setting up dependencies..."
	corepack enable
	yarn install

# Build Docker images
build:
	@echo "Building docker images..."
	docker compose build

# Khởi động database và chạy migration
db:
	@echo "Starting database..."
	docker compose up -d postgres redis
	@echo "Deploying database migrations..."
	yarn workspace @cc-server/data prisma migrate deploy || docker compose run --rm server-info yarn workspace @cc-server/data prisma migrate deploy

# Khởi động toàn bộ game server & web client
server:
	@echo "Running Creature Chess services..."
	docker compose up -d postgres redis server-info server-game frontend nginx

# Dừng toàn bộ services
down:
	@echo "Stopping all services..."
	docker compose down

# Tạo migration mới cho Prisma
add-migration:
	@echo "Creating new migration..."
	yarn workspace @cc-server/data prisma migrate dev
	yarn workspace @cc-server/data run prisma-generate

# Generate Prisma Client
prisma-generate:
	@echo "Generating prisma client..."
	yarn workspace @cc-server/data run prisma-generate

# Chạy kiểm thử tự động
test:
	yarn test

# Kiểm tra lint
lint:
	yarn lint

# Huấn luyện RL Bot
train-bot:
	node train-bot.js

