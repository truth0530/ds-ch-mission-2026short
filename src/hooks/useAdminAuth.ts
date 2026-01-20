'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { AuthState } from '@/types';
import { getSbClient, SupabaseClient } from '@/lib/supabase';
import { TABLES, ENV_CONFIG } from '@/lib/constants';

interface UseAdminAuthReturn extends AuthState {
  login: (redirectPath?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAdminStatus: (user: User) => Promise<boolean>;
  client: SupabaseClient | null;
  error: string | null;
  clearError: () => void;
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
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Check if user is an admin
   */
  const checkAdminStatus = useCallback(async (user: User): Promise<boolean> => {
    if (!client) {
      setError('데이터베이스 연결에 실패했습니다.');
      return false;
    }

    try {
      const { data, error: dbError } = await client
        .from(TABLES.ADMIN_USERS)
        .select('email')
        .eq('email', user.email)
        .maybeSingle();

      if (dbError) {
        console.error('[useAdminAuth] DB error:', dbError);
        setError('권한 확인 중 오류가 발생했습니다.');
        return false;
      }

      // Check DB first, then fallback to env admin email
      const fallbackEmail = ENV_CONFIG.ADMIN_EMAIL;
      const isAdmin = !!data || !!(fallbackEmail && user.email === fallbackEmail);
      if (isAdmin) setError(null);
      return isAdmin;
    } catch (err) {
      console.error('[useAdminAuth] Error checking admin status:', err);
      setError('권한 확인 중 오류가 발생했습니다.');
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
  const login = useCallback(async (redirectPath?: string) => {
    if (!client) {
      setError('데이터베이스 연결에 실패했습니다.');
      return;
    }

    try {
      const { error: authError } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: { access_type: 'offline', prompt: 'select_account' },
          redirectTo: window.location.origin + (redirectPath || '/admin/dashboard')
        },
      });

      if (authError) {
        setError('로그인에 실패했습니다.');
      }
    } catch (err) {
      console.error('[useAdminAuth] Login error:', err);
      setError('로그인 중 오류가 발생했습니다.');
    }
  }, [client]);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    if (!client) {
      setError('데이터베이스 연결에 실패했습니다.');
      return;
    }

    try {
      await client.auth.signOut();
      setAuthState({ user: null, isAdmin: false, loading: false });
      window.location.reload();
    } catch (err) {
      console.error('[useAdminAuth] Logout error:', err);
      setError('로그아웃에 실패했습니다.');
    }
  }, [client]);

  return {
    ...authState,
    login,
    logout,
    checkAdminStatus,
    client,
    error,
    clearError,
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
