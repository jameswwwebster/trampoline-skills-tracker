-- Gymnasts with bgInsuranceConfirmed=true become VERIFIED
UPDATE "gymnasts"
SET "bgNumberStatus" = 'VERIFIED'
WHERE "bgInsuranceConfirmed" = true;

-- Drop old fields
ALTER TABLE "gymnasts"
  DROP COLUMN "bgInsuranceConfirmed",
  DROP COLUMN "bgInsuranceConfirmedAt",
  DROP COLUMN "bgInsuranceConfirmedBy";
