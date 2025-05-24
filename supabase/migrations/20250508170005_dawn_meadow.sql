/*
  # Fix Guild Memberships Policy Recursion

  1. Changes
    - Fix infinite recursion in guild_memberships policies
    - Rewrite policies to avoid circular dependencies
    - Update admin check policy to use direct conditions
  
  2. Security
    - Maintains RLS enabled
    - Preserves security model while fixing recursion
*/

-- Drop problematic policies
DROP POLICY IF EXISTS "Admins can view guild memberships" ON guild_memberships;
DROP POLICY IF EXISTS "enable_admin_manage_memberships" ON guild_memberships;
DROP POLICY IF EXISTS "enable_read_memberships" ON guild_memberships;

-- Create new non-recursive policies
CREATE POLICY "enable_read_memberships" ON guild_memberships
  FOR SELECT
  TO authenticated
  USING (
    -- User can read their own memberships
    user_id = auth.uid()
    OR
    -- User can read memberships of guilds they are an active member of
    EXISTS (
      SELECT 1
      FROM guild_memberships my_membership
      WHERE my_membership.guild_id = guild_memberships.guild_id
      AND my_membership.user_id = auth.uid()
      AND my_membership.status = 'active'
    )
  );

CREATE POLICY "enable_admin_manage_memberships" ON guild_memberships
  FOR ALL
  TO authenticated
  USING (
    -- Direct admin check without recursion
    EXISTS (
      SELECT 1
      FROM guild_memberships admin_check
      WHERE admin_check.guild_id = guild_memberships.guild_id
      AND admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
      AND admin_check.status = 'active'
      AND admin_check.id != guild_memberships.id
    )
  );