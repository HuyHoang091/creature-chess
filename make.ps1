# ==========================================
# Creature Chess - Automation Helper (PowerShell)
# Usage: .\make.ps1 <command>
# Example: .\make.ps1 server
# ==========================================

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

switch ($Command.ToLower()) {
    "install" {
        Write-Host "Setting up dependencies..." -ForegroundColor Cyan
        corepack enable
        yarn install
    }
    "build" {
        Write-Host "Building Docker images..." -ForegroundColor Cyan
        docker compose build
    }
    "db" {
        Write-Host "Starting database (Postgres & Redis)..." -ForegroundColor Cyan
        docker compose up -d postgres redis
        Write-Host "Deploying database migrations..." -ForegroundColor Cyan
        yarn workspace @cc-server/data prisma migrate deploy
    }
    "server" {
        Write-Host "Running Creature Chess services..." -ForegroundColor Cyan
        docker compose up -d postgres redis server-info server-game frontend nginx
    }
    "down" {
        Write-Host "Stopping all services..." -ForegroundColor Cyan
        docker compose down
    }
    "add-migration" {
        Write-Host "Creating new migration..." -ForegroundColor Cyan
        yarn workspace @cc-server/data prisma migrate dev
        yarn workspace @cc-server/data run prisma-generate
    }
    "prisma-generate" {
        Write-Host "Generating prisma client..." -ForegroundColor Cyan
        yarn workspace @cc-server/data run prisma-generate
    }
    "test" {
        yarn test
    }
    "lint" {
        yarn lint
    }
    "train-bot" {
        node train-bot.js
    }
    default {
        Write-Host "=============================================" -ForegroundColor Green
        Write-Host "  Creature Chess - Automation Tasks" -ForegroundColor Green
        Write-Host "=============================================" -ForegroundColor Green
        Write-Host "Available commands:"
        Write-Host "  .\make.ps1 install          - Install Yarn Berry dependencies"
        Write-Host "  .\make.ps1 build            - Build docker images"
        Write-Host "  .\make.ps1 db               - Start Postgres & Redis and run Prisma migration"
        Write-Host "  .\make.ps1 server           - Run all game services via Docker"
        Write-Host "  .\make.ps1 down             - Stop all running containers"
        Write-Host "  .\make.ps1 prisma-generate  - Generate Prisma Client"
        Write-Host "  .\make.ps1 test             - Run workspaces tests"
        Write-Host "  .\make.ps1 lint             - Run ESLint"
        Write-Host "  .\make.ps1 train-bot        - Run RL Bot simulation"
    }
}
