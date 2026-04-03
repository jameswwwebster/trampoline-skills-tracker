-- Drop the global unique constraint on identifier
DROP INDEX IF EXISTS "levels_identifier_key";

-- Add a per-club unique constraint (identifier + clubId)
-- PostgreSQL treats NULL as distinct in unique constraints, so two clubs with
-- clubId=NULL can each have identifier="11" — that's correct for global levels.
CREATE UNIQUE INDEX "levels_identifier_clubId_key" ON "levels"("identifier", "clubId");
