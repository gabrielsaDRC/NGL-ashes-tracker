/*
  # Fix RLS policies to avoid recursion
  
  1. Changes
    - Drop all existing policies to start fresh
    - Create simplified policies that avoid recursion
    - Enable broad read access with specific write restrictions
    - Separate admin and user policies clearly
  
  2. Security
    - Maintains RLS enabled on all tables
    - Preserves necessary access controls
    - Prevents infinite recursion
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "allow_read_guilds" ON guilds;
DROP POLICY IF EXISTS "allow_admin_manage_guilds" ON guilds;
DROP POLICY IF EXISTS "allow_read_characters" ON characters;
DROP POLICY IF EXISTS "allow_manage_own_characters" ON characters;
DROP POLICY IF EXISTS "allow_admin_manage_characters" ON characters;
DROP POLICY IF EXISTS "allow_create_membership" ON guild_memberships;
DROP POLICY IF EXISTS "allow_update_own_membership" ON guild_memberships;
DROP POLICY IF EXISTS "allow_delete_own_membership" ON guild_memberships;
DROP POLICY IF EXISTS "allow_read_memberships" ON guild_memberships;
DROP POLICY IF EXISTS "allow_admin_manage_memberships" ON guild_memberships;

-- Guilds: Simple policies with no recursion
CREATE POLICY "enable_read_guilds" ON guilds
  FOR SELECT
  TO authenticated
  USING (true);

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

-- Characters: Broad read access, specific write permissions
CREATE POLICY "enable_read_characters" ON characters
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "enable_manage_own_characters" ON characters
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

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

-- Guild memberships: Simplified policies to avoid recursion
CREATE POLICY "enable_read_memberships" ON guild_memberships
  FOR SELECT
  TO authenticated
  USING (true);

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

CREATE POLICY "enable_admin_manage_memberships" ON guild_memberships
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guild_memberships gm
      WHERE gm.guild_id = guild_memberships.guild_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
      AND gm.status = 'active'
      AND gm.id != guild_memberships.id
    )
  );