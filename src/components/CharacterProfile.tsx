import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { PlusCircleIcon, SearchIcon, CheckIcon, XIcon, AlertCircleIcon, ArrowRightIcon, ArrowLeftIcon, UserIcon, SaveIcon, MinusIcon, SendIcon, Trash2Icon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CharacterData, skillsByType, ranks, primaryClasses, secondaryClasses, PrimaryClass, initializeSkills } from '../types';
import resourcesData from '../utils/resources_minified.json';
import { TransferDialog } from './TransferDialog';
import { EquipmentPanel } from './EquipmentPanel';

interface InventoryItem {
  id: string;
  item_name: string;
  item_guid: string;
  quantity: number;
  rarity: string;
  created_at: string;
}

interface Character {
  id: string;
  name: string;
  type: string;
  skills: {
    gathering: Record<string, { level: number; rank: string }>;
    processing: Record<string, { level: number; rank: string }>;
    crafting: Record<string, { level: number; rank: string }>;
  };
  primary_class: string;
  secondary_class: string;
  guild_id: number | null;
  equipment?: Record<string, any>;
  user_id: string;
}

export function CharacterProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Character>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeletingItem, setIsDeletingItem] = useState<string | null>(null);
  const [isUpdatingQuantity, setIsUpdatingQuantity] = useState<string | null>(null);
  const [quantityToRemove, setQuantityToRemove] = useState<Record<string, number>>({});
  const [transferDialog, setTransferDialog] = useState<{
    isOpen: boolean;
    item: InventoryItem | null;
  }>({
    isOpen: false,
    item: null
  });
  const [guildId, setGuildId] = useState<number | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  useEffect(() => {
    fetchCharacter();
    fetchInventory();
    fetchGuildId();
    fetchUserAvatar();
  }, [id]);

  const fetchUserAvatar = async () => {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('raw_user_meta_data')
        .eq('id', id)
        .single();

      if (user?.raw_user_meta_data?.avatar_url) {
        setUserAvatar(user.raw_user_meta_data.avatar_url);
      }
    } catch (error) {
      console.error('Error fetching user avatar:', error);
    }
  };

  const fetchGuildId = async () => {
    try {
      const { data: guilds, error } = await supabase
        .from('guilds')
        .select('id')
        .eq('name', 'Not Gonna Lie')
        .single();

      if (error) throw error;
      setGuildId(guilds.id);
    } catch (err) {
      console.error('Error fetching guild:', err);
      toast.error('Failed to load guild information');
    }
  };

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInventory(data || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      toast.error('Failed to load inventory');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      setIsDeletingItem(itemId);

      const itemToDelete = inventory.find(item => item.id === itemId);
      if (!itemToDelete) throw new Error('Item not found');

      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      
      toast.success('Item removed from inventory');
      await fetchInventory();
    } catch (err) {
      console.error('Error deleting item:', err);
      toast.error('Failed to remove item');
    } finally {
      setIsDeletingItem(null);
    }
  };

  const handleUpdateQuantity = async (itemId: string, currentQuantity: number) => {
    try {
      const removeAmount = quantityToRemove[itemId] || 0;
      if (removeAmount <= 0) {
        toast.error('Please enter a valid quantity to remove');
        return;
      }

      if (removeAmount >= currentQuantity) {
        await handleDeleteItem(itemId);
        return;
      }

      setIsUpdatingQuantity(itemId);

      const itemToUpdate = inventory.find(item => item.id === itemId);
      if (!itemToUpdate) throw new Error('Item not found');

      const { error } = await supabase
        .from('inventory_items')
        .update({ quantity: currentQuantity - removeAmount })
        .eq('id', itemId);

      if (error) throw error;
      
      toast.success('Quantity updated successfully');
      await fetchInventory();
      setQuantityToRemove(prev => ({ ...prev, [itemId]: 0 }));
    } catch (err) {
      console.error('Error updating quantity:', err);
      toast.error('Failed to update quantity');
    } finally {
      setIsUpdatingQuantity(null);
    }
  };

  const transformIconUrl = (iconPath: string): string => {
    const item = resourcesData.find(i => i.guid === iconPath);
    if (!item) return '';
    
    const cleanPath = item.displayIcon.replace(/^\/Game\//, '');
    const parts = cleanPath.split('.');
    parts.pop();
    return `https://cdn.ashescodex.com/${parts.join('.')}_64.webp`;
  };

  const getItemTooltipContent = (item: any) => {
    if (!item) return '';
    
    const tagsList = item.tags ? 
      `\nTags: ${item.tags.map((tag: string) => tag.split('.').pop()).join(', ')}` : '';
    
    const levelInfo = item.level ? `\nLevel: ${item.level}` : '';
    
    return `${item.item_name}\n${item.rarity}${item.isTwoHanded ? ' (Two-handed)' : ''}\n\n${item.description || ''}${levelInfo}${tagsList}`;
  };

  async function fetchCharacter() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        setError('No character found for this user');
        return;
      }
      
      setCharacter(data);
      setFormData(data);
    } catch (error) {
      console.error('Error fetching character:', error);
      setError('Failed to load character');
    } finally {
      setIsLoading(false);
    }
  }

  const handleCreateCharacter = async () => {
    try {
      setIsCreating(true);

      const { data: guilds, error: guildError } = await supabase
        .from('guilds')
        .select('*')
        .eq('name', 'Not Gonna Lie')
        .single();

      if (guildError) throw guildError;

      if (!guilds) {
        throw new Error('Could not find the guild');
      }

      const skills = initializeSkills();

      const characterData = {
        name: `Character_${id?.substring(0, 8)}`,
        type: 'gathering',
        skills,
        user_id: id,
        guild_id: guilds.id,
        primary_class: 'Fighter',
        secondary_class: 'Weapon Master',
        status: 'Ativo'
      };

      const { error: characterError } = await supabase
        .from('characters')
        .insert([characterData]);

      if (characterError) throw characterError;

      const { error: membershipError } = await supabase
        .from('guild_memberships')
        .insert([{
          guild_id: guilds.id,
          user_id: id,
          role: 'member',
          status: 'active'
        }]);

      if (membershipError && !membershipError.message.includes('unique constraint')) {
        throw membershipError;
      }

      toast.success('Character created successfully!');
      await fetchCharacter();
    } catch (error) {
      console.error('Error creating character:', error);
      toast.error('Failed to create character');
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSkillChange = (category: 'gathering' | 'processing' | 'crafting', skillName: string, field: 'level' | 'rank', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      skills: {
        ...prev.skills,
        [category]: {
          ...prev.skills?.[category],
          [skillName]: {
            ...prev.skills?.[category]?.[skillName],
            [field]: field === 'level' ? Math.min(100, Math.max(0, Number(value))) : value
          }
        }
      }
    }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    try {
      const { error } = await supabase
        .from('characters')
        .update({
          name: formData.name,
          type: formData.type,
          primary_class: formData.primary_class,
          secondary_class: formData.secondary_class,
          skills: formData.skills,
          guild_id: formData.guild_id
        })
        .eq('user_id', id);

      if (error) throw error;
      
      toast.success('Character updated successfully');
      setIsEditing(false);
      fetchCharacter();
    } catch (error) {
      console.error('Error updating character:', error);
      toast.error('Failed to update character');
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'text-gray-400';
      case 'Uncommon': return 'text-green-400';
      case 'Rare': return 'text-blue-400';
      case 'Heroic': return 'text-purple-400';
      case 'Epic': return 'text-yellow-400';
      case 'Legendary': return 'text-orange-400';
      case 'Artifact': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const handleTransfer = (item: InventoryItem) => {
    setTransferDialog({
      isOpen: true,
      item
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex justify-end mb-6">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-500 rounded-md transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Guild
          </button>
        </div>
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error && !character) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-500 rounded-md transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Guild
          </button>
          <button
            onClick={handleCreateCharacter}
            disabled={isCreating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <PlusCircleIcon className="h-4 w-4" />
            {isCreating ? 'Creating Character...' : 'Create Character'}
          </button>
        </div>
        <div className="text-red-600 text-center">{error}</div>
      </div>
    );
  }

  const currentData = isEditing ? formData : character;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => isEditing ? handleSubmit() : setIsEditing(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <SaveIcon className="h-4 w-4" />
          {isEditing ? 'Save Changes' : 'Edit Character'}
        </button>
      </div>

      {/* Character Info Card */}
      <div className="bg-white bg-gray-with-oppacity rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleInputChange}
                  className="text-2xl font-bold bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-0 px-0 w-full"
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{character?.name}</h1>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Type</h3>
              {isEditing ? (
                <select
                  name="type"
                  value={formData.type || ''}
                  onChange={handleInputChange}
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
                >
                  <option value="gathering">Gathering</option>
                  <option value="processing">Processing</option>
                  <option value="crafting">Crafting</option>
                </select>
              ) : (
                <p className="text-lg font-medium text-gray-900 dark:text-white capitalize">{character?.type}</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Primary Class</h3>
              {isEditing ? (
                <select
                  name="primary_class"
                  value={formData.primary_class || ''}
                  onChange={handleInputChange}
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
                >
                  {primaryClasses.map(className => (
                    <option key={className} value={className}>{className}</option>
                  ))}
                </select>
              ) : (
                <p className="text-lg font-medium text-gray-900 dark:text-white">{character?.primary_class}</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Secondary Class</h3>
              {isEditing ? (
                <select
                  name="secondary_class"
                  value={formData.secondary_class || ''}
                  onChange={handleInputChange}
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
                >
                  {formData.primary_class && secondaryClasses[formData.primary_class as PrimaryClass].map(className => (
                    <option key={className} value={className}>{className}</option>
                  ))}
                </select>
              ) : (
                <p className="text-lg font-medium text-gray-900 dark:text-white">{character?.secondary_class}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Equipment Section */}
      <div className="bg-white bg-gray-with-oppacity rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Equipment</h2>
          {character && (
            <EquipmentPanel
              equipment={character.equipment || {}}
              characterId={character.id}
              onEquipmentUpdate={(newEquipment) => {
                setCharacter(prev => prev ? { ...prev, equipment: newEquipment } : null);
              }}
              isEditable={isEditing}
            />
          )}
        </div>
      </div>

      {/* Inventory Section */}
      <div className="bg-white bg-gray-with-oppacity rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Inventory</h2>
          <div className="space-y-4">
            {inventory.map((item) => (
              <div key={item.id} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="flex items-center gap-4">
                  <img
                    src={transformIconUrl(item.item_guid)}
                    alt={item.item_name}
                    className="w-12 h-12 object-contain"
                  />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">{item.item_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Quantity: {item.quantity}
                      </span>
                      <span className={`text-sm ${getRarityColor(item.rarity)}`}>
                        {item.rarity}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={item.quantity}
                      value={quantityToRemove[item.id] || ''}
                      onChange={(e) => setQuantityToRemove({
                        ...quantityToRemove,
                        [item.id]: Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 0))
                      })}
                      className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      placeholder="Qty"
                    />
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity)}
                      disabled={isUpdatingQuantity === item.id}
                      className="p-1 text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 rounded-full transition-colors"
                    >
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleTransfer(item)}
                      className="p-1 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                    >
                      <SendIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={isDeletingItem === item.id}
                      className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition-colors"
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skills Section */}
      <div className="space-y-6">
        {(['gathering', 'processing', 'crafting'] as const).map(category => (
          <div key={category} className="bg-white bg-gray-with-oppacity rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 capitalize">{category} Skills</h3>
              <div className="space-y-3">
                {skillsByType[category].map(skillName => (
                  <div key={skillName} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{skillName}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${character?.skills?.[category]?.[skillName]?.level || 0}%` }}
                          />
                        </div>
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.skills?.[category]?.[skillName]?.level || 0}
                            onChange={(e) => handleSkillChange(category, skillName, 'level', e.target.value)}
                            className="w-16 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-8 text-right">
                            {character?.skills?.[category]?.[skillName]?.level || 0}
                          </span>
                        )}
                        {isEditing ? (
                          <select
                            value={formData.skills?.[category]?.[skillName]?.rank || 'Novice'}
                            onChange={(e) => handleSkillChange(category, skillName, 'rank', e.target.value)}
                            className="text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded w-28"
                          >
                            {ranks.map(rank => (
                              <option key={rank} value={rank}>{rank}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400 w-24">
                            {character?.skills?.[category]?.[skillName]?.rank || 'Novice'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {guildId && transferDialog.item && (
        <TransferDialog
          isOpen={transferDialog.isOpen}
          onClose={() => {
            setTransferDialog({ isOpen: false, item: null });
            fetchInventory();
          }}
          item={transferDialog.item}
          guildId={guildId}
        />
      )}
    </div>
  );
}