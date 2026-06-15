/*
  Warnings:

  - A unique constraint covering the columns `[page_slug]` on the table `game_events` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "game_events" ADD COLUMN     "banner_url" VARCHAR(500),
ADD COLUMN     "page_content" TEXT,
ADD COLUMN     "page_slug" VARCHAR(100),
ADD COLUMN     "rewards" TEXT,
ADD COLUMN     "tasks" TEXT,
ADD COLUMN     "theme_color" VARCHAR(20),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(2000);

-- CreateTable
CREATE TABLE "user_currencies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "gems" INTEGER NOT NULL DEFAULT 0,
    "tickets" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_player_progress" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_id" VARCHAR(80) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_player_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_currencies_user_id_key" ON "user_currencies"("user_id");

-- CreateIndex
CREATE INDEX "user_currencies_user_id_idx" ON "user_currencies"("user_id");

-- CreateIndex
CREATE INDEX "event_player_progress_event_id_user_id_idx" ON "event_player_progress"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "event_player_progress_user_id_event_id_idx" ON "event_player_progress"("user_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_player_progress_event_id_user_id_task_id_key" ON "event_player_progress"("event_id", "user_id", "task_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_events_page_slug_key" ON "game_events"("page_slug");

-- CreateIndex
CREATE INDEX "game_events_page_slug_idx" ON "game_events"("page_slug");
