ALTER TABLE "users" ADD COLUMN "email" VARCHAR(191);
ALTER TABLE "users" ADD COLUMN "password_hash" VARCHAR(255);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_sessions_token_key" ON "user_sessions"("token");
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");
