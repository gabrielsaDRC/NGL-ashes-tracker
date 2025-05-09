import { Auth as SupabaseAuth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

interface AuthProps {}

export const Auth: React.FC<AuthProps> = () => {
  const [characterName, setCharacterName] = useState('');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    try {
      if (!characterName.trim()) {
        setError('Character name is required');
        return;
      }

      setIsLoading(true);
      setError('');

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            character_name: characterName.trim()
          }
        }
      });

      if (signUpError) {
        console.error('Error signing up:', signUpError);
        setError(signUpError.message);
        return;
      }

      if (data?.user) {
        // Get the guild
        const { data: guilds, error: guildError } = await supabase
          .from('guilds')
          .select('id')
          .eq('name', 'Not Gonna Lie')
          .single();

        if (guildError) {
          console.error('Error fetching guild:', guildError);
          throw guildError;
        }

        // Create guild membership with 'member' role
        const { error: membershipError } = await supabase
          .from('guild_memberships')
          .insert([{
            guild_id: guilds.id,
            user_id: data.user.id,
            role: 'member',
            status: 'active'
          }]);

        if (membershipError) {
          console.error('Error creating guild membership:', membershipError);
          throw membershipError;
        }

        // Initialize character with default skills
        const { error: characterError } = await supabase
          .from('characters')
          .insert([{
            name: characterName.trim(),
            type: 'gathering',
            skills: {
              gathering: {},
              processing: {},
              crafting: {}
            },
            user_id: data.user.id,
            guild_id: guilds.id,
            primary_class: 'Fighter',
            secondary_class: 'Weapon Master',
            status: 'Ativo'
          }]);

        if (characterError) {
          console.error('Error creating character:', characterError);
          throw characterError;
        }

        toast.success('Account created successfully! Your character has been created and added to the guild.');
        setCharacterName('');
        setEmail('');
        setPassword('');
        setError('');
      }
    } catch (err) {
      console.error('Unexpected error during signup:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-sm w-full p-6 background-card-att bg-gray-with-oppacity /80 backdrop-blur-sm rounded-lg shadow-lg">
        <SupabaseAuth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#3B82F6',
                  brandAccent: '#2563EB',
                },
              },
            },
            className: {
              container: 'flex flex-col gap-4',
              label: 'text-sm font-medium text-white dark:text-white-300',
              input:
                'mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yelllow-500 focus:ring-yelllow-500 dark:bg-gray-700 text-white sm:text-sm',
              button:
                'w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yelllow-600 hover:bg-yelllow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yelllow-500',
            },
          }}
          providers={[]}
          onlyThirdPartyProviders={false}
          redirectTo={window.location.origin}
          onSubmit={(formData) => {
            if (formData.type === 'signup') {
              setEmail(formData.email);
              setPassword(formData.password);
              setShowNameInput(true);
              return false;
            }
            return true;
          }}
        />
      </div>
    </div>
  );
};