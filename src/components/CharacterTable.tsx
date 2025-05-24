import React, { useState } from 'react';
import { Edit2Icon, Trash2Icon, EyeIcon, EyeOffIcon, FilterIcon } from 'lucide-react';
import { CharacterData, CharacterType, skillsByType, SkillData } from '../types';
import { EquipmentPanel } from './EquipmentPanel';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

interface CharacterTableProps {
  characters: CharacterData[];
  onEdit: (character: CharacterData) => void;
  onDelete: (characterId: string) => void;
  isAdmin?: boolean;
}

const CharacterTable: React.FC<CharacterTableProps> = ({ 
  characters, 
  onEdit, 
  onDelete,
  isAdmin = false
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CharacterType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };
  
  const filteredCharacters = characters.filter(character => {
    const matchesFilter = filter === 'all' || character.type === filter;
    const matchesSearch = character.name.toLowerCase().includes(searchTerm.toLowerCase());
    const isActive = character.status === 'Ativo';
    return matchesFilter && matchesSearch && isActive;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (characters.length === 0) {
    return (
      <div className="bg-white bg-gray-with-oppacity rounded-lg shadow-md p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">No characters added yet. Add your first character to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-white bg-gray-with-oppacity rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-2">
            <FilterIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as CharacterType | 'all')}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="gathering">Gathering</option>
              <option value="processing">Processing</option>
              <option value="crafting">Crafting</option>
            </select>
          </div>
          
          <div className="relative flex-grow max-w-md">
            <input
              type="text"
              placeholder="Search characters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 pl-8 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <span className="absolute left-2 top-1/2 transform -translate-y-1/2">
              <svg className="h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Class
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Created
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Last Updated
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white bg-gray-with-oppacity divide-y divide-gray-200 dark:divide-gray-700">
            {filteredCharacters.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No characters match your search criteria.
                </td>
              </tr>
            ) : (
              filteredCharacters.map(character => (
                <React.Fragment key={character.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {character.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        character.type === 'gathering' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        character.type === 'processing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      }`}>
                        {character.type.charAt(0).toUpperCase() + character.type.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {character.primary_class && (
                          <div>
                            <span className="font-medium">{character.primary_class}</span>
                            {character.secondary_class && (
                              <span className="text-gray-500 dark:text-gray-400"> → {character.secondary_class}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(character.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(character.updated_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button 
                        onClick={() => toggleExpand(character.id)}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      >
                        {expandedId === character.id ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                      </button>
                      {isAdmin && (
                        <>
                          <button 
                            onClick={() => onEdit(character)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                          >
                            <Edit2Icon className="h-5 w-5" />
                          </button>
                          <button 
                            onClick={() => onDelete(character.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                          >
                            <Trash2Icon className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {expandedId === character.id && (
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="space-y-6">
                          {/* Equipment Section */}
                          <div>
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Equipment</h4>
                            <div className="bg-gray-800/20 rounded-lg p-4">
                              <EquipmentPanel
                                equipment={character.equipment || {}}
                                characterId={character.id}
                                onEquipmentUpdate={() => {}} 
                                isEditable={false}
                              />
                            </div>
                          </div>

                          {/* Skills Section */}
                          <div>
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Skills</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {(Object.entries(character.skills) as [CharacterType, Record<string, { level: number; rank: string }>][]).map(([category, skills]) => (
                                <div key={category} className="bg-white bg-gray-with-oppacity rounded-lg p-4">
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 capitalize">{category}</h4>
                                  <div className="space-y-2">
                                    {Object.entries(skills).map(([skillName, { level, rank }]) => (
                                      <div key={skillName} className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">{skillName}</span>
                                        <div className="text-sm">
                                          <span className="font-medium text-gray-900 dark:text-white">{level}</span>
                                          <span className="text-gray-500 dark:text-gray-400 ml-2">{rank}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CharacterTable;

export { CharacterTable };