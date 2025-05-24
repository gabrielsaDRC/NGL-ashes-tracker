/*
  # Fix RLS policies with security definer functions
  
  1. Changes
    - Drop policies first
    - Create helper functions
    - Create new policies using helper functions
  
  2. Security
    - Maintains RLS enabled on all tables
    - Uses security definer functions to avoid recursion
    - Preserves existing security model
*/

-- Drop existing policies first to remove dependencies
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

-- Create or replace helper functions
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

-- Guilds policies
CREATE POLICY "enable_read_guilds" ON guilds
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "enable_admin_manage_guilds" ON guilds
  FOR ALL
  TO authenticated
  USING (is_guild_admin(auth.uid(), id));

-- Characters policies
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

-- Guild memberships policies
CREATE POLICY "enable_read_memberships" ON guild_memberships
  FOR SELECT
  TO authenticated
  USING (is_guild_member(auth.uid(), guild_id));

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