-- New enums
CREATE TYPE "MessageStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED');
CREATE TYPE "MessageRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "DeletionReason" AS ENUM ('INACTIVITY', 'MANUAL');

-- Club automation flags
ALTER TABLE "clubs" ADD COLUMN "sessionReminderEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "clubs" ADD COLUMN "membershipReminderEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "clubs" ADD COLUMN "inactivityWarningEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Messages
CREATE TABLE "messages" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "htmlBody" TEXT NOT NULL,
  "status" "MessageStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "recipientFilter" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- Message recipients
CREATE TABLE "message_recipients" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" "MessageRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "message_recipients_pkey" PRIMARY KEY ("id")
);

-- Archived member summaries
CREATE TABLE "archived_member_summaries" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "totalAmountPaid" INTEGER NOT NULL,
  "sessionsAttended" INTEGER NOT NULL,
  "membershipCount" INTEGER NOT NULL,
  "deletionReason" "DeletionReason" NOT NULL,
  "deletedBy" TEXT,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "archived_member_summaries_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "messages" ADD CONSTRAINT "messages_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "archived_member_summaries" ADD CONSTRAINT "archived_member_summaries_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
