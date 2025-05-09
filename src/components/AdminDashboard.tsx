import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { UserIcon, ChevronDownIcon, ChevronUpIcon, ArrowLeftIcon, Search, EyeIcon, EyeOffIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon, FilterIcon } from 'lucide-react';
import { CharacterData, skillsByType, CharacterType } from '../types';

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
  affected_character_name?: string;
}

interface GuildMember {
  id: string;
  character_name: string;
  role: string;
  characters: CharacterData[];
}

interface AuditLogFilters {
  actionType: string;
  dateFrom: string;
  dateTo: string;
  characterName: string;
}

const ACTION_TYPES = [
  'All',
  'CHARACTER_UPDATE',
  'CHARACTER_DELETE',
  'INVENTORY_ADD',
  'INVENTORY_REMOVE',
  'STATUS_UPDATE',
  'ROLE_UPDATE',
  'INVENTORY_TRANSFER',
  'ORDER_COMPLETED'
];

export function AdminDashboard() {
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [currentMembersPage, setCurrentMembersPage] = useState(1);
  const [currentLogsPage, setCurrentLogsPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [filters, setFilters] = useState<AuditLogFilters>({
    actionType: 'All',
    dateFrom: '',
    dateTo: '',
    characterName: ''
  });
  const membersPerPage = 10;
  const logsPerPage = 15;
  const navigate = useNavigate();

  useEffect(() => {
    fetchGuildMembers();
    fetchAuditLogs();
  }, [currentLogsPage, filters]);

  useEffect(() => {
    setCurrentMembersPage(1);
  }, [searchTerm]);

  const fetchAuditLogs = async () => {
    try {
      setIsLoadingLogs(true);

      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });

      if (filters.actionType !== 'All') {
        query = query.eq('action_type', filters.actionType);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('created_at', new Date(filters.dateTo + 'T23:59:59').toISOString());
      }

      query = query
        .order('created_at', { ascending: false })
        .range((currentLogsPage - 1) * logsPerPage, currentLogsPage * logsPerPage - 1);

      const { data: logs, error, count } = await query;

      if (error) throw error;

      const userIds = new Set([
        ...logs.map(log => log.user_id),
        ...logs.map(log => log.entity_id).filter(id => id.length === 36)
      ]);

      const { data: characters, error: charError } = await supabase
        .from('characters')
        .select('id, user_id, name')
        .in('user_id', Array.from(userIds))
        .eq('status', 'Ativo');

      if (charError) throw charError;

      const userNameMap = {};
      const characterNameMap = {};
      characters.forEach(char => {
        userNameMap[char.user_id] = char.name;
        characterNameMap[char.id] = char.name;
      });

      const logsWithNames = logs.map(log => {
        let affectedName;
        if (log.action_type === 'STATUS_UPDATE' || log.action_type === 'CHARACTER_UPDATE' || log.action_type === 'CHARACTER_DELETE') {
          affectedName = log.old_data?.character_name;
        } else if (log.action_type === 'ROLE_UPDATE') {
          affectedName = userNameMap[log.entity_id];
        } else if (log.entity_type === 'CHARACTER') {
          affectedName = characterNameMap[log.entity_id];
        }

        const logWithNames = {
          ...log,
          character_name: userNameMap[log.user_id] || 'Unknown Character',
          affected_character_name: affectedName
        };

        if (filters.characterName && 
            !logWithNames.character_name.toLowerCase().includes(filters.characterName.toLowerCase()) &&
            (!logWithNames.affected_character_name || 
             !logWithNames.affected_character_name.toLowerCase().includes(filters.characterName.toLowerCase()))) {
          return null;
        }

        return logWithNames;
      }).filter(Boolean);

      setAuditLogs(logsWithNames);
      setTotalLogs(count || 0);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchGuildMembers = async () => {
    try {
      setIsLoading(true);

      const { data: guilds, error: guildError } = await supabase
        .from('guilds')
        .select('*')
        .eq('name', 'Not Gonna Lie')
        .single();

      if (guildError) {
        toast.error('Guild not found');
        return;
      }

      const { data: memberships, error: membershipError } = await supabase
        .from('guild_memberships')
        .select('user_id, role')
        .eq('guild_id', guilds.id);

      if (membershipError) {
        throw membershipError;
      }

      const membersWithCharacters = await Promise.all(
        memberships.map(async (membership) => {
          const { data: characters, error: characterError } = await supabase
            .from('characters')
            .select('*')
            .eq('user_id', membership.user_id);

          if (characterError) {
            console.error('Error fetching characters:', characterError);
            return null;
          }

          const mainCharacter = characters?.find(char => char.status === 'Ativo') || characters?.[0];

          return {
            id: membership.user_id,
            character_name: mainCharacter?.name || 'Unknown Character',
            role: membership.role,
            characters: characters || []
          };
        })
      );

      setMembers(membersWithCharacters.filter((m): m is GuildMember => m !== null));
    } catch (error) {
      console.error('Error fetching guild members:', error);
      toast.error('Failed to load guild members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const { data: guilds } = await supabase
        .from('guilds')
        .select('id')
        .eq('name', 'Not Gonna Lie')
        .single();

      if (!guilds) {
        toast.error('Guild not found');
        return;
      }

      const { error } = await supabase
        .from('guild_memberships')
        .update({ role: newRole })
        .eq('guild_id', guilds.id)
        .eq('user_id', memberId);

      if (error) throw error;

      toast.success('Role updated successfully');
      await fetchGuildMembers();
      await fetchAuditLogs();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const toggleCharacterStatus = async (character: CharacterData) => {
    try {
      const newStatus = character.status === 'Ativo' ? 'Inativo' : 'Ativo';
      const { error } = await supabase
        .from('characters')
        .update({ status: newStatus })
        .eq('id', character.id);

      if (error) throw error;

      toast.success(`Character ${newStatus === 'Ativo' ? 'activated' : 'deactivated'} successfully`);
      await fetchGuildMembers();
      await fetchAuditLogs();
    } catch (error) {
      console.error('Error updating character status:', error);
      toast.error('Failed to update character status');
    }
  };

  const toggleMemberExpansion = (memberId: string) => {
    setExpandedMember(expandedMember === memberId ? null : memberId);
  };

  const formatActionType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'CHARACTER_UPDATE': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'CHARACTER_DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'INVENTORY_ADD': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'INVENTORY_REMOVE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'STATUS_UPDATE': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'ROLE_UPDATE': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getActionDescription = (log: AuditLog) => {
    switch (log.action_type) {
      case 'ROLE_UPDATE':
        return `Changed ${log.affected_character_name}'s role from ${log.old_data.role} to ${log.new_data.role}`;
      case 'STATUS_UPDATE':
        return `Changed ${log.old_data.character_name}'s status from ${log.old_data.status} to ${log.new_data.status}`;
      case 'CHARACTER_UPDATE':
        return `Updated ${log.old_data.character_name}'s details`;
      case 'CHARACTER_DELETE':
        return `Deleted character ${log.old_data.character_name}`;
      case 'INVENTORY_ADD':
        return `Added ${log.new_data.quantity}x ${log.new_data.item_name} (${log.new_data.rarity})`;
      case 'INVENTORY_REMOVE':
        return `Removed ${log.old_data.quantity}x ${log.old_data.item_name} (${log.old_data.rarity})`;
      default:
        return formatActionType(log.action_type);
    }
  };

  const handleFilterChange = (key: keyof AuditLogFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentLogsPage(1);
  };

  const resetFilters = () => {
    setFilters({
      actionType: 'All',
      dateFrom: '',
      dateTo: '',
      characterName: ''
    });
    setCurrentLogsPage(1);
  };

  const filteredMembers = members.filter(member => 
    member.character_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastMember = currentMembersPage * membersPerPage;
  const indexOfFirstMember = indexOfLastMember - membersPerPage;
  const currentMembers = filteredMembers.slice(indexOfFirstMember, indexOfLastMember);
  const totalMembersPages = Math.ceil(filteredMembers.length / membersPerPage);

  const PaginationControls = ({ currentPage, totalPages, onPageChange, label }) => (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="ml-3 relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {label} <span className="font-medium">{currentPage}</span> of{' '}
            <span className="font-medium">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Guild Members</h2>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-500 rounded-md transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Guild
        </button>
      </div>

      <div className="relative w-full max-w-md mb-4">
        <input
          type="text"
          placeholder="Search members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
      </div>
      
      <div className="bg-white bg-gray-with-oppacity shadow-md rounded-lg overflow-hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {currentMembers.map((member) => (
            <div key={member.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <UserIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{member.character_name}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        className="text-sm text-gray-500 dark:text-gray-400 bg-transparent border-none focus:ring-0 p-0 pr-6"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        member.characters[0]?.status === 'Ativo'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {member.characters[0]?.status || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleMemberExpansion(member.id)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  {expandedMember === member.id ? (
                    <ChevronUpIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  )}
                </button>
              </div>

              {expandedMember === member.id && (
                <div className="mt-4 pl-14">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Characters</h3>
                  <div className="space-y-4">
                    {member.characters.map((character) => (
                      <div key={character.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-medium text-gray-900 dark:text-white">{character.name}</h4>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                character.status === 'Ativo' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {character.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {character.primary_class} → {character.secondary_class}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleCharacterStatus(character)}
                              className={`p-2 rounded-full transition-colors ${
                                character.status === 'Ativo'
                                  ? 'text-green-500 hover:bg-green-100 dark:hover:bg-green-900/20'
                                  : 'text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20'
                              }`}
                            >
                              {character.status === 'Ativo' ? (
                                <EyeIcon className="h-5 w-5" />
                              ) : (
                                <EyeOffIcon className="h-5 w-5" />
                              )}
                            </button>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              character.type === 'gathering' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              character.type === 'processing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                              'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            }`}>
                              {character.type}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {character.skills && Object.entries(character.skills).map(([skillName, skillLevel]) => (
                            typeof skillLevel === 'number' && (
                              <div key={skillName} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">{skillName}</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{skillLevel}</span>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <PaginationControls
        currentPage={currentMembersPage}
        totalPages={totalMembersPages}
        onPageChange={setCurrentMembersPage}
        label="Page"
      />

      <div className="mt-8 bg-white bg-gray-with-oppacity rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <ClockIcon className="h-5 w-5" />
            Audit Logs
          </h2>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Action Type</label>
              <select
                value={filters.actionType}
                onChange={(e) => handleFilterChange('actionType', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                {ACTION_TYPES.map(type => (
                  <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Date From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Date To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Character Name</label>
              <input
                type="text"
                value={filters.characterName}
                onChange={(e) => handleFilterChange('characterName', e.target.value)}
                placeholder="Search by character..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-700">
          {isLoadingLogs ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              No audit logs found matching the current filters
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
              Page {currentLogsPage} of {Math.ceil(totalLogs / logsPerPage)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentLogsPage(prev => Math.max(1, prev - 1))}
              disabled={currentLogsPage === 1 || isLoadingLogs}
              className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-600 bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCurrentLogsPage(prev => prev + 1)}
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