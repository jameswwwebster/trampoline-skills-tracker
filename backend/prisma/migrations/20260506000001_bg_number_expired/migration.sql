-- Adds the EXPIRED status to BgNumberStatus and a bgNumberExpiredAt timestamp
-- so the booking soft-block grace period is counted from when admin marked
-- the membership expired (not from the original entry).

-- ALTER TYPE … ADD VALUE may run alongside DDL but must not be used in the
-- same transaction as data that references the new value. This migration is
-- DDL-only — code that writes 'EXPIRED' rows lands in the next deploy.

ALTER TYPE "BgNumberStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "gymnasts" ADD COLUMN "bgNumberExpiredAt" TIMESTAMP(3);
