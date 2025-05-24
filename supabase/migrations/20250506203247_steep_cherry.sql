/*
  # Add inventory transfer logging
  
  1. Changes
    - Update valid action types to include INVENTORY_TRANSFER
    - Update audit log display to show transfer details
    - Add character names to transfer logs
  
  2. Security
    - Maintains existing RLS policies
    - Only admins can view audit logs
*/

-- Update valid action types to include transfers
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS valid_action_type;
ALTER TABLE audit_logs ADD CONSTRAINT valid_action_type CHECK (
  action_type IN (
    'CHARACTER_UPDATE',
    'INVENTORY_ADD',
    'INVENTORY_REMOVE',
    'STATUS_UPDATE',
    'ROLE_UPDATE',
    'CHARACTER_DELETE',
    'INVENTORY_TRANSFER'
  )
);

-- Function to get character name by user ID
CREATE OR REPLACE FUNCTION get_character_name(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  char_name TEXT;
BEGIN
  SELECT name INTO char_name
  FROM characters
  WHERE characters.user_id = get_character_name.user_id
  AND status = 'Ativo'
  LIMIT 1;
  
  RETURN COALESCE(char_name, 'Unknown Character');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update transfer logging to include character names
CREATE OR REPLACE FUNCTION transfer_inventory_item(
  item_id UUID,
  recipient_id UUID,
  transfer_quantity INT
)
RETURNS BOOLEAN AS $$
DECLARE
  source_item RECORD;
  source_guild_id BIGINT;
  recipient_active BOOLEAN;
  from_character_name TEXT;
  to_character_name TEXT;
BEGIN
  -- Get the source item
  SELECT * INTO source_item
  FROM inventory_items
  WHERE id = item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  -- Get character names
  from_character_name := get_character_name(source_item.user_id);
  to_character_name := get_character_name(recipient_id);

  -- Check if recipient is an active guild member
  SELECT EXISTS (
    SELECT 1
    FROM guild_memberships
    WHERE user_id = recipient_id
    AND guild_id = source_item.guild_id
    AND status = 'active'
  ) INTO recipient_active;

  IF NOT recipient_active THEN
    RAISE EXCEPTION 'Recipient is not an active guild member';
  END IF;

  -- Check if transfer quantity is valid
  IF transfer_quantity <= 0 OR transfer_quantity > source_item.quantity THEN
    RAISE EXCEPTION 'Invalid transfer quantity';
  END IF;

  -- If transferring all items, delete the source item
  IF transfer_quantity = source_item.quantity THEN
    DELETE FROM inventory_items WHERE id = item_id;
  ELSE
    -- Update source item quantity
    UPDATE inventory_items
    SET quantity = quantity - transfer_quantity
    WHERE id = item_id;
  END IF;

  -- Create new item for recipient
  INSERT INTO inventory_items (
    item_guid,
    item_name,
    quantity,
    rarity,
    user_id,
    guild_id
  ) VALUES (
    source_item.item_guid,
    source_item.item_name,
    transfer_quantity,
    source_item.rarity,
    recipient_id,
    source_item.guild_id
  );

  -- Log the transfer
  INSERT INTO audit_logs (
    action_type,
    entity_type,
    entity_id,
    user_id,
    old_data,
    new_data
  ) VALUES (
    'INVENTORY_TRANSFER',
    'INVENTORY_ITEM',
    item_id::text,
    auth.uid(),
    jsonb_build_object(
      'from_user_id', source_item.user_id,
      'from_character_name', from_character_name,
      'item_name', source_item.item_name,
      'quantity', transfer_quantity,
      'rarity', source_item.rarity
    ),
    jsonb_build_object(
      'to_user_id', recipient_id,
      'to_character_name', to_character_name,
      'item_name', source_item.item_name,
      'quantity', transfer_quantity,
      'rarity', source_item.rarity
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;