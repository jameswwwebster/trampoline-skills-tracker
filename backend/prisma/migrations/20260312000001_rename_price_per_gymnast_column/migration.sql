-- RenameColumn: only rename if the snake_case column exists (production had it, local already has camelCase)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_templates' AND column_name = 'price_per_gymnast'
  ) THEN
    ALTER TABLE "session_templates" RENAME COLUMN "price_per_gymnast" TO "pricePerGymnast";
  END IF;
END $$;
