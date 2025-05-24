/*
  # Add organization support
  
  1. New Tables
    - `organizations`
      - `id` (uuid, primary key)
      - `name` (text)
      - `slug` (text, unique)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `organization_members`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `user_id` (uuid, references auth.users)
      - `role` (text) - 'owner', 'admin', 'member'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Changes
    - Add organization_id to existing tables
    - Update RLS policies to include organization checks
    - Add helper functions for organization access control
*/

-- Create organizations table
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT organization_name_length CHECK (char_length(name) >= 1),
  CONSTRAINT organization_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Create organization members table
CREATE TABLE organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'member')),
  CONSTRAINT unique_org_member UNIQUE (organization_id, user_id)
);

-- Add organization_id to existing tables
ALTER TABLE guilds 
ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE points_balance 
ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE buy_orders 
ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- Helper functions
CREATE OR REPLACE FUNCTION is_organization_member(user_id UUID, org_id UUID)
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

CREATE OR REPLACE FUNCTION is_organization_admin(user_id UUID, org_id UUID)
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
    AND organization_members.role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION get_user_organizations(user_id UUID)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  member_role TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT 
    o.id,
    o.name,
    o.slug,
    om.role
  FROM organizations o
  JOIN organization_members om ON om.organization_id = o.id
  WHERE om.user_id = $1;
$$;

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Enable read for organization members"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Enable admin management"
  ON organizations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Organization members policies
CREATE POLICY "Enable read for organization members"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Enable admin management"
  ON organization_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_members.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Update existing table policies to include organization check
CREATE OR REPLACE FUNCTION is_guild_member(user_id UUID, guild_id BIGINT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM guild_memberships gm
    JOIN guilds g ON g.id = gm.guild_id
    JOIN organization_members om ON om.organization_id = g.organization_id
    WHERE gm.user_id = $1
    AND gm.guild_id = $2
    AND gm.status = 'active'
    AND om.user_id = $1
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
    FROM guild_memberships gm
    JOIN guilds g ON g.id = gm.guild_id
    JOIN organization_members om ON om.organization_id = g.organization_id
    WHERE gm.user_id = $1
    AND gm.guild_id = $2
    AND gm.role = 'admin'
    AND gm.status = 'active'
    AND om.user_id = $1
    AND om.role IN ('owner', 'admin')
  );
$$;

-- Update guild policies
DROP POLICY IF EXISTS "enable_read_guilds" ON guilds;
CREATE POLICY "enable_read_guilds"
  ON guilds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = guilds.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Update points balance policies
DROP POLICY IF EXISTS "Users can view their own balance" ON points_balance;
CREATE POLICY "Users can view their own balance"
  ON points_balance
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = points_balance.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Update buy orders policies
DROP POLICY IF EXISTS "Anyone can view buy orders" ON buy_orders;
CREATE POLICY "Anyone can view buy orders"
  ON buy_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = buy_orders.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Add trigger to update timestamps
CREATE OR REPLACE FUNCTION update_organization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_updated_at();

CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_updated_at();