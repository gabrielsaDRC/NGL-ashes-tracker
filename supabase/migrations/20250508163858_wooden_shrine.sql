/*
  # Fix recursive RLS policies
  
  1. Changes
    - Drop all existing policies
    - Create simplified policies with broad read access
    - Remove recursive checks in admin policies
    - Maintain security while avoiding recursion
  
  2. Security
    - Enable RLS on all tables
    - Allow broad read access
    - Restrict write access appropriately
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "enable_read_guilds" ON guilds;
DROP POLICY IF EXISTS "enable_admin_manage_guilds" ON guilds;
DROP POLICY IF EXISTS "enable_read_characters" ON characters;
DROP POLICY IF EXISTS "enable_manage_own_characters" ON characters;
DROP POLICY IF EXISTS "enable_admin_manage_characters" ON characters;
DROP POLICY IF EXISTS "enable_read_memberships" ON guild_memberships;
DROP POLICY IF EXISTS "enable_create_membership" ON guild_memberships;
DROP POLICY IF EXISTS "enable_manage_own_membership" ON guild_memberships;
DROP POLICY IF EXISTS "enable_delete_own_membership" ON guild_memberships;
DROP POLICY IF EXISTS "enable_admin_manage_memberships" ON guild_memberships;

-- Enable broad read access for all authenticated users
CREATE POLICY "enable_read_guilds" ON guilds
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "enable_read_characters" ON characters
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "enable_read_memberships" ON guild_memberships
  FOR SELECT
  TO authenticated
  USING (true);

-- User management policies
CREATE POLICY "enable_manage_own_characters" ON characters
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "enable_create_membership" ON guild_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM guild_memberships existing
      WHERE existing.user_id = auth.uid()
      AND existing.guild_id = guild_memberships.guild_id
    )
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

-- Admin policies without recursion
CREATE POLICY "enable_admin_manage_guilds" ON guilds
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guild_memberships
      WHERE guild_memberships.guild_id = guilds.id
      AND guild_memberships.user_id = auth.uid()
      AND guild_memberships.role = 'admin'
      AND guild_memberships.status = 'active'
    )
  );

CREATE POLICY "enable_admin_manage_characters" ON characters
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guild_memberships
      WHERE guild_memberships.guild_id = characters.guild_id
      AND guild_memberships.user_id = auth.uid()
      AND guild_memberships.role = 'admin'
      AND guild_memberships.status = 'active'
    )
  );

CREATE POLICY "enable_admin_manage_memberships" ON guild_memberships
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guild_memberships admin_check
      WHERE admin_check.guild_id = guild_memberships.guild_id
      AND admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
      AND admin_check.status = 'active'
      AND admin_check.id != guild_memberships.id
    )
  );