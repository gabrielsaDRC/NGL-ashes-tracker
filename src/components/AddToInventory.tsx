import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface AddToInventoryProps {
  itemGuid: string;
  itemName: string;
  guildId: number;
  onAdd?: () => void;
}

const rarityOptions = [
  'Common',
  'Uncommon',
  'Rare',
  'Heroic',
  'Epic',
  'Legendary',
  'Artifact'
];

export function AddToInventory({ itemGuid, itemName, guildId, onAdd }: AddToInventoryProps) {
  const [quantity, setQuantity] = useState(1);
  const [rarity, setRarity] = useState('Common');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    try {
      setIsAdding(true);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check if the user already has this item with the same rarity
      const { data: existingItems, error: checkError } = await supabase
        .from('inventory_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('guild_id', guildId)
        .eq('item_guid', itemGuid)
        .eq('rarity', rarity)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingItems) {
        // Update existing item quantity
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update({ quantity: existingItems.quantity + quantity })
          .eq('id', existingItems.id);

        if (updateError) throw updateError;
      } else {
        // Create new item entry
        const { error: insertError } = await supabase
          .from('inventory_items')
          .insert([
            {
              item_guid: itemGuid,
              item_name: itemName,
              quantity,
              rarity,
              guild_id: guildId,
              user_id: user.id
            }
          ]);

        if (insertError) throw insertError;
      }

      toast.success('Item added to inventory');
      setQuantity(1);
      setRarity('Common');
      onAdd?.();
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item to inventory');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="1"
        value={quantity}
        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
        className="w-16 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white"
      />
      <select
        value={rarity}
        onChange={(e) => setRarity(e.target.value)}
        className="px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white"
      >
        {rarityOptions.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <button
        onClick={handleAdd}
        disabled={isAdding}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isAdding ? 'Adding...' : 'Add'}
      </button>
    </div>
  );
}