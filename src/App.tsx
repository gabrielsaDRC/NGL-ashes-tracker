import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import { Auth } from './components/Auth';
import { GuildSelector } from './components/GuildSelector';
import { CharacterForm } from './components/CharacterForm';
import { CharacterTable } from './components/CharacterTable';
import { CharacterProfile } from './components/CharacterProfile';
import { AdminDashboard } from './components/AdminDashboard';
import { ItemDatabase } from './components/ItemDatabase';
import { ConfirmDialog } from './components/ConfirmDialog';
import { BuyOrders } from './components/BuyOrders';
import { supabase } from './lib/supabase';
import { CharacterData } from './types';
import { GuildInventory } from './components/GuildInventory';

function GuildView({ session }: { session: any }) {
  const [selectedGuildId, setSelectedGuildId] = useState<number | null>(null);
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [editingCharacter, setEditingCharacter] = useState<CharacterData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null }>({
    show: false,
    id: null,
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (session && selectedGuildId) {
      fetchCharacters();
      checkAdminStatus();
    }
  }, [session, selectedGuildId]);

  const checkAdminStatus = async () => {
    if (!selectedGuildId) return;

    try {
      const { data, error } = await supabase
        .from('guild_memberships')
        .select('role, status')
        .eq('guild_id', selectedGuildId)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(data?.role === 'admin' && data?.status === 'active');
    } catch (error) {
      console.error('Error in checkAdminStatus:', error);
      setIsAdmin(false);
    }
  };

  const fetchCharacters = async () => {
    if (!selectedGuildId) return;

    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('guild_id', selectedGuildId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching characters:', error);
      return;
    }

    setCharacters(data || []);
  };

  const handleSubmit = async (values: Omit<CharacterData, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!selectedGuildId) return;

    try {
      if (editingCharacter) {
        const { error } = await supabase
          .from('characters')
          .update({
            name: values.name,
            type: values.type,
            primary_class: values.primary_class,
            secondary_class: values.secondary_class,
            skills: values.skills,
            guild_id: selectedGuildId
          })
          .eq('id', editingCharacter.id);

        if (error) throw error;
      }

      await fetchCharacters();
      setShowForm(false);
      setEditingCharacter(null);
    } catch (error) {
      console.error('Error saving character:', error);
      throw error;
    }
  };

  const handleEdit = (character: CharacterData) => {
    setEditingCharacter(character);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { data: character, error: characterError } = await supabase
        .from('characters')
        .select('user_id')
        .eq('id', id)
        .single();

      if (characterError) throw characterError;

      const { error: deleteError } = await supabase
        .from('characters')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      const { data: remainingCharacters, error: countError } = await supabase
        .from('characters')
        .select('id')
        .eq('user_id', character.user_id);

      if (countError) throw countError;

      if (remainingCharacters.length === 0) {
        const { error: membershipError } = await supabase
          .from('guild_memberships')
          .delete()
          .eq('user_id', character.user_id)
          .eq('guild_id', selectedGuildId);

        if (membershipError) throw membershipError;
      }

      await fetchCharacters();
      setDeleteConfirm({ show: false, id: null });
    } catch (error) {
      console.error('Error deleting character:', error);
    }
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-end space-x-4 hidden">
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Admin Dashboard
          </button>
        )}
        <button
          onClick={() => navigate('/guild-inventory')}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          Guild Inventory
        </button>
        <button
          onClick={() => navigate('/buy-orders')}
          className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
        >
          Buy Orders
        </button>
        <button
          onClick={() => navigate('/items')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Item Database
        </button>
        <button
          onClick={() => navigate(`/profile/${session.user.id}`)}
          className="px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-500 rounded-md transition-colors"
        >
          View Profile
        </button>
      </div>
  
      <GuildSelector
        selectedGuildId={selectedGuildId}
        onSelectGuild={setSelectedGuildId}
      />
  
      {selectedGuildId && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Characters</h2>
          </div>
  
          {showForm && (
            <CharacterForm
              initialValues={editingCharacter || undefined}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingCharacter(null);
              }}
            />
          )}
  
          <CharacterTable
            characters={characters}
            onEdit={handleEdit}
            onDelete={(id) => setDeleteConfirm({ show: true, id })}
            isAdmin={isAdmin}
          />
  
          <ConfirmDialog
            isOpen={deleteConfirm.show}
            title="Delete Character"
            message="Are you sure you want to delete this character? This action cannot be undone. If this is the user's last character, their guild membership will also be removed."
            onConfirm={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
            onCancel={() => setDeleteConfirm({ show: false, id: null })}
          />
        </>
      )}
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return (
      <Layout>
        <Auth />
      </Layout>
    );
  }

  return (
    <Layout>
      <Toaster position="top-right" />
      <div className="space-y-6">
        <Routes>
          <Route path="/" element={<GuildView session={session} />} />
          <Route path="/profile/:id" element={<CharacterProfile />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/items" element={<ItemDatabase />} />
          <Route path="/guild-inventory" element={<GuildInventory />} />
          <Route path="/buy-orders" element={<BuyOrders />} />
        </Routes>
      </div>
    </Layout>
  );
}

export default App;