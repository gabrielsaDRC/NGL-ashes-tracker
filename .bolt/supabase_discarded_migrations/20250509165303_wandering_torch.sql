/*
  # Initial Database Schema
  
  1. Tables
    - organizations
    - guilds
    - guild_memberships
    - characters
    - inventory_items
    - points_balance
    - buy_orders
    - buy_order_responses
    - audit_logs
  
  2. Security
    - RLS enabled on all tables
    - Proper policies for access control
    - Security definer functions for safe operations
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Organization members table
CREATE TABLE organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Guilds table
CREATE TABLE guilds (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE guilds ENABLE ROW LEVEL SECURITY;

-- Guild memberships table
CREATE TABLE guild_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id bigint REFERENCES guilds(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('member', 'admin')),
  status text NOT NULL CHECK (status IN ('pending', 'active')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(guild_id, user_id)
);

ALTER TABLE guild_memberships ENABLE ROW LEVEL SECURITY;

-- Characters table
CREATE TABLE characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text CHECK (type IN ('gathering', 'processing', 'crafting')),
  skills jsonb DEFAULT '{}'::jsonb NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  guild_id bigint REFERENCES guilds(id) ON DELETE CASCADE,
  primary_class text CHECK (primary_class IN ('Bard', 'Cleric', 'Fighter', 'Mage', 'Ranger', 'Rogue', 'Summoner', 'Tank')),
  secondary_class text,
  status text DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  equipment jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT character_name_not_empty CHECK (length(TRIM(BOTH FROM name)) > 0)
);

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

-- Inventory items table
CREATE TABLE inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  guild_id bigint REFERENCES guilds(id) ON DELETE CASCADE,
  item_guid text NOT NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  rarity text NOT NULL CHECK (rarity IN ('Common', 'Uncommon', 'Rare', 'Heroic', 'Epic', 'Legendary', 'Artifact')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Points balance table
CREATE TABLE points_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT positive_balance CHECK (balance >= 0)
);

ALTER TABLE points_balance ENABLE ROW LEVEL SECURITY;

-- Buy orders table
CREATE TABLE buy_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  item_guid text NOT NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL,
  points_reward integer NOT NULL,
  status text NOT NULL DEFAULT 'open',
  rarity text NOT NULL DEFAULT 'Common',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('open', 'pending', 'completed', 'cancelled')),
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_points CHECK (points_reward > 0),
  CONSTRAINT valid_rarity CHECK (rarity IN ('Common', 'Uncommon', 'Rare', 'Heroic', 'Epic', 'Legendary', 'Artifact'))
);

ALTER TABLE buy_orders ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE buy_order_responses ENABLE ROW LEVEL SECURITY;

-- Audit logs table
CREATE TABLE audit_logs (
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
  ),
  CONSTRAINT valid_entity_type CHECK (
    entity_type IN ('CHARACTER', 'INVENTORY_ITEM')
  )
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_org_member(user_id UUID, org_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_members.user_id = $1
    AND organization_members.organization_id = $2
  );
$$;

CREATE OR REPLACE FUNCTION is_org_admin(user_id UUID, org_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_members.user_id = $1
    AND organization_members.organization_id = $2
    AND organization_members.role IN ('admin', 'owner')
  );
$$;

CREATE OR REPLACE FUNCTION is_guild_member(user_id UUID, guild_id BIGINT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM guild_memberships
    WHERE guild_memberships.user_id = $1
    AND guild_memberships.guild_id = $2
    AND guild_memberships.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_guild_admin(user_id UUID, guild_id BIGINT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM guild_memberships
    WHERE guild_memberships.user_id = $1
    AND guild_memberships.guild_id = $2
    AND guild_memberships.role = 'admin'
    AND guild_memberships.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION can_create_membership(user_id UUID, guild_id BIGINT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM guild_memberships
    WHERE guild_memberships.user_id = $1
    AND guild_memberships.guild_id = $2
  );
$$;

-- Function to handle character deletion
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

-- Function to handle buy order acceptance
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

-- Function to handle inventory transfers
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

-- Create triggers
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guilds_updated_at
  BEFORE UPDATE ON guilds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guild_memberships_updated_at
  BEFORE UPDATE ON guild_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

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

CREATE TRIGGER on_character_deleted
  AFTER DELETE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION handle_character_deletion();

CREATE TRIGGER on_buy_order_response_accepted
  AFTER UPDATE ON buy_order_responses
  FOR EACH ROW
  EXECUTE FUNCTION handle_buy_order_acceptance();

-- Create policies
CREATE POLICY "enable_read_organizations" ON organizations
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), id));

CREATE POLICY "enable_admin_manage_organizations" ON organizations
  FOR ALL
  TO authenticated
  USING (is_org_admin(auth.uid(), id));

CREATE POLICY "enable_read_organization_members" ON organization_members
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "enable_admin_manage_organization_members" ON organization_members
  FOR ALL
  TO authenticated
  USING (is_org_admin(auth.uid(), organization_id));

CREATE POLICY "enable_read_guilds" ON guilds
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "enable_admin_manage_guilds" ON guilds
  FOR ALL
  TO authenticated
  USING (is_guild_admin(auth.uid(), id));

CREATE POLICY "enable_read_memberships" ON guild_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR is_guild_member(auth.uid(), guild_id)
  );

CREATE POLICY "enable_create_membership" ON guild_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND can_create_membership(auth.uid(), guild_id)
  );

CREATE POLICY "enable_manage_own_membership" ON guild_memberships
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "enable_delete_own_membership" ON guild_memberships
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "enable_admin_manage_memberships" ON guild_memberships
  FOR ALL
  TO authenticated
  USING (is_guild_admin(auth.uid(), guild_id));

CREATE POLICY "enable_read_characters" ON characters
  FOR SELECT
  TO authenticated
  USING (is_guild_member(auth.uid(), guild_id));

CREATE POLICY "enable_manage_own_characters" ON characters
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "enable_admin_manage_characters" ON characters
  FOR ALL
  TO authenticated
  USING (is_guild_admin(auth.uid(), guild_id));

CREATE POLICY "enable_read_inventory" ON inventory_items
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM guild_memberships
      WHERE guild_memberships.guild_id = inventory_items.guild_id
      AND guild_memberships.user_id = auth.uid()
      AND guild_memberships.status = 'active'
    )
  );

CREATE POLICY "enable_manage_own_inventory" ON inventory_items
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "enable_admin_manage_inventory" ON inventory_items
  FOR ALL
  TO authenticated
  USING (is_guild_admin(auth.uid(), guild_id));

CREATE POLICY "enable_read_points_balance" ON points_balance
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "enable_admin_manage_points" ON points_balance
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

CREATE POLICY "enable_read_buy_orders" ON buy_orders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "enable_admin_manage_buy_orders" ON buy_orders
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

CREATE POLICY "enable_read_own_responses" ON buy_order_responses
  FOR SELECT
  TO authenticated
  USING (responder_id = auth.uid());

CREATE POLICY "enable_create_responses" ON buy_order_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = responder_id);

CREATE POLICY "enable_admin_manage_responses" ON buy_order_responses
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

CREATE POLICY "enable_read_audit_logs" ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guild_memberships
      WHERE guild_memberships.user_id = auth.uid()
      AND guild_memberships.status = 'active'
    )
  );