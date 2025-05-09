/*
  # Add audit logging system
  
  1. New Tables
    - `audit_logs`
      - `id` (uuid, primary key)
      - `action_type` (text) - Type of action (CHARACTER_UPDATE, INVENTORY_CHANGE, STATUS_UPDATE)
      - `entity_type` (text) - Type of entity being modified (CHARACTER, INVENTORY_ITEM)
      - `entity_id` (text) - ID of the modified entity
      - `user_id` (uuid) - User who performed the action
      - `old_data` (jsonb) - Previous state
      - `new_data` (jsonb) - New state
      - `created_at` (timestamp)
      - `ip_address` (text)
  
  2. Security
    - Enable RLS on audit_logs table
    - Add policies for admin access only
    - Create triggers for automatic logging
*/

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now(),
  ip_address text,
  
  CONSTRAINT valid_action_type CHECK (
    action_type IN ('CHARACTER_UPDATE', 'INVENTORY_ADD', 'INVENTORY_REMOVE', 'STATUS_UPDATE')
  ),
  CONSTRAINT valid_entity_type CHECK (
    entity_type IN ('CHARACTER', 'INVENTORY_ITEM')
  )
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guild_memberships
      WHERE guild_memberships.user_id = auth.uid()
      AND guild_memberships.role = 'admin'
      AND guild_memberships.status = 'active'
    )
  );

-- Function to record character changes
CREATE OR REPLACE FUNCTION log_character_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only log if relevant fields changed
    IF (OLD.name != NEW.name) OR 
       (OLD.type != NEW.type) OR 
       (OLD.primary_class != NEW.primary_class) OR
       (OLD.secondary_class != NEW.secondary_class) OR
       (OLD.status != NEW.status) OR
       (OLD.skills::text != NEW.skills::text) THEN
      
      INSERT INTO audit_logs (
        action_type,
        entity_type,
        entity_id,
        user_id,
        old_data,
        new_data
      )
      VALUES (
        CASE
          WHEN OLD.status != NEW.status THEN 'STATUS_UPDATE'
          ELSE 'CHARACTER_UPDATE'
        END,
        'CHARACTER',
        OLD.id::text,
        auth.uid(),
        jsonb_build_object(
          'name', OLD.name,
          'type', OLD.type,
          'primary_class', OLD.primary_class,
          'secondary_class', OLD.secondary_class,
          'status', OLD.status,
          'skills', OLD.skills
        ),
        jsonb_build_object(
          'name', NEW.name,
          'type', NEW.type,
          'primary_class', NEW.primary_class,
          'secondary_class', NEW.secondary_class,
          'status', NEW.status,
          'skills', NEW.skills
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log inventory changes
CREATE OR REPLACE FUNCTION log_inventory_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      action_type,
      entity_type,
      entity_id,
      user_id,
      new_data
    )
    VALUES (
      'INVENTORY_ADD',
      'INVENTORY_ITEM',
      NEW.id::text,
      auth.uid(),
      jsonb_build_object(
        'item_name', NEW.item_name,
        'item_guid', NEW.item_guid,
        'quantity', NEW.quantity,
        'rarity', NEW.rarity
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      action_type,
      entity_type,
      entity_id,
      user_id,
      old_data
    )
    VALUES (
      'INVENTORY_REMOVE',
      'INVENTORY_ITEM',
      OLD.id::text,
      auth.uid(),
      jsonb_build_object(
        'item_name', OLD.item_name,
        'item_guid', OLD.item_guid,
        'quantity', OLD.quantity,
        'rarity', OLD.rarity
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS log_character_changes_trigger ON characters;
CREATE TRIGGER log_character_changes_trigger
  AFTER UPDATE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION log_character_changes();

DROP TRIGGER IF EXISTS log_inventory_changes_trigger ON inventory_items;
CREATE TRIGGER log_inventory_changes_trigger
  AFTER INSERT OR DELETE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION log_inventory_changes();