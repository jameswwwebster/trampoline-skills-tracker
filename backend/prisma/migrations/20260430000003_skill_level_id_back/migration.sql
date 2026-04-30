-- Re-add a denormalized Skill.levelId pointing at the skill's "primary" level.
-- The level_skills join is the source of truth for membership; levelId is kept
-- in sync by application code when a skill is first attached. Library-only
-- skills have levelId = NULL.
--
-- This unblocks routes that haven't been migrated to read via levelSkills yet
-- (progress, gymnasts, dashboard) — they continue to use skill.level as before.

BEGIN;

ALTER TABLE "skills" ADD COLUMN "levelId" TEXT;

-- Backfill: take any one attached level per skill (lowest order)
UPDATE "skills" s
SET "levelId" = (
    SELECT ls."levelId"
    FROM "level_skills" ls
    WHERE ls."skillId" = s.id
    ORDER BY ls."order" ASC
    LIMIT 1
);

ALTER TABLE "skills"
    ADD CONSTRAINT "skills_levelId_fkey"
    FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON UPDATE CASCADE ON DELETE SET NULL;

COMMIT;
