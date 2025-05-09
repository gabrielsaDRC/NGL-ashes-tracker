/*
  # Add rarity to buy orders
  
  1. Changes
    - Add rarity column to buy_orders table
    - Set default rarity to 'Common'
    - Add rarity constraint
  
  2. Security
    - Maintains existing RLS policies
*/

-- Add rarity column to buy_orders
ALTER TABLE buy_orders 
ADD COLUMN rarity text NOT NULL DEFAULT 'Common';

-- Add constraint for valid rarities
ALTER TABLE buy_orders 
ADD CONSTRAINT valid_rarity CHECK (
  rarity IN (
    'Common',
    'Uncommon',
    'Rare',
    'Heroic',
    'Epic',
    'Legendary',
    'Artifact'
  )
);