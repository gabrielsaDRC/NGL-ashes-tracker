-- Drop and recreate the transfer function to fix audit logging
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
  remaining_quantity INTEGER;
BEGIN
  -- Get the source item
  SELECT * INTO source_item
  FROM inventory_items
  WHERE id = item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  -- Get character names
  SELECT name INTO from_character_name
  FROM characters
  WHERE user_id = source_item.user_id
  AND status = 'Ativo'
  LIMIT 1;

  SELECT name INTO to_character_name
  FROM characters
  WHERE user_id = recipient_id
  AND status = 'Ativo'
  LIMIT 1;

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

  -- Calculate remaining quantity
  remaining_quantity := source_item.quantity - transfer_quantity;

  -- Handle item transfer
  IF remaining_quantity <= 0 THEN
    -- Transfer entire item if quantity matches
    UPDATE inventory_items
    SET user_id = recipient_id
    WHERE id = item_id;
  ELSE
    -- Create new item for recipient with requested quantity
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
    
    -- Update source item quantity
    UPDATE inventory_items
    SET quantity = remaining_quantity
    WHERE id = item_id;
  END IF;

  -- Log only the transfer action
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
      'from_character_name', from_character_name,
      'item_name', source_item.item_name,
      'quantity', transfer_quantity,
      'rarity', source_item.rarity
    ),
    jsonb_build_object(
      'to_character_name', to_character_name,
      'item_name', source_item.item_name,
      'quantity', transfer_quantity,
      'rarity', source_item.rarity
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;