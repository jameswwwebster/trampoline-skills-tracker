-- Per-line soft-delete so a single gymnast can be cancelled out of a
-- multi-gymnast booking without affecting the other gymnasts. Existing rows
-- (NULL) remain active.

ALTER TABLE "booking_lines" ADD COLUMN "cancelledAt" TIMESTAMP(3);
CREATE INDEX "booking_lines_cancelledAt_idx" ON "booking_lines"("cancelledAt");
