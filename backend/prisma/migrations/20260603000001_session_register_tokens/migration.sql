CREATE TABLE "session_register_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sessionInstanceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_register_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_register_tokens_token_key" ON "session_register_tokens"("token");
CREATE INDEX "session_register_tokens_sessionInstanceId_idx" ON "session_register_tokens"("sessionInstanceId");

ALTER TABLE "session_register_tokens" ADD CONSTRAINT "session_register_tokens_sessionInstanceId_fkey"
  FOREIGN KEY ("sessionInstanceId") REFERENCES "session_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_register_tokens" ADD CONSTRAINT "session_register_tokens_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
