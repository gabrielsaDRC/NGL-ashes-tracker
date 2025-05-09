/*
  # Add buy order system
  
  1. New Tables
    - `points_balance`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `balance` (integer)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `buy_orders`
      - `id` (uuid, primary key)
      - `creator_id` (uuid, references auth.users)
      - `item_guid` (text)
      - `item_name` (text)
      - `quantity` (integer)
      - `points_reward` (integer)
      - `status` (text) - 'open', 'pending', 'completed', 'cancelled'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `buy_order_responses`
      - `id` (uuid, primary key)
      - `order_id` (uuid, references buy_orders)
      - `responder_id` (uuid, references auth.users)
      - `inventory_item_id` (uuid, references inventory_items)
      - `status` (text) - 'pending', 'accepted', 'rejected'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for admins and members
*/

-- Points balance table
CREATE TABLE points_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- Buy orders table
CREATE TABLE buy_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  item_guid text NOT NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL,
  points_reward integer NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('open', 'pending', 'completed', 'cancelled')),
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_points CHECK (points_reward > 0)
);

-- Buy order responses table
CREATE TABLE buy_order_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES buy_orders(id) ON DELETE CASCADE,
  responder_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'rejected'))
);

-- Enable RLS
ALTER TABLE points_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE buy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE buy_order_responses ENABLE ROW LEVEL SECURITY;

-- Points balance policies
CREATE POLICY "Users can view their own balance"
  ON points_balance
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can update points balance"
  ON points_balance
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guild_memberships
      WHERE guild_memberships.user_id = auth.uid()
      AND guild_memberships.role = 'admin'
      AND guild_memberships.status = 'active'
    )
  );

-- Buy orders policies
CREATE POLICY "Anyone can view buy orders"
  ON buy_orders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage buy orders"
  ON buy_orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guild_memberships
      WHERE guild_memberships.user_id = auth.uid()
      AND guild_memberships.role = 'admin'
      AND guild_memberships.status = 'active'
    )
  );

-- Buy order responses policies
CREATE POLICY "Users can view their own responses"
  ON buy_order_responses
  FOR SELECT
  TO authenticated
  USING (responder_id = auth.uid());

CREATE POLICY "Admins can view all responses"
  ON buy_order_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guild_memberships
      WHERE guild_memberships.user_id = auth.uid()
      AND guild_memberships.role = 'admin'
      AND guild_memberships.status = 'active'
    )
  );

CREATE POLICY "Users can create responses"
  ON buy_order_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = responder_id);

CREATE POLICY "Admins can manage responses"
  ON buy_order_responses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guild_memberships
      WHERE guild_memberships.user_id = auth.uid()
      AND guild_memberships.role = 'admin'
      AND guild_memberships.status = 'active'
    )
  );

-- Function to handle buy order response acceptance
CREATE OR REPLACE FUNCTION handle_buy_order_acceptance()
RETURNS TRIGGER AS $$
DECLARE
  order_data RECORD;
  responder_balance RECORD;
BEGIN
  -- Only proceed if status is changing to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Get order details
    SELECT * INTO order_data FROM buy_orders WHERE id = NEW.order_id;
    
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for buy order response acceptance
CREATE TRIGGER on_buy_order_response_accepted
  AFTER UPDATE ON buy_order_responses
  FOR EACH ROW
  EXECUTE FUNCTION handle_buy_order_acceptance();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_points_balance_updated_at
  BEFORE UPDATE ON points_balance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buy_orders_updated_at
  BEFORE UPDATE ON buy_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buy_order_responses_updated_at
  BEFORE UPDATE ON buy_order_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();