/*
  # Update audit logs policy to allow member access
  
  1. Changes
    - Drop existing admin-only policy
    - Create new policy allowing all guild members to view logs
  
  2. Security
    - Maintains RLS enabled
    - Allows all active guild members to view logs
*/

-- Drop the existing admin-only policy
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;

-- Create new policy allowing all guild members to view logs
CREATE POLICY "Guild members can view audit logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guild_memberships
      WHERE guild_memberships.user_id = auth.uid()
      AND guild_memberships.status = 'active'
    )
  );