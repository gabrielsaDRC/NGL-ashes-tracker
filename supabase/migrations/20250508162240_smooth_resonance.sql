/*
  # Update guild member policies
  
  1. Changes
    - Drop and recreate guild membership viewing policy
    - Ensure proper access for guild members
  
  2. Security
    - Maintains RLS enabled
    - Allows guild members to view other memberships in their guild
*/

-- Drop existing policy for guild memberships
DROP POLICY IF EXISTS "Guild members can view other memberships" ON guild_memberships;

-- Add policy to allow guild members to view guild memberships
CREATE POLICY "Guild members can view memberships" ON guild_memberships
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