/*
  # Add character deletion logging
  
  1. Changes
    - Add CHARACTER_DELETE to valid action types
    - Update handle_character_deletion function to log deletions
  
  2. Security
    - Maintains existing RLS policies
    - Only admins can view audit logs
*/

-- Update valid action types to include character deletion
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS valid_action_type;
ALTER TABLE audit_logs ADD CONSTRAINT valid_action_type CHECK (
  action_type IN ('CHARACTER_UPDATE', 'INVENTORY_ADD', 'INVENTORY_REMOVE', 'STATUS_UPDATE', 'ROLE_UPDATE', 'CHARACTER_DELETE')
);

-- Update the character deletion handler to log deletions
CREATE OR REPLACE FUNCTION handle_character_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the character deletion
  INSERT INTO audit_logs (
    action_type,
    entity_type,
    entity_id,
    user_id,
    old_data
  )
  VALUES (
    'CHARACTER_DELETE',
    'CHARACTER',
    OLD.id::text,
    auth.uid(),
    jsonb_build_object(
      'id', OLD.id,
      'name', OLD.name,
      'type', OLD.type,
      'primary_class', OLD.primary_class,
      'secondary_class', OLD.secondary_class,
      'status', OLD.status,
      'character_name', OLD.name
    )
  );

  -- Delete inventory items belonging to the deleted character's user
  DELETE FROM inventory_items 
  WHERE user_id = OLD.user_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;