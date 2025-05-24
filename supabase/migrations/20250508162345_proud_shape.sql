/*
  # Fix RLS policies for characters and guild memberships
  
  1. Changes
    - Drop existing policies
    - Create new policies with proper access control
    - Ensure members can view other members' data
  
  2. Security
    - Maintains RLS enabled
    - Allows proper access for both admins and members
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for guild members" ON characters;
DROP POLICY IF EXISTS "Guild members can view other members' characters" ON characters;
DROP POLICY IF EXISTS "Guild members can view memberships" ON guild_memberships;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON guilds;

-- Characters policies
CREATE POLICY "Members can view guild characters" ON characters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM guild_memberships
      WHERE guild_memberships.guild_id = characters.guild_id
      AND guild_memberships.user_id = auth.uid()
      AND guild_memberships.status = 'active'
    )
  );

CREATE POLICY "Members can manage own characters" ON characters
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all characters" ON characters
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM guild_memberships
      WHERE guild_memberships.guild_id = characters.guild_id
      AND guild_memberships.user_id = auth.uid()
      AND guild_memberships.role = 'admin'
      AND guild_memberships.status = 'active'
    )
  );

-- Guild memberships policies
CREATE POLICY "Members can view guild memberships" ON guild_memberships
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM guild_memberships gm
      WHERE gm.guild_id = guild_memberships.guild_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
    )
  );

CREATE POLICY "Members can manage own membership" ON guild_memberships
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all memberships" ON guild_memberships
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM guild_memberships gm
      WHERE gm.guild_id = guild_memberships.guild_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
      AND gm.status = 'active'
    )
  );

-- Guilds policies
CREATE POLICY "Enable read access for all authenticated users" ON guilds
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage guild" ON guilds
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