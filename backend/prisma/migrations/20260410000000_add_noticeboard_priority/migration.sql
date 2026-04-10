-- CreateEnum
CREATE TYPE "NoticeboardPriority" AS ENUM ('INFO', 'IMPORTANT', 'URGENT');

-- AlterTable
ALTER TABLE "NoticeboardPost" ADD COLUMN "priority" "NoticeboardPriority" NOT NULL DEFAULT 'INFO';
