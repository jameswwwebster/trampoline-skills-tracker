/*
  Warnings:

  - You are about to drop the column `familyAccessCode` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "codeOfTheDay" TEXT,
ADD COLUMN     "codeOfTheDayExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" DROP COLUMN "familyAccessCode",
ADD COLUMN     "sessionCode" TEXT;
