-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Members can view guild characters" ON characters;
DROP POLICY IF EXISTS "Members can manage own characters" ON characters;
DROP POLICY IF EXISTS "Admins can manage all characters" ON characters;
DROP POLICY IF EXISTS "Users can view own membership" ON guild_memberships;
DROP POLICY IF EXISTS "Users can manage own membership" ON guild_memberships;
DROP POLICY IF EXISTS "Users can manage their own membership" ON guild_memberships;
DROP POLICY IF EXISTS "Users can create membership" ON guild_memberships;
DROP POLICY IF EXISTS "Users can delete own membership" ON guild_memberships;
DROP POLICY IF EXISTS "Admins can view all memberships" ON guild_memberships;
DROP POLICY IF EXISTS "Admins can manage all memberships" ON guild_memberships;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON guilds;
DROP POLICY IF EXISTS "Enable admin management" ON guilds;
DROP POLICY IF EXISTS "Enable read access for all members" ON guild_memberships;
DROP POLICY IF EXISTS "Admins can manage guild memberships" ON guild_memberships;

-- Guild policies (simplest, no recursion possible)
CREATE POLICY "allow_read_guilds" ON guilds
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "allow_admin_manage_guilds" ON guilds
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

-- Character policies
CREATE POLICY "allow_read_characters" ON characters
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "allow_manage_own_characters" ON characters
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_admin_manage_characters" ON characters
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

-- Guild membership policies
CREATE POLICY "allow_create_membership" ON guild_memberships
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

CREATE POLICY "allow_update_own_membership" ON guild_memberships
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_delete_own_membership" ON guild_memberships
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_read_memberships" ON guild_memberships
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "allow_admin_manage_memberships" ON guild_memberships
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guild_memberships gm
      WHERE gm.guild_id = guild_memberships.guild_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
      AND gm.status = 'active'
      AND gm.id <> guild_memberships.id
    )
  );