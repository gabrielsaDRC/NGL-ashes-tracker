/*
  # Fix Inventory Items RLS Policies

  1. Changes
    - Drop existing INSERT policy
    - Create new INSERT policy with proper guild membership check
    - Ensure policy properly validates both user_id and guild_id

  2. Security
    - Maintains RLS enabled on inventory_items table
    - Updates INSERT policy to properly check guild membership
    - Keeps existing SELECT, UPDATE, and DELETE policies
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can add items to their inventory" ON inventory_items;

-- Create new INSERT policy with proper guild membership check
CREATE POLICY "Users can add items to their inventory" ON inventory_items
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    -- Ensure user_id matches the authenticated user
    user_id = auth.uid() 
    AND
    -- Verify user is an active member of the guild
    EXISTS (
      SELECT 1 
      FROM guild_memberships 
      WHERE guild_memberships.guild_id = inventory_items.guild_id
      AND guild_memberships.user_id = auth.uid()
      AND guild_memberships.status = 'active'
    )
  );