ALTER TABLE "gymnasts"
  ADD COLUMN "bgInsuranceConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bgInsuranceConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "bgInsuranceConfirmedBy" TEXT;
