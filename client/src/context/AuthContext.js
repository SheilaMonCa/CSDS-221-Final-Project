import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import api from '../api'

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Takes the raw Supabase auth user, fetches the matching public.users row,
  // and returns a merged object so user.username / user.email / user.id
  // work everywhere in the app exactly as before — nothing else needs changing.
  const buildUser = async (authUser) => {
    if (!authUser) return null;
    try {
      const { data } = await api.get(`/api/users/${authUser.id}/profile`);
      return {
        ...authUser,          // keep all supabase fields (id, email, etc.)
        username: data.username,
        email:    data.email,
      };
    } catch {
      // Fallback: use metadata if DB fetch fails (e.g. trigger hasn't fired yet)
      return {
        ...authUser,
        username: authUser.user_metadata?.username ?? '',
        email:    authUser.email ?? '',
      };
    }
  };

  useEffect(() => {
    // Restore existing session on mount — fixes "logged out on refresh"
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(await buildUser(session?.user ?? null));
      setLoading(false);
    });

    // Fires on login, logout, token refresh, and tab restore
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(await buildUser(session?.user ?? null));
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Call after a profile update so navbar/header reflect changes immediately
  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(await buildUser(session?.user ?? null));
  };

  const logout = () => supabase.auth.signOut();

  // Use this after server-side account deletion — the Auth user is already gone
  // so calling signOut() would 403. Instead just wipe local session state.
  const logoutLocal = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, logoutLocal, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);