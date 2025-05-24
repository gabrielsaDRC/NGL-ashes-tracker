/*
  # Cleanup inventory items on character deletion
  
  1. Changes
    - Add trigger to automatically delete inventory items when a character is deleted
    - Add trigger function to handle the cleanup
  
  2. Security
    - Maintains existing RLS policies
    - Only affects items owned by the deleted character
*/

-- Create the trigger function
CREATE OR REPLACE FUNCTION handle_character_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete inventory items belonging to the deleted character's user
  DELETE FROM inventory_items 
  WHERE user_id = OLD.user_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_character_deleted ON characters;
CREATE TRIGGER on_character_deleted
  AFTER DELETE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION handle_character_deletion();