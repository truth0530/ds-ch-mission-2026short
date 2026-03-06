'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { AuthState, AdminRole } from '@/types';
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
    adminRole: null,
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
        .select('email, role')
        .eq('email', user.email)
        .maybeSingle();

      if (dbError) {
        console.error('[useAdminAuth] DB error:', dbError);
        setError('권한 확인 중 오류가 발생했습니다.');
        return false;
      }

      const fallbackEmail = ENV_CONFIG.ADMIN_EMAIL;

      if (data) {
        const role = (data.role as AdminRole) || 'all';
        setAuthState(prev => ({ ...prev, adminRole: role }));
        setError(null);
        return true;
      }

      if (fallbackEmail && user.email === fallbackEmail) {
        setAuthState(prev => ({ ...prev, adminRole: 'master' }));
        setError(null);
        return true;
      }

      return false;
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
      setAuthState({ user: null, isAdmin: false, adminRole: null, loading: false });
      return;
    }

    const isAdmin = await checkAdminStatus(user);
    setAuthState(prev => ({ ...prev, user, isAdmin, loading: false }));
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
      setAuthState({ user: null, isAdmin: false, adminRole: null, loading: false });
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
 * Check if a role has access to a specific page scope.
 * master → everything
 * all → survey + tour (but not admin management)
 * survey → survey pages only
 * tour → tour pages only
 */
export function hasAccess(role: AdminRole | null, scope: 'survey' | 'tour' | 'master'): boolean {
  if (!role) return false;
  if (role === 'master') return true;
  if (scope === 'master') return false;
  if (role === 'all') return true;
  return role === scope;
}

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
