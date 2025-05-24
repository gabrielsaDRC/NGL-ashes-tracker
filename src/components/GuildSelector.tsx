import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Guild } from '../types';
import toast from 'react-hot-toast';

interface GuildSelectorProps {
  selectedGuildId: number | null;
  onSelectGuild: (guildId: number) => void;
}

export function GuildSelector({ selectedGuildId, onSelectGuild }: GuildSelectorProps) {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchGuilds();
  }, []);

  const fetchGuilds = async () => {
    try {
      setIsLoading(true);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Error getting session:', sessionError);
        toast.error('Please log in to view guilds');
        return;
      }

      // Get all guilds first
      const { data: allGuilds, error: guildError } = await supabase
        .from('guilds')
        .select('*');

      if (guildError) {
        console.error('Error fetching guilds:', guildError);
        toast.error('Failed to fetch guilds');
        return;
      }

      // Filter for "Not Gonna Lie" guild
      const nglGuild = allGuilds?.find(guild => guild.name === 'Not Gonna Lie');

      if (nglGuild) {
        setGuilds([nglGuild]);
        if (!selectedGuildId) {
          onSelectGuild(nglGuild.id);
        }
      } else {
        console.error('Guild "Not Gonna Lie" not found');
        toast.error('Guild not found');
        setGuilds([]);
      }
    } catch (error) {
      console.error('Error in fetchGuilds:', error);
      toast.error('Failed to fetch guilds');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Loading Guild...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-4">

      {guilds.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {guilds.map((guild) => (
            <button
              key={guild.id}
              onClick={() => onSelectGuild(guild.id)}
              className={`p-4 rounded-lg border hidden ${
                selectedGuildId === guild.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              } text-left transition-colors`}
            >
              <h3 className="font-medium text-gray-900 dark:text-white">{guild.name}</h3>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
          No guild found
        </p>
      )}
    </div>
  );
}