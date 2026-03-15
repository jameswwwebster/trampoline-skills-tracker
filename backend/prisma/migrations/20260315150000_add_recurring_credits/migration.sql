CREATE TABLE "recurring_credits" (
  "id"           TEXT NOT NULL,
  "clubId"       TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "amountPence"  INTEGER NOT NULL,
  "endDate"      TIMESTAMP(3),
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "lastIssuedAt" TIMESTAMP(3),
  "createdById"  TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "recurring_credits_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "recurring_credits"
  ADD CONSTRAINT "recurring_credits_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "clubs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurring_credits"
  ADD CONSTRAINT "recurring_credits_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurring_credits"
  ADD CONSTRAINT "recurring_credits_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
