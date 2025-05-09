import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { UserIcon } from 'lucide-react';

interface TransferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    item_name: string;
    quantity: number;
    rarity: string;
  };
  guildId: number;
}

interface GuildMember {
  user_id: string;
  character_name: string;
}

export function TransferDialog({ isOpen, onClose, item, guildId }: TransferDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchGuildMembers();
      setQuantity(1);
      setSelectedMember('');
    }
  }, [isOpen, guildId]);

  const fetchGuildMembers = async () => {
    try {
      setIsLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get all active guild members
      const { data: memberships, error: membershipError } = await supabase
        .from('guild_memberships')
        .select('user_id')
        .eq('guild_id', guildId)
        .eq('status', 'active');

      if (membershipError) throw membershipError;

      // Get character names for all active members
      const { data: characters, error: characterError } = await supabase
        .from('characters')
        .select('user_id, name')
        .in('user_id', memberships.map(m => m.user_id))
        .eq('status', 'Ativo');

      if (characterError) throw characterError;

      // Filter out the current user
      const otherMembers = characters.filter(char => char.user_id !== user.id);

      setMembers(otherMembers.map(char => ({
        user_id: char.user_id,
        character_name: char.name
      })));
    } catch (error) {
      console.error('Error fetching guild members:', error);
      toast.error('Failed to load guild members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedMember || quantity <= 0 || quantity > item.quantity) {
      toast.error('Invalid transfer details');
      return;
    }

    try {
      setIsTransferring(true);

      const { data, error } = await supabase.rpc('transfer_inventory_item', {
        item_id: item.id,
        recipient_id: selectedMember,
        transfer_quantity: quantity
      });

      if (error) throw error;

      toast.success('Item transferred successfully');
      onClose();
    } catch (error) {
      console.error('Error transferring item:', error);
      toast.error('Failed to transfer item');
    } finally {
      setIsTransferring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>

        <div className="inline-block transform overflow-hidden rounded-lg bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-lg font-medium leading-6 text-white mb-4">
              Transfer {item.item_name}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quantity (Max: {item.quantity})
                </label>
                <input
                  type="number"
                  min="1"
                  max={item.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 0)))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Recipient
                </label>
                {isLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  </div>
                ) : members.length === 0 ? (
                  <p className="text-gray-400 text-sm">No other guild members found</p>
                ) : (
                  <select
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  >
                    <option value="">Select a member</option>
                    {members.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.character_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              onClick={handleTransfer}
              disabled={isTransferring || !selectedMember || quantity <= 0}
              className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {isTransferring ? 'Transferring...' : 'Transfer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isTransferring}
              className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-600 bg-gray-700 px-4 py-2 text-base font-medium text-gray-300 shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}