/*
  # Update character policies to allow guild members to view character information
  
  1. Changes
    - Drop existing SELECT policy
    - Create new policy allowing guild members to view characters in their guild
  
  2. Security
    - Maintains RLS enabled
    - Allows guild members to view character information
    - Keeps existing update/delete policies
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Enable read access for guild members" ON characters;

-- Create new SELECT policy for guild members
CREATE POLICY "Enable read access for guild members" ON characters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM guild_memberships gm
      WHERE gm.guild_id = characters.guild_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
    )
  );