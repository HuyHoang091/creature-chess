ALTER TABLE "users" ADD COLUMN "locked_until" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "warning_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "last_logout_at" TIMESTAMP(3);

ALTER TABLE "reports" ADD COLUMN "description" VARCHAR(500);
ALTER TABLE "reports" ADD COLUMN "action_type" VARCHAR(40);
ALTER TABLE "reports" ADD COLUMN "action_expires_at" TIMESTAMP(3);
ALTER TABLE "reports" ADD COLUMN "reporter_ip" VARCHAR(64);

UPDATE "reports"
SET "status" = CASE
    WHEN "status" = 'open' THEN 'pending'
    WHEN "status" = 'reviewing' THEN 'reviewed'
    WHEN "status" = 'resolved' THEN 'actioned'
    ELSE "status"
END;

ALTER TABLE "reports" ALTER COLUMN "status" SET DEFAULT 'pending';

CREATE TABLE "admin_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_sessions_token_key" ON "admin_sessions"("token");
CREATE INDEX "admin_sessions_user_id_expires_at_idx" ON "admin_sessions"("user_id", "expires_at");

CREATE TABLE "admin_user_permissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission" VARCHAR(64) NOT NULL,
    "granted_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_user_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_user_permissions_user_id_permission_key" ON "admin_user_permissions"("user_id", "permission");
CREATE INDEX "admin_user_permissions_permission_idx" ON "admin_user_permissions"("permission");

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "target_user_id" TEXT,
    "action" VARCHAR(120) NOT NULL,
    "reason" VARCHAR(500),
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_target_user_id_created_at_idx" ON "audit_logs"("target_user_id", "created_at");
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

CREATE TABLE "moderation_warnings" (
    "id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "reporter_user_id" TEXT,
    "admin_user_id" TEXT NOT NULL,
    "report_id" TEXT,
    "message" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_warnings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "moderation_warnings_target_user_id_created_at_idx" ON "moderation_warnings"("target_user_id", "created_at");

CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "payload" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_notifications_user_id_created_at_idx" ON "user_notifications"("user_id", "created_at");

CREATE TABLE "email_outbox" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" VARCHAR(191) NOT NULL,
    "template" VARCHAR(80) NOT NULL,
    "subject" VARCHAR(191) NOT NULL,
    "payload" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "error_message" VARCHAR(500),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_outbox_status_created_at_idx" ON "email_outbox"("status", "created_at");
CREATE INDEX "email_outbox_email_created_at_idx" ON "email_outbox"("email", "created_at");

CREATE TABLE "monitoring_snapshots" (
    "id" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "api_server_status" VARCHAR(20) NOT NULL DEFAULT 'unknown',
    "game_server_status" VARCHAR(20) NOT NULL DEFAULT 'unknown',
    "rag_service_status" VARCHAR(20) NOT NULL DEFAULT 'unknown',
    "database_status" VARCHAR(20) NOT NULL DEFAULT 'unknown',
    "redis_status" VARCHAR(20) NOT NULL DEFAULT 'unknown',
    "cpu_percent" DOUBLE PRECISION,
    "rss_mb" INTEGER NOT NULL DEFAULT 0,
    "heap_used_mb" INTEGER NOT NULL DEFAULT 0,
    "disk_used_mb" INTEGER,
    "network_in_mb" DOUBLE PRECISION,
    "network_out_mb" DOUBLE PRECISION,
    "db_latency_ms" DOUBLE PRECISION,
    "average_request_ms" DOUBLE PRECISION,
    "api_requests" INTEGER NOT NULL DEFAULT 0,
    "api_4xx" INTEGER NOT NULL DEFAULT 0,
    "api_5xx" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "socket_connections" INTEGER NOT NULL DEFAULT 0,
    "active_players" INTEGER NOT NULL DEFAULT 0,
    "players_in_room" INTEGER NOT NULL DEFAULT 0,
    "players_in_game" INTEGER NOT NULL DEFAULT 0,
    "active_rooms" INTEGER NOT NULL DEFAULT 0,
    "active_games" INTEGER NOT NULL DEFAULT 0,
    "games_started_per_hour" DOUBLE PRECISION,
    "battles_started_per_hour" DOUBLE PRECISION,
    "avg_match_duration_s" DOUBLE PRECISION,
    "socket_in_mb" DOUBLE PRECISION,
    "socket_out_mb" DOUBLE PRECISION,
    "open_reports" INTEGER NOT NULL DEFAULT 0,
    "locked_users" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "monitoring_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "monitoring_snapshots_captured_at_idx" ON "monitoring_snapshots"("captured_at");
