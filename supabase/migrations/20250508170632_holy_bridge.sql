/*
  # Fix Guild Memberships Policy Recursion
  
  1. Changes
    - Drop existing problematic policies
    - Create new policies using SECURITY DEFINER functions
    - Fix recursion in admin and read policies
  
  2. Security
    - Maintains existing security model
    - Uses safe SECURITY DEFINER functions
    - Prevents policy recursion
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "enable_admin_manage_memberships" ON guild_memberships;
DROP POLICY IF EXISTS "enable_read_memberships" ON guild_memberships;

-- Create new policies using SECURITY DEFINER functions
CREATE POLICY "enable_admin_manage_memberships" ON guild_memberships
  FOR ALL
  TO authenticated
  USING (is_guild_admin(auth.uid(), guild_id));

CREATE POLICY "enable_read_memberships" ON guild_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR 
    is_guild_member(auth.uid(), guild_id)
  );