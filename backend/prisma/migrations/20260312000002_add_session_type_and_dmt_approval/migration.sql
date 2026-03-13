-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('STANDARD', 'DMT');

-- AlterTable
ALTER TABLE "gymnasts" ADD COLUMN "dmtApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "dmtApprovedAt" TIMESTAMP(3),
ADD COLUMN "dmtApprovedById" TEXT;

-- AlterTable
ALTER TABLE "session_templates" ADD COLUMN "type" "SessionType" NOT NULL DEFAULT 'STANDARD';

-- AddForeignKey
ALTER TABLE "gymnasts" ADD CONSTRAINT "gymnasts_dmtApprovedById_fkey" FOREIGN KEY ("dmtApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
