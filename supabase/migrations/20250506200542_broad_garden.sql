/*
  # Improve character update logging
  
  1. Changes
    - Update log_character_changes function to include character name in logs
    - Ensure character name is included in all character-related logs
    - Add character name to status change logs
*/

-- Update the function to include character name in logs
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
          'id', OLD.id,
          'name', OLD.name,
          'type', OLD.type,
          'primary_class', OLD.primary_class,
          'secondary_class', OLD.secondary_class,
          'status', OLD.status,
          'skills', OLD.skills,
          'character_name', OLD.name -- Include character name in old data
        ),
        jsonb_build_object(
          'id', NEW.id,
          'name', NEW.name,
          'type', NEW.type,
          'primary_class', NEW.primary_class,
          'secondary_class', NEW.secondary_class,
          'status', NEW.status,
          'skills', NEW.skills,
          'character_name', NEW.name -- Include character name in new data
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;