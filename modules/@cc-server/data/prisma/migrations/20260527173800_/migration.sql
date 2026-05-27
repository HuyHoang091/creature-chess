-- AlterTable
ALTER TABLE "admin_sessions" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "game_events" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user_sessions" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ai_coach_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" VARCHAR(20) NOT NULL DEFAULT 'free',
    "queries_used" INTEGER NOT NULL DEFAULT 0,
    "queries_limit" INTEGER NOT NULL DEFAULT 5,
    "positioning_used" INTEGER NOT NULL DEFAULT 0,
    "positioning_limit" INTEGER NOT NULL DEFAULT 3,
    "build_used" INTEGER NOT NULL DEFAULT 0,
    "build_limit" INTEGER NOT NULL DEFAULT 2,
    "battle_analysis_used" INTEGER NOT NULL DEFAULT 0,
    "battle_analysis_limit" INTEGER NOT NULL DEFAULT 1,
    "period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_end" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_coach_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_coach_payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "paypal_order_id" TEXT NOT NULL,
    "plan" VARCHAR(20) NOT NULL,
    "amount_usd" DOUBLE PRECISION NOT NULL,
    "amount_vnd" DOUBLE PRECISION,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "payer_email" VARCHAR(191),
    "payer_name" VARCHAR(100),
    "paypal_capture_id" VARCHAR(100),
    "error_message" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_coach_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_coach_subscriptions_user_id_key" ON "ai_coach_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "ai_coach_subscriptions_user_id_plan_idx" ON "ai_coach_subscriptions"("user_id", "plan");

-- CreateIndex
CREATE UNIQUE INDEX "ai_coach_payments_paypal_order_id_key" ON "ai_coach_payments"("paypal_order_id");

-- CreateIndex
CREATE INDEX "ai_coach_payments_user_id_created_at_idx" ON "ai_coach_payments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_coach_payments_status_idx" ON "ai_coach_payments"("status");
