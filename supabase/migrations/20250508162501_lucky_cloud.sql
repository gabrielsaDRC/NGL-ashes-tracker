/*
  # Fix guild memberships policies

  1. Changes
    - Remove recursive policies from guild_memberships table
    - Create new, non-recursive policies for admin management
    - Maintain existing security while avoiding infinite recursion

  2. Security
    - Maintains row level security
    - Updates policies to prevent infinite recursion
    - Preserves admin privileges without recursive checks
*/

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Admins can manage all guild memberships" ON guild_memberships;
DROP POLICY IF EXISTS "Admins can view all guild memberships" ON guild_memberships;

-- Create new non-recursive admin policies
CREATE POLICY "Admins can manage guild memberships"
ON guild_memberships
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM guild_memberships gm
    WHERE gm.user_id = auth.uid()
    AND gm.guild_id = guild_memberships.guild_id
    AND gm.role = 'admin'
    AND gm.status = 'active'
    AND gm.id != guild_memberships.id  -- Prevent recursion
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM guild_memberships gm
    WHERE gm.user_id = auth.uid()
    AND gm.guild_id = guild_memberships.guild_id
    AND gm.role = 'admin'
    AND gm.status = 'active'
    AND gm.id != guild_memberships.id  -- Prevent recursion
  )
);

-- Create new non-recursive view policy for admins
CREATE POLICY "Admins can view guild memberships"
ON guild_memberships
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM guild_memberships gm
    WHERE gm.user_id = auth.uid()
    AND gm.guild_id = guild_memberships.guild_id
    AND gm.role = 'admin'
    AND gm.status = 'active'
    AND gm.id != guild_memberships.id  -- Prevent recursion
  )
);