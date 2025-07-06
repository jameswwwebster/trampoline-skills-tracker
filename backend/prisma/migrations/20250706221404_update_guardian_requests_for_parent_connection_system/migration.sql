/*
  Warnings:

  - Added the required column `clubId` to the `guardian_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `relationshipToGymnast` to the `guardian_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requestedGymnastFirstName` to the `guardian_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requestedGymnastLastName` to the `guardian_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requesterEmail` to the `guardian_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requesterFirstName` to the `guardian_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requesterLastName` to the `guardian_requests` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "guardian_requests" DROP CONSTRAINT "guardian_requests_guardianId_fkey";

-- DropForeignKey
ALTER TABLE "guardian_requests" DROP CONSTRAINT "guardian_requests_gymnastId_fkey";

-- DropIndex
DROP INDEX "guardian_requests_guardianId_gymnastId_key";

-- AlterTable
ALTER TABLE "guardian_requests" ADD COLUMN     "clubId" TEXT NOT NULL,
ADD COLUMN     "relationshipToGymnast" TEXT NOT NULL,
ADD COLUMN     "requestedGymnastDOB" TIMESTAMP(3),
ADD COLUMN     "requestedGymnastFirstName" TEXT NOT NULL,
ADD COLUMN     "requestedGymnastLastName" TEXT NOT NULL,
ADD COLUMN     "requesterEmail" TEXT NOT NULL,
ADD COLUMN     "requesterFirstName" TEXT NOT NULL,
ADD COLUMN     "requesterLastName" TEXT NOT NULL,
ADD COLUMN     "requesterPhone" TEXT,
ALTER COLUMN "guardianId" DROP NOT NULL,
ALTER COLUMN "gymnastId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "guardian_requests" ADD CONSTRAINT "guardian_requests_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_requests" ADD CONSTRAINT "guardian_requests_gymnastId_fkey" FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_requests" ADD CONSTRAINT "guardian_requests_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
