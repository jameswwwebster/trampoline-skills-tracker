-- Separate migration: ALTER TYPE ... ADD VALUE must be committed before
-- the new enum value can be used in the same or subsequent statements.
ALTER TABLE "memberships" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
