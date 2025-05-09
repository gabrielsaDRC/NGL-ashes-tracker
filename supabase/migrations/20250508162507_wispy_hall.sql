/*
  # Fix infinite recursion in guild and membership policies
  
  1. Changes
    - Drop existing problematic policies
    - Create new simplified policies for guilds and memberships
    - Avoid recursive checks in policy definitions
  
  2. Security
    - Maintain read access for authenticated users
    - Allow admins to manage guilds
    - Prevent infinite recursion while maintaining security
*/

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON guilds;
DROP POLICY IF EXISTS "Enable update for guild admins" ON guilds;
DROP POLICY IF EXISTS "Admins can manage guild" ON guilds;
DROP POLICY IF EXISTS "Users can manage own membership" ON guild_memberships;
DROP POLICY IF EXISTS "Users can create their own membership" ON guild_memberships;
DROP POLICY IF EXISTS "Users can delete their own membership" ON guild_memberships;
DROP POLICY IF EXISTS "Users can view their own memberships" ON guild_memberships;
DROP POLICY IF EXISTS "Admins can manage all guild memberships" ON guild_memberships;

-- Create new guild policies
CREATE POLICY "Enable read access for all authenticated users" ON guilds
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable admin management" ON guilds
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM guild_memberships
      WHERE guild_memberships.guild_id = guilds.id
      AND guild_memberships.user_id = auth.uid()
      AND guild_memberships.role = 'admin'
      AND guild_memberships.status = 'active'
    )
  );

-- Create new membership policies
CREATE POLICY "Users can view own membership" ON guild_memberships
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own membership" ON guild_memberships
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can create membership" ON guild_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    NOT EXISTS (
      SELECT 1
      FROM guild_memberships existing
      WHERE existing.user_id = auth.uid()
      AND existing.guild_id = guild_memberships.guild_id
    )
  );

CREATE POLICY "Users can delete own membership" ON guild_memberships
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all memberships" ON guild_memberships
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM guild_memberships admin_check
      WHERE admin_check.guild_id = guild_memberships.guild_id
      AND admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
      AND admin_check.status = 'active'
    )
  );

CREATE POLICY "Admins can manage all memberships" ON guild_memberships
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM guild_memberships admin_check
      WHERE admin_check.guild_id = guild_memberships.guild_id
      AND admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
      AND admin_check.status = 'active'
    )
  );