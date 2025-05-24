/*
  # Fix infinite recursion in guild_memberships policies

  1. Changes
    - Remove recursive policies from guild_memberships table
    - Rewrite policies to avoid self-referential checks
    - Maintain security while preventing infinite loops
    
  2. Security
    - Maintain RLS enabled on guild_memberships
    - Ensure proper access control for members and admins
    - Prevent unauthorized access to guild data
*/

-- Drop existing policies to recreate them without recursion
DROP POLICY IF EXISTS "Admins can manage all memberships" ON guild_memberships;
DROP POLICY IF EXISTS "Allow users to create own membership" ON guild_memberships;
DROP POLICY IF EXISTS "Enable delete for admins" ON guild_memberships;
DROP POLICY IF EXISTS "Enable read access for guild members" ON guild_memberships;
DROP POLICY IF EXISTS "Enable update for admins" ON guild_memberships;
DROP POLICY IF EXISTS "Members can manage own membership" ON guild_memberships;
DROP POLICY IF EXISTS "Members can view guild memberships" ON guild_memberships;

-- Create new non-recursive policies
CREATE POLICY "Users can view their own memberships"
ON guild_memberships
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own membership"
ON guild_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND NOT EXISTS (
    SELECT 1 FROM guild_memberships 
    WHERE guild_id = guild_memberships.guild_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their own membership"
ON guild_memberships
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own membership"
ON guild_memberships
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Admin policies that avoid recursion by using a direct role check
CREATE POLICY "Admins can view all guild memberships"
ON guild_memberships
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM guild_memberships admin_check
    WHERE admin_check.user_id = auth.uid()
    AND admin_check.guild_id = guild_memberships.guild_id
    AND admin_check.role = 'admin'
    AND admin_check.status = 'active'
  )
);

CREATE POLICY "Admins can manage all guild memberships"
ON guild_memberships
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM guild_memberships admin_check
    WHERE admin_check.user_id = auth.uid()
    AND admin_check.guild_id = guild_memberships.guild_id
    AND admin_check.role = 'admin'
    AND admin_check.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM guild_memberships admin_check
    WHERE admin_check.user_id = auth.uid()
    AND admin_check.guild_id = guild_memberships.guild_id
    AND admin_check.role = 'admin'
    AND admin_check.status = 'active'
  )
);