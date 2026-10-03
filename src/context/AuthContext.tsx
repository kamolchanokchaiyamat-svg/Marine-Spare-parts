import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile } from '../types/database';

interface RegisterData {
  fullName: string;
  employeeId: string;
  email: string;
  password: string;
}

interface AuthContextType {
  currentUser: Profile | null;
  session: any;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isSRM: boolean;
  isConfigured: boolean;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
  switchDemoUser: (role: 'ADMIN' | 'SRM') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch or create profile for authenticated user
  const fetchUserProfile = async (userId: string, userEmail?: string, userMeta?: any): Promise<Profile | null> => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data && !fetchErr) {
        return {
          ...data,
          email: userEmail || data.email,
        };
      }

      // If user row not yet in profiles (e.g. freshly registered on real Supabase), create it
      const fallbackProfile: Profile = {
        id: userId,
        full_name: userMeta?.full_name || 'SRM Officer',
        employee_id: userMeta?.employee_id || `UT-${Math.floor(10000 + Math.random() * 90000)}`,
        role: 'SRM', // Never allow ADMIN upon self-registration
        status: 'ACTIVE',
        email: userEmail,
        last_login: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await supabase.from('profiles').insert(fallbackProfile);
      return fallbackProfile;
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
      return null;
    }
  };

  // Initialize session on mount
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        setLoading(true);
        const { data: { session: existingSession } } = await supabase.auth.getSession();

        if (existingSession && mounted) {
          setSession(existingSession);
          const profile = await fetchUserProfile(
            existingSession.user.id,
            existingSession.user.email,
            existingSession.user.user_metadata
          );
          if (mounted) setCurrentUser(profile);
        }
      } catch (err: any) {
        console.error('Init session error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initSession();

    // Listen to Supabase Auth State changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: any, newSession: any) => {
      if (!mounted) return;
      setSession(newSession);

      if (newSession?.user) {
        const profile = await fetchUserProfile(
          newSession.user.id,
          newSession.user.email,
          newSession.user.user_metadata
        );
        if (mounted) setCurrentUser(profile);
      } else {
        if (mounted) setCurrentUser(null);
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  const refreshProfile = async () => {
    if (!currentUser?.id) return;
    const updated = await fetchUserProfile(currentUser.id, currentUser.email);
    if (updated) setCurrentUser(updated);
  };

  // Registration: users are ALWAYS registered as SRM with ACTIVE status
  const register = async ({ fullName, employeeId, email, password }: RegisterData) => {
    try {
      setError(null);
      setLoading(true);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            employee_id: employeeId.trim().toUpperCase(),
            // role is forced to SRM on the backend / trigger
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return { success: false, error: signUpError.message };
      }

      if (data.session) {
        setSession(data.session);
        const profile = await fetchUserProfile(data.session.user.id, email, {
          full_name: fullName,
          employee_id: employeeId,
        });
        setCurrentUser(profile);
      }

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Registration failed';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // Login: validates credentials with Supabase Auth & records last_login
  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return { success: false, error: signInError.message };
      }

      if (data.session) {
        setSession(data.session);
        const profile = await fetchUserProfile(
          data.session.user.id,
          data.session.user.email,
          data.session.user.user_metadata
        );

        if (profile?.status === 'INACTIVE') {
          await supabase.auth.signOut();
          setSession(null);
          setCurrentUser(null);
          const inactiveMsg = 'This account has been deactivated by the Admin.';
          setError(inactiveMsg);
          return { success: false, error: inactiveMsg };
        }

        // Record last_login in Supabase database
        if (profile) {
          const now = new Date().toISOString();
          await supabase
            .from('profiles')
            .update({ last_login: now })
            .eq('id', profile.id);
          profile.last_login = now;
          setCurrentUser(profile);
        }
      }

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setSession(null);
      setCurrentUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password
  const resetPassword = async (email: string) => {
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email);
      if (resetErr) return { success: false, error: resetErr.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Switch demo test user for fast testing (Admin vs SRM)
  const switchDemoUser = async (role: 'ADMIN' | 'SRM') => {
    const targetEmail = role === 'ADMIN' ? 'admin.somchai@unithai.com' : 'ing.srm@unithai.com';
    await login(targetEmail, 'password123');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        session,
        loading,
        error,
        isAdmin: currentUser?.role === 'ADMIN',
        isSRM: currentUser?.role === 'SRM',
        isConfigured: isSupabaseConfigured,
        register,
        login,
        logout,
        resetPassword,
        refreshProfile,
        switchDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
