'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { AuthState } from '@/types';
import { getSbClient, SupabaseClient } from '@/lib/supabase';
import { TABLES, ENV_CONFIG } from '@/lib/constants';

interface UseAdminAuthReturn extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  checkAdminStatus: (user: User) => Promise<boolean>;
  client: SupabaseClient | null;
}

/**
 * Custom hook for admin authentication
 * Centralizes auth logic that was duplicated across multiple components
 */
export function useAdminAuth(): UseAdminAuthReturn {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    loading: true,
  });
  const [client, setClient] = useState<SupabaseClient | null>(null);

  /**
   * Check if user is an admin
   */
  const checkAdminStatus = useCallback(async (user: User): Promise<boolean> => {
    if (!client) return false;

    try {
      const { data } = await client
        .from(TABLES.ADMIN_USERS)
        .select('email')
        .eq('email', user.email)
        .maybeSingle();

      // Check DB first, then fallback to env admin email
      const fallbackEmail = ENV_CONFIG.ADMIN_EMAIL;
      return !!data || !!(fallbackEmail && user.email === fallbackEmail);
    } catch (error) {
      console.error('[useAdminAuth] Error checking admin status:', error);
      return false;
    }
  }, [client]);

  /**
   * Handle auth state changes
   */
  const handleAuthChange = useCallback(async (user: User | null) => {
    if (!user) {
      setAuthState({ user: null, isAdmin: false, loading: false });
      return;
    }

    const isAdmin = await checkAdminStatus(user);
    setAuthState({ user, isAdmin, loading: false });
  }, [checkAdminStatus]);

  /**
   * Initialize auth
   */
  useEffect(() => {
    let isMounted = true;
    const sbClient = getSbClient();

    if (!sbClient) {
      setAuthState(prev => ({ ...prev, loading: false }));
      return;
    }

    setClient(sbClient);

    // Get initial session
    sbClient.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      handleAuthChange(session?.user || null);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = sbClient.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        handleAuthChange(session?.user || null);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [handleAuthChange]);

  /**
   * Login with Google OAuth
   */
  const login = useCallback(async () => {
    if (!client) return;

    await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, [client]);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    if (!client) return;

    await client.auth.signOut();
    setAuthState({ user: null, isAdmin: false, loading: false });
  }, [client]);

  return {
    ...authState,
    login,
    logout,
    checkAdminStatus,
    client,
  };
}

/**
 * Hook to require admin access
 * Redirects to home if not admin
 */
export function useRequireAdmin(): UseAdminAuthReturn & { isAuthorized: boolean } {
  const auth = useAdminAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!auth.loading) {
      setIsAuthorized(auth.isAdmin);
    }
  }, [auth.loading, auth.isAdmin]);

  return {
    ...auth,
    isAuthorized,
  };
}
