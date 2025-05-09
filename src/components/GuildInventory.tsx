import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon, UserIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import resourcesData from '../utils/resources_minified.json';

interface InventoryItem {
  id: string;
  item_name: string;
  item_guid: string;
  quantity: number;
  rarity: string;
  user_id: string;
  created_at: string;
}

interface GroupedInventory {
  [key: string]: {
    total: number;
    guid: string;
    byRarity: {
      [key: string]: number;
    };
    holders: {
      user_id: string;
      character_name: string;
      quantity: number;
      rarity: string;
    }[];
  };
}

interface AuditLog {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  old_data: any;
  new_data: any;
  created_at: string;
  character_name?: string;
}

export function GuildInventory() {
  const [inventory, setInventory] = useState<GroupedInventory>({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const logsPerPage = 10;
  const navigate = useNavigate();

  useEffect(() => {
    fetchGuildInventory();
    fetchInventoryLogs();
  }, [currentPage]);

  const fetchInventoryLogs = async () => {
    try {
      setIsLoadingLogs(true);

      // Get the guild ID
      const { data: guild } = await supabase
        .from('guilds')
        .select('id')
        .eq('name', 'Not Gonna Lie')
        .single();

      if (!guild) return;

      // Fetch audit logs for inventory actions
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .in('action_type', ['INVENTORY_ADD', 'INVENTORY_REMOVE', 'INVENTORY_TRANSFER', 'ORDER_COMPLETED'])
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * logsPerPage, currentPage * logsPerPage - 1);

      if (error) throw error;

      // Get character names for the users
      const userIds = logs.map(log => log.user_id);
      const { data: characters, error: charError } = await supabase
        .from('characters')
        .select('user_id, name')
        .in('user_id', userIds)
        .eq('status', 'Ativo');

      if (charError) throw charError;

      // Create a map of user_id to character name
      const characterNameMap = characters.reduce((acc, char) => {
        acc[char.user_id] = char.name;
        return acc;
      }, {});

      // Add character names to logs
      const logsWithNames = logs.map(log => ({
        ...log,
        character_name: characterNameMap[log.user_id] || 'Unknown Character'
      }));

      setAuditLogs(logsWithNames);
    } catch (error) {
      console.error('Error fetching inventory logs:', error);
      toast.error('Failed to load inventory logs');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchGuildInventory = async () => {
    try {
      setIsLoading(true);

      // Get the guild ID
      const { data: guild, error: guildError } = await supabase
        .from('guilds')
        .select('id')
        .eq('name', 'Not Gonna Lie')
        .single();

      if (guildError) throw guildError;

      // Get all inventory items for the guild
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('guild_id', guild.id)
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;

      // Get all user IDs from inventory items
      const userIds = [...new Set(items.map(item => item.user_id))];

      // Fetch character names for all users
      const { data: characters, error: charactersError } = await supabase
        .from('characters')
        .select('user_id, name')
        .in('user_id', userIds)
        .eq('status', 'Ativo');

      if (charactersError) throw charactersError;

      // Create a map of user_id to character name
      const characterNameMap = characters.reduce((acc, char) => {
        acc[char.user_id] = char.name;
        return acc;
      }, {});

      // Group items by name
      const grouped = (items || []).reduce<GroupedInventory>((acc, item) => {
        if (!acc[item.item_name]) {
          acc[item.item_name] = {
            total: 0,
            guid: item.item_guid,
            byRarity: {},
            holders: []
          };
        }

        acc[item.item_name].total += item.quantity;
        acc[item.item_name].byRarity[item.rarity] = (acc[item.item_name].byRarity[item.rarity] || 0) + item.quantity;
        acc[item.item_name].holders.push({
          user_id: item.user_id,
          character_name: characterNameMap[item.user_id] || 'Unknown Character',
          quantity: item.quantity,
          rarity: item.rarity
        });

        return acc;
      }, {});

      setInventory(grouped);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load guild inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItemExpansion = (itemName: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  const transformIconUrl = (itemGuid: string): string => {
    const item = resourcesData.find(i => i.guid === itemGuid);
    if (!item) return '';

    const cleanPath = item.displayIcon.replace(/^\/Game\//, '');
    const parts = cleanPath.split('.');
    parts.pop();
    const cdnPath = parts.join('.');
    return `https://cdn.ashescodex.com/${cdnPath}_64.webp`;
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

  const getActionDescription = (log: AuditLog) => {
    if (log.action_type === 'INVENTORY_ADD') {
      return `Added ${log.new_data.quantity}x ${log.new_data.item_name} (${log.new_data.rarity})`;
    } else if (log.action_type === 'INVENTORY_REMOVE') {
      return `Removed ${log.old_data.quantity}x ${log.old_data.item_name} (${log.old_data.rarity})`;
    } else if (log.action_type === 'INVENTORY_TRANSFER') {
      return `Transferred ${log.old_data.quantity}x ${log.old_data.item_name} from ${log.old_data.from_character_name} to ${log.new_data.to_character_name}`;
    } else if (log.action_type === 'ORDER_COMPLETED') {
      return `Completed order: ${log.old_data.quantity}x ${log.old_data.item_name} from ${log.old_data.from_character_name} to ${log.new_data.to_character_name} for ${log.old_data.points_reward} points`;
    }
    return '';
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'INVENTORY_ADD': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'INVENTORY_REMOVE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'INVENTORY_TRANSFER': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'ORDER_COMPLETED': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const filteredInventory = Object.entries(inventory).filter(([itemName]) => 
    itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Guild Inventory</h1>
      </div>

      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInventory.map(([itemName, data]) => (
          <div key={itemName} className="bg-white bg-gray-with-oppacity rounded-lg shadow-md overflow-hidden">
            <div 
              className="p-4 cursor-pointer hover:bg-gray-700/50 transition-colors"
              onClick={() => toggleItemExpansion(itemName)}
            >
              <div className="flex items-center gap-4">
                <img
                  src={transformIconUrl(data.guid)}
                  alt={itemName}
                  className="w-12 h-12 object-contain"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white">{itemName}</h3>
                  <p className="text-gray-300">Total Quantity: {data.total}</p>
                </div>
                {expandedItems.has(itemName) ? (
                  <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>

            {expandedItems.has(itemName) && (
              <div className="p-4 border-t border-gray-700">
                <div className="space-y-2">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400 font-medium">By Rarity:</p>
                    {Object.entries(data.byRarity).map(([rarity, quantity]) => (
                      <p key={rarity} className={`text-sm ${getRarityColor(rarity)}`}>
                        {rarity}: {quantity}
                      </p>
                    ))}
                  </div>

                  <div className="mt-4">
                    <p className="text-sm text-gray-400 font-medium mb-2">Holders:</p>
                    <div className="space-y-2">
                      {data.holders.map((holder, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <UserIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-300">{holder.character_name}</span>
                          <span className="text-gray-400">•</span>
                          <span className={`${getRarityColor(holder.rarity)}`}>
                            {holder.quantity}x {holder.rarity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white bg-gray-with-oppacity rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <ClockIcon className="h-5 w-5" />
            Recent Inventory Activity
          </h2>
        </div>

        <div className="divide-y divide-gray-700">
          {isLoadingLogs ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              No recent inventory activity
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Character</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {log.character_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(log.action_type)}`}>
                          {getActionDescription(log)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-gray-700/50">
          <div>
            <p className="text-sm text-gray-300">
              Page <span className="font-medium">{currentPage}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || isLoadingLogs}
              className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-600 bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={auditLogs.length < logsPerPage || isLoadingLogs}
              className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-600 bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}