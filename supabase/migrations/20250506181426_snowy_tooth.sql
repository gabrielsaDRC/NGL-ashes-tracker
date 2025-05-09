/*
  # Add timestamp display to character table

  1. Changes
    - Add created_at and updated_at columns to characters table
    - Set default values for timestamps
    - Add trigger to automatically update updated_at
*/

-- Add timestamps if they don't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'characters' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE characters 
    ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'characters' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE characters 
    ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the trigger if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.triggers 
    WHERE trigger_name = 'update_characters_updated_at'
  ) THEN
    CREATE TRIGGER update_characters_updated_at
      BEFORE UPDATE ON characters
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;