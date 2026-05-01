-- Per-routine difficulty / FIG notation overrides on implicit (custom-named) skills.
-- Tracked skills keep reading these from the linked Skill row.

ALTER TABLE "routine_skills"
  ADD COLUMN "difficulty"  DECIMAL(4,1),
  ADD COLUMN "figNotation" TEXT;
