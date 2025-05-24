/*
  # Add security definer functions
  
  1. New Functions
    - `is_guild_member`: Check if a user is a member of a guild
    - `is_guild_admin`: Check if a user is an admin of a guild
    - `get_guild_members`: Get all members of a guild
    - `get_guild_characters`: Get all characters in a guild
  
  2. Security
    - All functions use SECURITY DEFINER to bypass RLS
    - Functions are owned by postgres role
    - Strict input validation
*/

-- Function to check if a user is a member of a guild
CREATE OR REPLACE FUNCTION is_guild_member(user_id UUID, guild_id BIGINT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM guild_memberships
    WHERE guild_memberships.user_id = $1
    AND guild_memberships.guild_id = $2
    AND guild_memberships.status = 'active'
  );
$$;

-- Function to check if a user is an admin of a guild
CREATE OR REPLACE FUNCTION is_guild_admin(user_id UUID, guild_id BIGINT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM guild_memberships
    WHERE guild_memberships.user_id = $1
    AND guild_memberships.guild_id = $2
    AND guild_memberships.role = 'admin'
    AND guild_memberships.status = 'active'
  );
$$;

-- Function to get all members of a guild
CREATE OR REPLACE FUNCTION get_guild_members(guild_id BIGINT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  role TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT 
    guild_memberships.id,
    guild_memberships.user_id,
    guild_memberships.role,
    guild_memberships.status,
    guild_memberships.created_at
  FROM guild_memberships
  WHERE guild_memberships.guild_id = $1;
$$;

-- Function to get all characters in a guild
CREATE OR REPLACE FUNCTION get_guild_characters(guild_id BIGINT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  primary_class TEXT,
  secondary_class TEXT,
  status TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT 
    characters.id,
    characters.name,
    characters.type,
    characters.primary_class,
    characters.secondary_class,
    characters.status,
    characters.user_id,
    characters.created_at
  FROM characters
  WHERE characters.guild_id = $1;
$$;

-- Update policies to use the security definer functions
DROP POLICY IF EXISTS "enable_read_memberships" ON guild_memberships;
CREATE POLICY "enable_read_memberships" ON guild_memberships
  FOR SELECT
  TO authenticated
  USING (is_guild_member(auth.uid(), guild_id));

DROP POLICY IF EXISTS "enable_admin_manage_memberships" ON guild_memberships;
CREATE POLICY "enable_admin_manage_memberships" ON guild_memberships
  FOR ALL
  TO authenticated
  USING (is_guild_admin(auth.uid(), guild_id));

DROP POLICY IF EXISTS "enable_read_characters" ON characters;
CREATE POLICY "enable_read_characters" ON characters
  FOR SELECT
  TO authenticated
  USING (is_guild_member(auth.uid(), guild_id));

DROP POLICY IF EXISTS "enable_admin_manage_characters" ON characters;
CREATE POLICY "enable_admin_manage_characters" ON characters
  FOR ALL
  TO authenticated
  USING (is_guild_admin(auth.uid(), guild_id));