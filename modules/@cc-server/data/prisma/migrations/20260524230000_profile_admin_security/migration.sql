ALTER TABLE "users" ADD COLUMN "profile_bio" VARCHAR(280);
ALTER TABLE "users" ADD COLUMN "role" VARCHAR(20) NOT NULL DEFAULT 'player';
ALTER TABLE "users" ADD COLUMN "locked_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "locked_reason" VARCHAR(255);

ALTER TABLE "reports" ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'open';
ALTER TABLE "reports" ADD COLUMN "admin_note" VARCHAR(500);
ALTER TABLE "reports" ADD COLUMN "resolved_at" TIMESTAMP(3);
ALTER TABLE "reports" ADD COLUMN "resolved_by_user_id" TEXT;

CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

CREATE TABLE "game_events" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "game_events_status_starts_at_idx" ON "game_events"("status", "starts_at");
