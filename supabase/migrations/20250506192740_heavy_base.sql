/*
  # Add role change tracking to audit logs
  
  1. Changes
    - Add ROLE_UPDATE to valid action types
    - Create trigger function for role changes
    - Add trigger to guild_memberships table
  
  2. Security
    - Maintains existing RLS policies
    - Only admins can view audit logs
*/

-- Update valid action types to include role changes
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS valid_action_type;
ALTER TABLE audit_logs ADD CONSTRAINT valid_action_type CHECK (
  action_type IN ('CHARACTER_UPDATE', 'INVENTORY_ADD', 'INVENTORY_REMOVE', 'STATUS_UPDATE', 'ROLE_UPDATE')
);

-- Function to log role changes
CREATE OR REPLACE FUNCTION log_role_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
    INSERT INTO audit_logs (
      action_type,
      entity_type,
      entity_id,
      user_id,
      old_data,
      new_data
    )
    VALUES (
      'ROLE_UPDATE',
      'CHARACTER',
      NEW.user_id::text,
      auth.uid(),
      jsonb_build_object(
        'role', OLD.role
      ),
      jsonb_build_object(
        'role', NEW.role
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for role changes
DROP TRIGGER IF EXISTS log_role_changes_trigger ON guild_memberships;
CREATE TRIGGER log_role_changes_trigger
  AFTER UPDATE ON guild_memberships
  FOR EACH ROW
  EXECUTE FUNCTION log_role_changes();