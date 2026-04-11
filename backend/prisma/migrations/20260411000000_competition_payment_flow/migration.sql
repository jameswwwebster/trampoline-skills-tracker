-- Add new enum values for competition entry status
ALTER TYPE "CompetitionEntryStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "CompetitionEntryStatus" ADD VALUE IF NOT EXISTS 'WAIVED';

-- Add new columns to competition_entries
ALTER TABLE "competition_entries"
  ADD COLUMN IF NOT EXISTS "invoiceSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "waivedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "paidExternally" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "externalPaymentNote" TEXT;
