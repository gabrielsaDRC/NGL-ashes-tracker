import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { PlusCircleIcon, SearchIcon, CheckIcon, XIcon, AlertCircleIcon, ArrowRightIcon, ArrowLeftIcon } from 'lucide-react';
import resourcesData from '../utils/resources_minified.json';
import { ItemDatabase } from './ItemDatabase';

interface BuyOrder {
  id: string;
  creator_id: string;
  item_guid: string;
  item_name: string;
  quantity: number;
  points_reward: number;
  rarity: string;
  status: 'open' | 'pending' | 'completed' | 'cancelled';
  created_at: string;
  responses?: BuyOrderResponse[];
}

interface BuyOrderResponse {
  id: string;
  order_id: string;
  responder_id: string;
  inventory_item_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  character_name?: string;
}

interface InventoryItem {
  id: string;
  item_guid: string;
  item_name: string;
  quantity: number;
  rarity: string;
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

export function BuyOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<BuyOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [pointsReward, setPointsReward] = useState(100);
  const [selectedRarity, setSelectedRarity] = useState('Common');
  const [userPoints, setUserPoints] = useState(0);

  useEffect(() => {
    checkAdminStatus();
    fetchOrders();
    fetchInventory();
    fetchUserPoints();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: guild } = await supabase
        .from('guilds')
        .select('id')
        .eq('name', 'Not Gonna Lie')
        .single();

      if (!guild) return;

      const { data: membership } = await supabase
        .from('guild_memberships')
        .select('role')
        .eq('guild_id', guild.id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      setIsAdmin(membership?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchUserPoints = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: points } = await supabase
        .from('points_balance')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      setUserPoints(points?.balance || 0);
    } catch (error) {
      console.error('Error fetching user points:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      
      const { data: orders, error: ordersError } = await supabase
        .from('buy_orders')
        .select(`
          *,
          responses:buy_order_responses(*)
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const responderIds = [...new Set(orders.flatMap(order => 
        order.responses?.map(response => response.responder_id) || []
      ))];

      const { data: characters, error: charactersError } = await supabase
        .from('characters')
        .select('user_id, name')
        .in('user_id', responderIds);

      if (charactersError) throw charactersError;

      const characterMap = characters.reduce((acc, char) => {
        acc[char.user_id] = char.name;
        return acc;
      }, {});

      const processedOrders = orders.map(order => ({
        ...order,
        responses: order.responses?.map(response => ({
          ...response,
          character_name: characterMap[response.responder_id] || 'Unknown Character'
        }))
      }));

      setOrders(processedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load buy orders');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: items, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setInventory(items || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const handleCreateOrder = async () => {
    if (!selectedItem || quantity <= 0 || pointsReward <= 0) {
      toast.error('Please fill in all fields correctly');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('buy_orders')
        .insert({
          creator_id: user.id,
          item_guid: selectedItem.guid,
          item_name: selectedItem.itemName,
          quantity,
          points_reward: pointsReward,
          rarity: selectedRarity
        });

      if (error) throw error;

      toast.success('Buy order created successfully');
      setShowCreateOrder(false);
      setSelectedItem(null);
      setQuantity(1);
      setPointsReward(100);
      setSelectedRarity('Common');
      fetchOrders();
    } catch (error) {
      console.error('Error creating buy order:', error);
      toast.error('Failed to create buy order');
    }
  };

  const handleRespond = async (order: BuyOrder) => {
    try {
      const matchingItem = inventory.find(item => 
        item.item_guid === order.item_guid && 
        item.quantity >= order.quantity &&
        item.rarity === order.rarity
      );

      if (!matchingItem) {
        toast.error(`You don't have enough ${order.rarity} quality items`);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('buy_order_responses')
        .insert({
          order_id: order.id,
          responder_id: user.id,
          inventory_item_id: matchingItem.id
        });

      if (error) throw error;

      await supabase
        .from('buy_orders')
        .update({ status: 'pending' })
        .eq('id', order.id);

      toast.success('Response submitted successfully');
      fetchOrders();
      fetchInventory();
    } catch (error) {
      console.error('Error responding to buy order:', error);
      toast.error('Failed to submit response');
    }
  };

  const handleResponseAction = async (response: BuyOrderResponse, action: 'accepted' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('buy_order_responses')
        .update({ status: action })
        .eq('id', response.id);

      if (error) throw error;

      toast.success(`Response ${action} successfully`);
      fetchOrders();
      fetchUserPoints();
    } catch (error) {
      console.error('Error updating response:', error);
      toast.error(`Failed to ${action} response`);
    }
  };

  const handleCompleteOrder = async (order: BuyOrder) => {
    try {
      const { error } = await supabase
        .from('buy_orders')
        .update({ status: 'completed' })
        .eq('id', order.id);

      if (error) throw error;

      toast.success('Order marked as completed');
      fetchOrders();
    } catch (error) {
      console.error('Error completing order:', error);
      toast.error('Failed to complete order');
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

  const filteredOrders = orders.filter(order =>
    order.item_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Buy Orders</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Your Points Balance: {userPoints}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateOrder(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <PlusCircleIcon className="h-5 w-5" />
            Create Buy Order
          </button>
        )}
      </div>

      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white bg-gray-with-oppacity rounded-lg shadow-md overflow-hidden">
              <div className="p-4">
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src={transformIconUrl(order.item_guid)}
                    alt={order.item_name}
                    className="w-12 h-12 object-contain"
                  />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {order.item_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      <span className={`text-sm ${getRarityColor(order.rarity)}`}>
                        {order.rarity}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Quantity: {order.quantity}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {order.points_reward} Points
                  </div>
                  {order.status === 'open' && !isAdmin && (
                    <button
                      onClick={() => handleRespond(order)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <ArrowRightIcon className="h-4 w-4" />
                      Respond
                    </button>
                  )}
                  {isAdmin && order.status === 'pending' && (
                    <button
                      onClick={() => handleCompleteOrder(order)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      <CheckIcon className="h-4 w-4" />
                      Complete Order
                    </button>
                  )}
                </div>

                {order.responses && order.responses.length > 0 && (
                  <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Responses
                    </h4>
                    <div className="space-y-2">
                      {order.responses.map((response) => (
                        <div
                          key={response.id}
                          className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded"
                        >
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            {response.character_name}
                          </span>
                          {isAdmin && response.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleResponseAction(response, 'accepted')}
                                className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 rounded"
                              >
                                <CheckIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleResponseAction(response, 'rejected')}
                                className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                              >
                                <XIcon className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                          {!isAdmin && (
                            <span className={`text-sm ${
                              response.status === 'accepted' ? 'text-green-600' :
                              response.status === 'rejected' ? 'text-red-600' :
                              'text-yellow-600'
                            }`}>
                              {response.status.charAt(0).toUpperCase() + response.status.slice(1)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowCreateOrder(false)}
            ></div>

            <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>

            <div className="inline-block transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
                  Create Buy Order
                </h3>

                <div className="space-y-4">
                  {selectedItem ? (
                    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <img
                        src={transformIconUrl(selectedItem.guid)}
                        alt={selectedItem.itemName}
                        className="w-12 h-12 object-contain"
                      />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {selectedItem.itemName}
                        </h4>
                        <button
                          onClick={() => setSelectedItem(null)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Change Item
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ItemDatabase
                      onSelectItem={setSelectedItem}
                      isSelecting={true}
                    />
                  )}

                  {selectedItem && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Rarity
                        </label>
                        <select
                          value={selectedRarity}
                          onChange={(e) => setSelectedRarity(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                          {rarityOptions.map(rarity => (
                            <option key={rarity} value={rarity}>{rarity}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Points Reward
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={pointsReward}
                          onChange={(e) => setPointsReward(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="button"
                  onClick={handleCreateOrder}
                  disabled={!selectedItem}
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  Create Order
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateOrder(false)}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}