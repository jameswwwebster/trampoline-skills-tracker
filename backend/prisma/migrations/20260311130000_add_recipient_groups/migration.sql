ALTER TABLE "NoticeboardPost" ADD COLUMN "recipientFilter" JSONB;

CREATE TABLE "RecipientGroup" (
  "id"              TEXT NOT NULL,
  "clubId"          TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "recipientFilter" JSONB NOT NULL,
  "createdById"     TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecipientGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RecipientGroup"
  ADD CONSTRAINT "RecipientGroup_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecipientGroup"
  ADD CONSTRAINT "RecipientGroup_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
