ALTER TABLE "users" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "memberships" ADD COLUMN "sessionAllowancePerWeek" INTEGER NOT NULL DEFAULT 0;
ALTER TYPE "MembershipStatus" ADD VALUE 'PENDING_PAYMENT';
