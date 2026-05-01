-- Allow the same skill to appear multiple times in a routine (e.g. transitions).
-- Difficulty totaling dedupes by skillId in the frontend so duplicates don't
-- double-count.

DROP INDEX "routine_skills_routineId_skillId_key";
