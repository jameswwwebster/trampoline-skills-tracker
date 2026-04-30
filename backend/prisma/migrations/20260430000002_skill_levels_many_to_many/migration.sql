-- Convert Skill ↔ Level from one-to-many to many-to-many via a join table.
-- Existing Skill.levelId / Skill.order rows are backfilled into level_skills,
-- then dropped from skills.

BEGIN;

-- 1. Create the join table
CREATE TABLE "level_skills" (
    "id"        TEXT NOT NULL,
    "levelId"   TEXT NOT NULL,
    "skillId"   TEXT NOT NULL,
    "order"     INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "level_skills_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "level_skills_levelId_skillId_key" ON "level_skills"("levelId", "skillId");

ALTER TABLE "level_skills"
    ADD CONSTRAINT "level_skills_levelId_fkey"
    FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "level_skills"
    ADD CONSTRAINT "level_skills_skillId_fkey"
    FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Backfill from existing skills.levelId / skills.order
INSERT INTO "level_skills" ("id", "levelId", "skillId", "order", "createdAt")
SELECT
    'ls_' || "id",
    "levelId",
    "id",
    "order",
    "createdAt"
FROM "skills";

-- 3. Drop the old columns from skills
ALTER TABLE "skills" DROP CONSTRAINT IF EXISTS "skills_levelId_fkey";
ALTER TABLE "skills" DROP COLUMN "levelId";
ALTER TABLE "skills" DROP COLUMN "order";

COMMIT;
