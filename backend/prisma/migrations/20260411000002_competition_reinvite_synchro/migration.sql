-- Add entryType, synchroPairId, previousPaidAmount columns to competition_entries
ALTER TABLE "competition_entries" ADD COLUMN IF NOT EXISTS "entryType" TEXT NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE "competition_entries" ADD COLUMN IF NOT EXISTS "synchroPairId" TEXT;
ALTER TABLE "competition_entries" ADD COLUMN IF NOT EXISTS "previousPaidAmount" INTEGER;

-- Drop old unique index (Prisma creates UNIQUE INDEX, not CONSTRAINT) and replace with one that includes entryType
DROP INDEX IF EXISTS "competition_entries_competitionEventId_gymnastId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "competition_entries_competitionEventId_gymnastId_entryType_key" ON "competition_entries"("competitionEventId", "gymnastId", "entryType");
