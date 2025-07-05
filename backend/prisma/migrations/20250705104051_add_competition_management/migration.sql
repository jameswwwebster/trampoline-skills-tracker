/*
  Warnings:

  - The values [PARENT] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `competitionLevel` on the `levels` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CompetitionCategory" AS ENUM ('CLUB', 'REGIONAL', 'LEAGUE', 'NATIONAL', 'INTERNATIONAL');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('CLUB_ADMIN', 'COACH', 'GUARDIAN', 'GYMNAST');
ALTER TABLE "invites" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TABLE "invites" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "invites" ALTER COLUMN "role" SET DEFAULT 'COACH';
COMMIT;

-- AlterTable
ALTER TABLE "levels" DROP COLUMN "competitionLevel";

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "category" "CompetitionCategory" NOT NULL,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "level_competitions" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "level_competitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competitions_code_key" ON "competitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "level_competitions_levelId_competitionId_key" ON "level_competitions"("levelId", "competitionId");

-- AddForeignKey
ALTER TABLE "level_competitions" ADD CONSTRAINT "level_competitions_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_competitions" ADD CONSTRAINT "level_competitions_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
