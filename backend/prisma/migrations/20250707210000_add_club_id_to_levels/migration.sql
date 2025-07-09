-- Add clubId column to levels table
ALTER TABLE "levels" ADD COLUMN "clubId" TEXT;

-- Add foreign key constraint
ALTER TABLE "levels" ADD CONSTRAINT "levels_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE; 