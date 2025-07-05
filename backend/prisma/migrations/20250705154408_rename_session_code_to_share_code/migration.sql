/*
  Warnings:

  - You are about to drop the column `sessionCode` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "sessionCode",
ADD COLUMN     "shareCode" TEXT;
