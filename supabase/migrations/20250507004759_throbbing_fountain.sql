-- Add equipment column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'characters' AND column_name = 'equipment'
  ) THEN
    ALTER TABLE characters 
    ADD COLUMN equipment JSONB DEFAULT '{}'::jsonb NOT NULL;
  END IF;
END $$;

-- Update any existing rows that have null equipment
UPDATE characters 
SET equipment = '{}'::jsonb 
WHERE equipment IS NULL;