ALTER TABLE "charges" ADD COLUMN "paidWithCredit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "credits" ADD COLUMN "usedOnChargeId" TEXT;
ALTER TABLE "credits" ADD CONSTRAINT "credits_usedOnChargeId_fkey" FOREIGN KEY ("usedOnChargeId") REFERENCES "charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
