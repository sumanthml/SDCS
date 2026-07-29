import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid) => {
    if (!isSupabaseEnabled) return;
    try {
      const { data } = await supabase.from('users').select('*').eq('id', uid).single();
      if (data) setProfile(data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!isSupabaseEnabled) {
      // Try localStorage mock session
      const stored = localStorage.getItem('shopflow_mock_session');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          setUser(u); setProfile(u);
        } catch (_) {}
      }
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); fetchProfile(session.user.id); }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (session?.user) { setUser(session.user); fetchProfile(session.user.id); }
      else { setUser(null); setProfile(null); }
    });

    return () => sub.subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email, password) => {
    if (!isSupabaseEnabled) {
      const u = { id: `mock-${Date.now()}`, email, role: 'Planner', full_name: email.split('@')[0] };
      localStorage.setItem('shopflow_mock_session', JSON.stringify(u));
      setUser(u); setProfile(u);
      return { error: null };
    }
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email, password, fullName, role) => {
    if (!isSupabaseEnabled) {
      const u = { id: `mock-${Date.now()}`, email, role, full_name: fullName };
      localStorage.setItem('shopflow_mock_session', JSON.stringify(u));
      setUser(u); setProfile(u);
      return { error: null };
    }
    return supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, role } } });
  };

  const signOut = async () => {
    localStorage.removeItem('shopflow_mock_session');
    if (isSupabaseEnabled) await supabase.auth.signOut();
    setUser(null); setProfile(null);
  };

  const updateRole = async (newRole) => {
    if (!isSupabaseEnabled) {
      const updated = { ...profile, role: newRole };
      setProfile(updated);
      localStorage.setItem('shopflow_mock_session', JSON.stringify(updated));
      return;
    }
    await supabase.from('users').update({ role: newRole }).eq('id', user.id);
    setProfile(p => ({ ...p, role: newRole }));
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, updateRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
