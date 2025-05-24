import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { UserIcon, XCircleIcon } from 'lucide-react';
import { Equipment, EquipmentSlot } from '../types';
import { ItemDatabase } from './ItemDatabase';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import resourcesData from '../utils/resources_minified.json';

interface EquipmentPanelProps {
  equipment: Equipment;
  characterId: string;
  onEquipmentUpdate: (newEquipment: Equipment) => void;
  isEditable?: boolean;
}

export function EquipmentPanel({ equipment, characterId, onEquipmentUpdate, isEditable = true }: EquipmentPanelProps) {
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | null>(null);
  const [showItemDatabase, setShowItemDatabase] = useState(false);

  const leftSlots: { id: EquipmentSlot; label: string }[] = [
    { id: 'head', label: 'Head' },
    { id: 'chest', label: 'Armor Chest' },
    { id: 'forearms', label: 'Armor Forearms' },
    { id: 'hands', label: 'Armor Hands' },
    { id: 'belt', label: 'Belt' },
    { id: 'legs', label: 'Armor Legs' },
    { id: 'feet', label: 'Armor Feet' },
  ];

  const rightSlots: { id: EquipmentSlot; label: string }[] = [
    { id: 'shoulders', label: 'Shoulders' },
    { id: 'back', label: 'Back' },
    { id: 'earring1', label: 'Earring 1' },
    { id: 'earring2', label: 'Earring 2' },
    { id: 'necklace', label: 'Necklace' },
    { id: 'ring1', label: 'Ring 1' },
    { id: 'ring2', label: 'Ring 2' },
  ];

  const weaponSlots: { id: EquipmentSlot; label: string }[] = [
    { id: 'mainHand1', label: 'Main Hand 1' },
    { id: 'mainHand2', label: 'Main Hand 2' },
    { id: 'offHand1', label: 'Off Hand 1' },
    { id: 'offHand2', label: 'Off Hand 2' },
  ];

  const handleSlotClick = (slot: EquipmentSlot) => {
    if (!isEditable) return;
    setSelectedSlot(slot);
    setShowItemDatabase(true);
  };

  const handleEquipItem = async (item: any) => {
    if (!selectedSlot) return;

    try {
      const newEquipment = { ...equipment };
      const isTwoHanded = item.gameplayTags?.gameplayTags?.some((tag: any) => 
        tag.tagName.includes('TwoHanded')
      );

      // Handle two-handed weapons
      if (isTwoHanded) {
        if (selectedSlot === 'mainHand1') {
          delete newEquipment.mainHand2;
          delete newEquipment.offHand1;
        } else if (selectedSlot === 'mainHand2') {
          delete newEquipment.mainHand1;
          delete newEquipment.offHand2;
        }
      }

      // Find the item in resourcesData to get the correct icon
      const itemData = resourcesData.find(resource => resource.guid === item.guid);
      if (!itemData) {
        throw new Error('Item data not found');
      }

      newEquipment[selectedSlot] = {
        item_guid: item.guid,
        item_name: item.itemName,
        rarity: item.rarityMin,
        isTwoHanded,
        displayIcon: itemData.displayIcon,
        description: item.description,
        level: item.level,
        tags: item.gameplayTags.gameplayTags.map((tag: any) => tag.tagName)
      };

      const { error } = await supabase
        .from('characters')
        .update({ equipment: newEquipment })
        .eq('id', characterId);

      if (error) throw error;

      onEquipmentUpdate(newEquipment);
      setShowItemDatabase(false);
      setSelectedSlot(null);
      toast.success(`Equipped ${item.itemName}`);
    } catch (error) {
      console.error('Error equipping item:', error);
      toast.error('Failed to equip item');
    }
  };

  const handleRemoveItem = async (slot: EquipmentSlot) => {
    if (!isEditable || !equipment[slot]) return;

    try {
      const newEquipment = { ...equipment };
      const removedItem = newEquipment[slot];
      delete newEquipment[slot];

      const { error } = await supabase
        .from('characters')
        .update({ equipment: newEquipment })
        .eq('id', characterId);

      if (error) throw error;

      onEquipmentUpdate(newEquipment);
      toast.success(`Removed ${removedItem?.item_name}`);
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'border-gray-400';
      case 'Uncommon': return 'border-green-400';
      case 'Rare': return 'border-blue-400';
      case 'Heroic': return 'border-purple-400';
      case 'Epic': return 'border-yellow-400';
      case 'Legendary': return 'border-orange-400';
      case 'Artifact': return 'border-red-400';
      default: return 'border-gray-400';
    }
  };

  const transformIconUrl = (iconPath: string): string => {
    const cleanPath = iconPath.replace(/^\/Game\//, '');
    const parts = cleanPath.split('.');
    parts.pop();
    const cdnPath = parts.join('.');
    return `https://cdn.ashescodex.com/${cdnPath}_64.webp`;
  };

  const getItemTooltipContent = (item: any) => {
    if (!item) return '';
    
    const tagsList = item.tags ? 
      `\nTags: ${item.tags.map((tag: string) => tag.split('.').pop()).join(', ')}` : '';
    
    const levelInfo = item.level ? `\nLevel: ${item.level}` : '';
    
    return `${item.item_name}\n${item.rarity}${item.isTwoHanded ? ' (Two-handed)' : ''}\n\n${item.description || ''}${levelInfo}${tagsList}`;
  };

  const EquipmentSlot = ({ id, label }: { id: EquipmentSlot; label: string }) => {
    const item = equipment[id];
    const isDisabled = item?.isTwoHanded && (
      (id === 'mainHand2' && equipment.mainHand1?.isTwoHanded) ||
      (id === 'mainHand1' && equipment.mainHand2?.isTwoHanded)
    );

    return (
      <div className="relative">
        <div
          onClick={() => !isDisabled && handleSlotClick(id)}
          className={`relative w-16 h-16 border-2 ${
            item 
              ? `${getRarityColor(item.rarity)} bg-gray-800/80` 
              : 'border-gray-600 bg-gray-800/60'
          } ${
            isEditable && !isDisabled ? 'cursor-pointer hover:border-blue-500 hover:bg-gray-700/80' : 'cursor-default'
          } ${
            isDisabled ? 'opacity-50' : ''
          } rounded-lg overflow-hidden transition-all duration-200`}
          data-tooltip-id={`item-tooltip-${id}`}
          data-tooltip-content={
            isDisabled ? 'Slot locked (Two-handed weapon equipped)' :
            item ? getItemTooltipContent(item) :
            isEditable ? `Empty ${label} Slot\nClick to equip` : `Empty ${label} Slot`
          }
          data-tooltip-place="top"
        >
          {item ? (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={transformIconUrl(item.displayIcon || item.item_guid)}
                alt={item.item_name}
                className="w-12 h-12 object-contain"
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center p-1">
              {label}
            </div>
          )}
        </div>
        {isEditable && item && (
          <button
            onClick={() => handleRemoveItem(id)}
            className="absolute -top-2 -right-2 text-red-500 hover:text-red-600 bg-gray-800 rounded-full"
          >
            <XCircleIcon className="h-5 w-5" />
          </button>
        )}
        <Tooltip
          id={`item-tooltip-${id}`}
          place="top"
          className="max-w-md whitespace-pre-wrap bg-gray-900/95 text-white px-4 py-2 rounded-lg shadow-xl border border-gray-700 z-[9999]"
          style={{ zIndex: 9999 }}
        />
      </div>
    );
  };

  return (
    <div className="relative flex justify-center items-center min-h-[600px] bg-gray-900/90 rounded-lg p-8">
      {/* Left column */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2 space-y-4">
        {leftSlots.map((slot) => (
          <EquipmentSlot key={slot.id} id={slot.id} label={slot.label} />
        ))}
      </div>

      {/* Character silhouette */}
      <div className="w-64 h-96 bg-gray-800/80 rounded-lg border-2 border-gray-600 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Character</div>
      </div>

      {/* Right column */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 space-y-4">
        {rightSlots.map((slot) => (
          <EquipmentSlot key={slot.id} id={slot.id} label={slot.label} />
        ))}
      </div>

      {/* Weapon slots at the bottom */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
        {weaponSlots.map((slot) => (
          <EquipmentSlot key={slot.id} id={slot.id} label={slot.label} />
        ))}
      </div>

      {showItemDatabase && (
        <div className="fixed inset-0 z-[9998] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-auto">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Select Item for {selectedSlot}</h2>
              <button
                onClick={() => setShowItemDatabase(false)}
                className="text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-md hover:bg-gray-800"
              >
                Close
              </button>
            </div>
            <ItemDatabase
              onSelectItem={handleEquipItem}
              isSelecting={true}
              slotType={selectedSlot || undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}