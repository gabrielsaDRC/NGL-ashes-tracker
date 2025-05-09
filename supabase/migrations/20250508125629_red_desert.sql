/*
  # Fix buy order acceptance to handle partial transfers
  
  1. Changes
    - Update handle_buy_order_acceptance function to handle partial transfers
    - Only transfer requested quantity instead of entire inventory item
    - Create new inventory item for creator if partial transfer
    - Delete or update source item based on remaining quantity
  
  2. Security
    - Maintains existing RLS policies
    - Ensures data integrity during transfers
*/

-- Update the buy order acceptance handler
CREATE OR REPLACE FUNCTION handle_buy_order_acceptance()
RETURNS TRIGGER AS $$
DECLARE
  order_data RECORD;
  responder_balance RECORD;
  responder_name TEXT;
  creator_name TEXT;
  source_item RECORD;
  remaining_quantity INTEGER;
BEGIN
  -- Only proceed if status is changing to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Get order details
    SELECT * INTO order_data FROM buy_orders WHERE id = NEW.order_id;
    
    -- Get source item details
    SELECT * INTO source_item 
    FROM inventory_items 
    WHERE id = NEW.inventory_item_id;
    
    -- Calculate remaining quantity
    remaining_quantity := source_item.quantity - order_data.quantity;
    
    -- Get character names
    SELECT name INTO responder_name
    FROM characters
    WHERE user_id = NEW.responder_id
    AND status = 'Ativo'
    LIMIT 1;

    SELECT name INTO creator_name
    FROM characters
    WHERE user_id = order_data.creator_id
    AND status = 'Ativo'
    LIMIT 1;
    
    -- Update order status
    UPDATE buy_orders
    SET status = 'completed'
    WHERE id = NEW.order_id;
    
    -- Handle item transfer
    IF remaining_quantity <= 0 THEN
      -- Transfer entire item if quantity matches
      UPDATE inventory_items
      SET user_id = order_data.creator_id
      WHERE id = NEW.inventory_item_id;
    ELSE
      -- Create new item for creator with requested quantity
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
        order_data.quantity,
        source_item.rarity,
        order_data.creator_id,
        source_item.guild_id
      );
      
      -- Update source item quantity
      UPDATE inventory_items
      SET quantity = remaining_quantity
      WHERE id = NEW.inventory_item_id;
    END IF;
    
    -- Add points to responder's balance
    SELECT * INTO responder_balance 
    FROM points_balance 
    WHERE user_id = NEW.responder_id;
    
    IF FOUND THEN
      UPDATE points_balance
      SET balance = balance + order_data.points_reward,
          updated_at = now()
      WHERE user_id = NEW.responder_id;
    ELSE
      INSERT INTO points_balance (user_id, balance)
      VALUES (NEW.responder_id, order_data.points_reward);
    END IF;
    
    -- Reject all other pending responses for this order
    UPDATE buy_order_responses
    SET status = 'rejected'
    WHERE order_id = NEW.order_id
    AND id != NEW.id
    AND status = 'pending';

    -- Log the order completion
    INSERT INTO audit_logs (
      action_type,
      entity_type,
      entity_id,
      user_id,
      old_data,
      new_data
    ) VALUES (
      'ORDER_COMPLETED',
      'INVENTORY_ITEM',
      NEW.inventory_item_id::text,
      auth.uid(),
      jsonb_build_object(
        'from_character_name', responder_name,
        'item_name', order_data.item_name,
        'quantity', order_data.quantity,
        'points_reward', order_data.points_reward
      ),
      jsonb_build_object(
        'to_character_name', creator_name,
        'item_name', order_data.item_name,
        'quantity', order_data.quantity,
        'points_reward', order_data.points_reward
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;