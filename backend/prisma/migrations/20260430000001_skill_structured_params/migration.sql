-- Add structured parameters that drive the difficulty / FIG calculator.
-- Existing rows keep NULLs; the Skill modal hydrates from these on edit
-- and persists them on save.

ALTER TABLE "skills"
  ADD COLUMN "quarterSoms"      INTEGER,
  ADD COLUMN "halfTwistsPerSom" TEXT,
  ADD COLUMN "shape"            TEXT,
  ADD COLUMN "landing"          TEXT,
  ADD COLUMN "direction"        TEXT;
