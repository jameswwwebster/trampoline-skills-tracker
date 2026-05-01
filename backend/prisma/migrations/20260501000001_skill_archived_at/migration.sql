-- Add archivedAt for soft-delete support. NULL = active.
ALTER TABLE "skills" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "skills_archivedAt_idx" ON "skills"("archivedAt");
