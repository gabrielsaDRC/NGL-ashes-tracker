/*
  # Fix transfer dialog permissions
  
  1. Changes
    - Add policy to allow guild members to view other members' characters
    - Add policy to allow guild members to view guild memberships
  
  2. Security
    - Only allows viewing within the same guild
    - Maintains existing RLS policies
*/

-- Add policy to allow guild members to view other members' characters
CREATE POLICY "Guild members can view other members' characters" ON characters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM guild_memberships gm1, guild_memberships gm2
      WHERE gm1.guild_id = gm2.guild_id
      AND gm1.user_id = auth.uid()
      AND gm2.user_id = characters.user_id
      AND gm1.status = 'active'
      AND gm2.status = 'active'
    )
  );

-- Add policy to allow guild members to view guild memberships
CREATE POLICY "Guild members can view other memberships" ON guild_memberships
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