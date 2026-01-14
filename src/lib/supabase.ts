import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV_CONFIG } from './constants';
import { isValidSupabaseUrl } from './validators';

// Singleton instance
let sbClientInstance: SupabaseClient | null = null;

/**
 * Get environment variables with validation
 */
const getSupabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return { url, anonKey };
};

/**
 * Create a new Supabase client instance
 * Use this when you need a fresh client (e.g., with custom URL/key)
 */
export const createSupabaseClient = (url?: string, key?: string): SupabaseClient | null => {
  const config = getSupabaseConfig();
  const finalUrl = url || config.url;
  const finalKey = key || config.anonKey;

  if (!finalUrl || !finalKey) {
    console.error('[Supabase] Missing URL or Anon Key');
    return null;
  }

  if (finalKey === 'your_anon_key_here') {
    console.error('[Supabase] Anon key contains placeholder value');
    return null;
  }

  if (!isValidSupabaseUrl(finalUrl)) {
    console.warn('[Supabase] URL does not appear to be a valid Supabase URL:', finalUrl);
  }

  try {
    return createClient(finalUrl, finalKey);
  } catch (error) {
    console.error('[Supabase] Failed to create client:', error);
    return null;
  }
};

/**
 * Get the singleton Supabase client instance
 * Creates one if it doesn't exist
 */
export const getSbClient = (): SupabaseClient | null => {
  if (sbClientInstance) {
    return sbClientInstance;
  }

  const config = getSupabaseConfig();

  if (!config.url || !config.anonKey) {
    console.error('[Supabase] Cannot create client: missing environment variables');
    return null;
  }

  sbClientInstance = createSupabaseClient(config.url, config.anonKey);
  return sbClientInstance;
};

/**
 * Check if Supabase connection is working
 */
export const checkConnection = async (): Promise<boolean> => {
  const client = getSbClient();
  if (!client) return false;

  try {
    // Try a simple query to verify connection
    const { error } = await client
      .from('admin_users')
      .select('email')
      .limit(1);

    return !error;
  } catch {
    return false;
  }
};

/**
 * Reset the singleton instance (useful for testing or re-initialization)
 */
export const resetSbClient = (): void => {
  sbClientInstance = null;
};

/**
 * Check if client is initialized
 */
export const isClientInitialized = (): boolean => {
  return sbClientInstance !== null;
};

// Export type for external use
export type { SupabaseClient };
