-- Add SYSTEM_ADMIN to UserRole enum
ALTER TYPE "UserRole" ADD VALUE 'SYSTEM_ADMIN';

-- Add archiving fields to clubs table
ALTER TABLE "clubs" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "clubs" ADD COLUMN "archivedById" TEXT;
ALTER TABLE "clubs" ADD COLUMN "archivedReason" TEXT;
ALTER TABLE "clubs" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- Add foreign key constraint for archivedById
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; 