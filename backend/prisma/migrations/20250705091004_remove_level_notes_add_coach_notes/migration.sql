/*
  Warnings:

  - You are about to drop the column `notes` on the `level_progress` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "gymnasts" ADD COLUMN     "coachNotes" TEXT;

-- AlterTable
ALTER TABLE "level_progress" DROP COLUMN "notes";
