-- CreateEnum
CREATE TYPE "NoticeboardPriority" AS ENUM ('INFO', 'IMPORTANT', 'URGENT');

-- AlterTable
ALTER TABLE "noticeboard_posts" ADD COLUMN "priority" "NoticeboardPriority" NOT NULL DEFAULT 'INFO';
