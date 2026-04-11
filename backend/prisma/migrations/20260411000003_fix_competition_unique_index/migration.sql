-- The previous migration incorrectly used DROP CONSTRAINT instead of DROP INDEX.
-- Prisma creates @@unique as a unique INDEX not a constraint, so the old index
-- on (competitionEventId, gymnastId) was never removed from the database.
-- This migration drops it so that a gymnast can have both an INDIVIDUAL and a
-- SYNCHRO entry for the same competition.

DROP INDEX IF EXISTS "competition_entries_competitionEventId_gymnastId_key";

-- Ensure the replacement index exists (idempotent if already created)
CREATE UNIQUE INDEX IF NOT EXISTS "competition_entries_competitionEventId_gymnastId_entryType_key"
  ON "competition_entries"("competitionEventId", "gymnastId", "entryType");
