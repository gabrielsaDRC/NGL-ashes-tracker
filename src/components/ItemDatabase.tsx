import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, SearchIcon, FilterIcon, AlertCircleIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import resourcesData from '../utils/resources_minified.json';
import { AddToInventory } from './AddToInventory';
import { supabase } from '../lib/supabase';

interface GameplayTag {
  tagName: string;
}

interface Item {
  itemName: string;
  description: string;
  level: number;
  rarityMin: string;
  rarityMax: string;
  displayIcon: string;
  guid: string;
  gameplayTags: {
    gameplayTags: GameplayTag[];
    parentTags: GameplayTag[];
  };
}

interface ItemDatabaseProps {
  onSelectItem?: (item: any) => void;
  isSelecting?: boolean;
  slotType?: string;
}

const transformIconUrl = (iconPath: string): string => {
  const cleanPath = iconPath.replace(/^\/Game\//, '');
  const parts = cleanPath.split('.');
  parts.pop();
  const cdnPath = parts.join('.');
  return `https://cdn.ashescodex.com/${cdnPath}_64.webp`;
};

export function ItemDatabase({ onSelectItem, isSelecting = false, slotType }: ItemDatabaseProps) {
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [guildId, setGuildId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const itemsPerPage = 32;

  useEffect(() => {
    loadItems();
    fetchGuildId();
  }, [slotType]);

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

  const loadItems = () => {
    try {
      let filteredItems = [...resourcesData];

      // Filter items based on slot type if provided
      if (slotType) {
        filteredItems = filteredItems.filter(item => {
          const tags = item.gameplayTags.gameplayTags.map(tag => tag.tagName.toLowerCase());
          const parentTags = item.gameplayTags.parentTags.map(tag => tag.tagName.toLowerCase());
          const allTags = [...tags, ...parentTags];

          switch (slotType) {
            case 'head':
              return allTags.some(tag => tag.includes('head') || tag.includes('helmet'));
            case 'chest':
              return allTags.some(tag => tag.includes('chest') || tag.includes('armor.body'));
            case 'forearms':
              return allTags.some(tag => tag.includes('forearm') || tag.includes('bracer'));
            case 'hands':
              return allTags.some(tag => tag.includes('hand') || tag.includes('glove'));
            case 'belt':
              return allTags.some(tag => tag.includes('belt') || tag.includes('waist'));
            case 'legs':
              return allTags.some(tag => tag.includes('leg') || tag.includes('pants'));
            case 'feet':
              return allTags.some(tag => tag.includes('feet') || tag.includes('boot'));
            case 'shoulders':
              return allTags.some(tag => tag.includes('shoulder') || tag.includes('pauldron'));
            case 'back':
              return allTags.some(tag => tag.includes('back') || tag.includes('cloak'));
            case 'earring1':
            case 'earring2':
              return allTags.some(tag => tag.includes('earring') || tag.includes('jewelry.ear'));
            case 'necklace':
              return allTags.some(tag => tag.includes('necklace') || tag.includes('amulet') || tag.includes('jewelry.neck'));
            case 'ring1':
            case 'ring2':
              return allTags.some(tag => tag.includes('ring') || tag.includes('jewelry.finger'));
            case 'mainHand1':
            case 'mainHand2':
              return allTags.some(tag => tag.includes('weapon') || tag.includes('mainhand'));
            case 'offHand1':
            case 'offHand2':
              return allTags.some(tag => tag.includes('shield') || tag.includes('offhand'));
            default:
              return true;
          }
        });
      }

      setAllItems(filteredItems);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading items:', err);
      setError('Failed to load items');
      toast.error('Failed to load items');
      setIsLoading(false);
    }
  };

  const getTagType = (tags: GameplayTag[]) => {
    const tagNames = tags.map(tag => tag.tagName);
    if (tagNames.some(tag => tag.includes('Gathering'))) return 'gathering';
    if (tagNames.some(tag => tag.includes('Processing'))) return 'processing';
    if (tagNames.some(tag => tag.includes('Crafting'))) return 'crafting';
    return 'other';
  };

  const filteredItems = allItems.filter(item => {
    const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || getTagType(item.gameplayTags.gameplayTags) === filter;
    return matchesSearch && matchesFilter;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'Uncommon': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Rare': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'Epic': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'Legendary': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'gathering': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'crafting': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter]);

  return (
    <div className="container mx-auto px-4 py-8">
      {!isSelecting && (
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Item Database</h1>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>

        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Types</option>
            <option value="gathering">Gathering</option>
            <option value="processing">Processing</option>
            <option value="crafting">Crafting</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="h-4 w-4 text-red-500 dark:text-red-400" />
            <p className="text-red-700 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {currentItems.map((item) => (
              <div
                key={item.guid}
                className={`bg-white bg-gray-with-oppacity rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow ${
                  isSelecting ? 'cursor-pointer hover:border-blue-500 border-2 border-transparent' : ''
                }`}
                onClick={() => isSelecting && onSelectItem?.(item)}
                data-ashescodex-id={item.guid}
              >
                <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <img
                    src={transformIconUrl(item.displayIcon)}
                    alt={item.itemName}
                    className="w-full h-full object-contain p-2"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1 line-clamp-1">{item.itemName}</h3>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.gameplayTags.gameplayTags.map((tag, index) => (
                      <span
                        key={index}
                        className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${getTypeColor(getTagType([tag]))}`}
                      >
                        {tag.tagName.split('.').pop()}
                      </span>
                    ))}
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${getRarityColor(item.rarityMin)}`}>
                      {item.rarityMin}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{item.description}</p>
                  {guildId && !isSelecting && (
                    <AddToInventory
                      itemGuid={item.guid}
                      itemName={item.itemName}
                      guildId={guildId}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center items-center gap-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-500 transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Previous
            </button>
            <span className="text-sm text-white text-bold">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="flex items-center px-4 py-2 border text-white border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-500 transition-colors"
            >
              Next
              <ArrowLeftIcon className="h-4 w-4 ml-2" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}