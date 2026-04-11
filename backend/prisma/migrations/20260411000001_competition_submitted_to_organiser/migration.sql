ALTER TABLE "competition_entries"
  ADD COLUMN IF NOT EXISTS "submittedToOrganiser" BOOLEAN NOT NULL DEFAULT false;
