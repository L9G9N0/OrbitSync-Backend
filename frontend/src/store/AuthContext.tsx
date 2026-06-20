import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncUser = (s: Session | null) => {
    if (s?.user) {
      setUser({ id: s.user.id, email: s.user.email ?? '', created_at: s.user.created_at });
      setSession(s);
    } else {
      setUser(null);
      setSession(null);
    }
  };

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data }) => {
      syncUser(data.session);
      setIsLoading(false);
    });

    // Listen to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      syncUser(s);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
    } catch (e: any) {
      setError(e.message ?? 'Sign in failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) throw err;
    } catch (e: any) {
      setError(e.message ?? 'Sign up failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) setError(err.message);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, isLoading, signIn, signUp, signOut, resetPassword, error, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
};
