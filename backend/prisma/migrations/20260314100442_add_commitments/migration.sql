/*
  Warnings:

  - You are about to drop the column `waitlistEntries` on the `session_instances` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CommitmentStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_clubId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "credits" DROP CONSTRAINT "credits_sourceBookingId_fkey";

-- AlterTable
ALTER TABLE "session_instances" DROP COLUMN "waitlistEntries";

-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL,
    "gymnastId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "CommitmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "pausedAt" TIMESTAMP(3),
    "pausedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Commitment_gymnastId_templateId_key" ON "Commitment"("gymnastId", "templateId");

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_gymnastId_fkey" FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "session_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_pausedById_fkey" FOREIGN KEY ("pausedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_sourceBookingId_fkey" FOREIGN KEY ("sourceBookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
