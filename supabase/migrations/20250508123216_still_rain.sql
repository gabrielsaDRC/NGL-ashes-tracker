/*
  # Add buy order completion logging
  
  1. Changes
    - Add ORDER_COMPLETED to valid action types
    - Update buy order acceptance handler to log completions
  
  2. Security
    - Maintains existing RLS policies
    - Only admins can view audit logs
*/

-- Update valid action types to include order completion
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS valid_action_type;
ALTER TABLE audit_logs ADD CONSTRAINT valid_action_type CHECK (
  action_type IN (
    'CHARACTER_UPDATE',
    'INVENTORY_ADD',
    'INVENTORY_REMOVE',
    'STATUS_UPDATE',
    'ROLE_UPDATE',
    'CHARACTER_DELETE',
    'INVENTORY_TRANSFER',
    'ORDER_COMPLETED'
  )
);

-- Update the buy order acceptance handler to log completions
CREATE OR REPLACE FUNCTION handle_buy_order_acceptance()
RETURNS TRIGGER AS $$
DECLARE
  order_data RECORD;
  responder_balance RECORD;
  responder_name TEXT;
  creator_name TEXT;
BEGIN
  -- Only proceed if status is changing to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Get order details
    SELECT * INTO order_data FROM buy_orders WHERE id = NEW.order_id;
    
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
    
    -- Transfer item to creator
    UPDATE inventory_items
    SET user_id = order_data.creator_id
    WHERE id = NEW.inventory_item_id;
    
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