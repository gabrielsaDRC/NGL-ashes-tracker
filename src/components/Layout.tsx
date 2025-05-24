import React, { useState, useEffect } from 'react';
import { 
  SwordIcon, 
  LogOutIcon, 
  HomeIcon, 
  ShoppingBagIcon, 
  DatabaseIcon, 
  UserIcon,
  MenuIcon,
  XIcon,
  ShieldIcon,
  Settings2Icon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{
    avatar_url?: string;
    username?: string;
    discriminator?: string;
  } | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setIsAuthenticated(!!session);
      setUserId(session?.user?.id || null);
      
      if (session?.user) {
        checkAdminStatus(session.user.id);
        
        // Get Discord profile data from user metadata
        const { user } = session;
        if (user.app_metadata.provider === 'discord') {
          setUserProfile({
            avatar_url: user.user_metadata.avatar_url,
            username: user.user_metadata.full_name || user.user_metadata.username,
            discriminator: user.user_metadata.custom_claims?.global_name
          });
        }
      } else {
        setIsAdmin(false);
        setUserProfile(null);
      }
      setIsLoading(false);
    });

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setUserId(session?.user?.id || null);

      if (session?.user) {
        checkAdminStatus(session.user.id);

        const { user } = session;

        const providers = user.app_metadata?.providers || [];
        if (Array.isArray(providers) && providers.includes('discord')) {
          setUserProfile({
            avatar_url: user.user_metadata.avatar_url,
            username: user.user_metadata.full_name || user.user_metadata.username,
            discriminator: user.user_metadata.custom_claims?.global_name
          });
        }
      }

      setIsLoading(false);
    });


    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAdminStatus = async (uid: string) => {
    try {
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
        .eq('user_id', uid)
        .eq('status', 'active')
        .single();

      setIsAdmin(membership?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.split('=');
        document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      });

      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const navigationItems = [
    {
      section: 'Main',
      items: [
        { path: '/', label: 'Home', icon: HomeIcon }
      ]
    },
    {
      section: 'Guild',
      items: [
        { path: '/guild-inventory', label: 'Guild Inventory', icon: DatabaseIcon },
        { path: '/buy-orders', label: 'Buy Orders', icon: ShoppingBagIcon },
        { path: '/items', label: 'Item Database', icon: SwordIcon }
      ]
    }
  ];

  if (isAdmin) {
    navigationItems.push({
      section: 'Admin',
      items: [
        { path: '/admin', label: 'Admin Dashboard', icon: Settings2Icon }
      ]
    });
  }

  if (isAuthenticated && userId) {
    navigationItems.push({
      section: 'Account',
      items: [
        { path: `/profile/${userId}`, label: 'View Profile', icon: UserIcon }
      ]
    });
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">{children}</div>;
  }

  // If not authenticated, center the auth component
  if (!isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center">{children}</div>;
  }

  return (
    <div className="min-h-screen flex bg-black/10">
      {/* Sidebar */}
      <div 
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-900/95 transform transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <ShieldIcon className="h-8 w-8 text-yellow-500" />
              <h1 className="text-xl font-bold text-white">Not Gonna Lie</h1>
            </div>
          </div>

          {/* User Profile */}
          {userProfile && (
            <div className="px-6 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                {userProfile.avatar_url ? (
                  <img
                    src={userProfile.avatar_url}
                    alt={userProfile.username}
                    className="w-10 h-10 rounded-full border-2 border-yellow-500"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-yellow-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {userProfile.username}
                  </p>
                  {userProfile.discriminator && (
                    <p className="text-xs text-gray-400 truncate">
                      {userProfile.discriminator}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto">
            {navigationItems.map((section) => (
              <div key={section.section}>
                <h2 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {section.section}
                </h2>
                <div className="mt-2 space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          navigate(item.path);
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          isActive 
                            ? 'bg-yellow-500/20 text-yellow-500' 
                            : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Logout section with copyright */}
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors mb-4"
            >
              <LogOutIcon className="h-5 w-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
          <div className="p-4 border-t border-gray-800">
            <p className="text-sm text-gray-500 text-center px-4">
              © 2025 NGL - Character Tracker
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-40 bg-gray-900/95 backdrop-blur-sm shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <ShieldIcon className="h-6 w-6 text-yellow-500" />
              <h1 className="text-lg font-bold text-white">Not Gonna Lie</h1>
            </div>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              {isSidebarOpen ? (
                <XIcon className="h-6 w-6" />
              ) : (
                <MenuIcon className="h-6 w-6" />
              )}
            </button>
          </div>
        </header>

        {/* Backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;