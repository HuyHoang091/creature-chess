-- AlterTable
ALTER TABLE "game_events" ADD COLUMN     "config" TEXT,
ADD COLUMN     "event_type" VARCHAR(40) DEFAULT 'generic';
