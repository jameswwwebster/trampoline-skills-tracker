CREATE TYPE "BgNumberStatus" AS ENUM ('PENDING', 'VERIFIED', 'INVALID');

ALTER TABLE "gymnasts"
  ADD COLUMN "bgNumber" TEXT,
  ADD COLUMN "bgNumberStatus" "BgNumberStatus",
  ADD COLUMN "bgNumberGraceDays" INTEGER,
  ADD COLUMN "bgNumberEnteredAt" TIMESTAMP(3),
  ADD COLUMN "bgNumberEnteredBy" TEXT,
  ADD COLUMN "bgNumberVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "bgNumberVerifiedBy" TEXT;
