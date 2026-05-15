CREATE TABLE "friend_requests" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "friendships" (
    "id" TEXT NOT NULL,
    "user_low_id" TEXT NOT NULL,
    "user_high_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "blocker_user_id" TEXT NOT NULL,
    "blocked_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "player_count" INTEGER NOT NULL,
    "winner_user_id" TEXT,
    "persisted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_participants" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "user_id" TEXT,
    "guest_id" TEXT,
    "display_name" TEXT NOT NULL,
    "placement" INTEGER NOT NULL,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "result" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporter_user_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "match_id" TEXT,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "friend_requests_sender_id_receiver_id_key" ON "friend_requests"("sender_id", "receiver_id");
CREATE INDEX "friend_requests_receiver_id_status_idx" ON "friend_requests"("receiver_id", "status");
CREATE INDEX "friend_requests_sender_id_status_idx" ON "friend_requests"("sender_id", "status");

CREATE UNIQUE INDEX "friendships_user_low_id_user_high_id_key" ON "friendships"("user_low_id", "user_high_id");
CREATE INDEX "friendships_user_low_id_idx" ON "friendships"("user_low_id");
CREATE INDEX "friendships_user_high_id_idx" ON "friendships"("user_high_id");

CREATE UNIQUE INDEX "blocks_blocker_user_id_blocked_user_id_key" ON "blocks"("blocker_user_id", "blocked_user_id");
CREATE INDEX "blocks_blocker_user_id_idx" ON "blocks"("blocker_user_id");

CREATE INDEX "matches_mode_ended_at_idx" ON "matches"("mode", "ended_at");
CREATE INDEX "match_participants_match_id_idx" ON "match_participants"("match_id");
CREATE INDEX "match_participants_user_id_created_at_idx" ON "match_participants"("user_id", "created_at");
CREATE INDEX "reports_target_user_id_created_at_idx" ON "reports"("target_user_id", "created_at");
