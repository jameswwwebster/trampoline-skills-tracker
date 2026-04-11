-- Add entryType, synchroPairId, previousPaidAmount columns to competition_entries
ALTER TABLE "competition_entries" ADD COLUMN IF NOT EXISTS "entryType" TEXT NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE "competition_entries" ADD COLUMN IF NOT EXISTS "synchroPairId" TEXT;
ALTER TABLE "competition_entries" ADD COLUMN IF NOT EXISTS "previousPaidAmount" INTEGER;

-- Drop old unique constraint and create new one including entryType
ALTER TABLE "competition_entries" DROP CONSTRAINT IF EXISTS "competition_entries_competitionEventId_gymnastId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "competition_entries_competitionEventId_gymnastId_entryType_key" ON "competition_entries"("competitionEventId", "gymnastId", "entryType");
